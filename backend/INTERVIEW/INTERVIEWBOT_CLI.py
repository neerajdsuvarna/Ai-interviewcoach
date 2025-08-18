import json
import time
import ollama
from textblob import TextBlob

RED = "\033[31m"
BOLD = "\033[1m"
BLUE = "\033[34m"
GREEN = "\033[32m"
CYAN = "\033[36m"
RESET = "\033[0m"

def log(func_name):
    if func_name.startswith("handle_"):
        color_code = (
            BLUE + BOLD if "intro" in func_name else
            GREEN + BOLD if "job" in func_name else
            CYAN + BOLD if "icebreaker" in func_name else
            "\033[35m" + BOLD if "followup" in func_name else
            "\033[33m" + BOLD if "resume" in func_name else
            "\033[96m" + BOLD if "custom" in func_name else
            "\033[91m" + BOLD if "candidate" in func_name else
            RED + BOLD
        )
    else:  # subfunctions like generate_ / assess_
        color_code = (
            BLUE if "intro" in func_name else
            GREEN if "job" in func_name else
            CYAN if "icebreaker" in func_name else
            "\033[35m" if "followup" in func_name else
            "\033[33m" if "resume" in func_name else
            "\033[96m" if "custom" in func_name else
            "\033[91m" if "candidate" in func_name else
            RED
        )

    print(f"{color_code}[Debug] called {func_name}{RESET}")



class InteractiveInterviewBot:
    def __init__(self, config_path="interview_config.json", model="llama3"):
        log("__init__")
        with open(config_path, "r") as file:
            self.config = json.load(file)

        self.model = model
        self.job_title = self.config.get("job_title", "this position")
        self.job_description = self.config.get("job_description", "")
        self.interview_style = self.config.get("interview_style", "conversational")
        self.required_questions = self.config.get("custom_questions", [])
        self.core_questions = self.config.get("core_questions", [])
        self.icebreakers = self.config.get("icebreakers", [])
        self.time_limit = self.config.get("time_limit_minutes", 15) * 60

        self.conversation_history = []
        self.evaluation_log = []
        self.asked_questions = set()
        self.stage = "introduction"

        self.memory = {'projects': [], 'skills': set()}
        self.job_description_shown = False
        self.start_time = None
        self.intro_done = False
        self.job_qna_done = False
        self.max_icebreaker_retries = 3 #Number of ice breaker questions asked 
        self.max_followup_retries = 3   #Number of intro follow-ups questions asked 
        self.intro_retry_count = 0
        self.max_intro_retries = 4
        self.current_custom_question = None
        self.custom_followup_retry_count = 0
        self.max_custom_followup_retries = 3
        self.answered_candidate_questions = False
        self.custom_followup_evaluations = []

    def start_interview(self):
        log("start_interview")
        print(f"Interview Assistant: Let's begin your interview for the role of {self.job_title}.")
        self.start_time = time.time()

        while True:
            elapsed = time.time() - self.start_time
            if elapsed >= self.time_limit:
                self.stage = "wrapup_evaluation"

            user_input = input("Candidate: ").strip()
            if user_input.lower() in ["exit", "quit"]:
                print("Interview Assistant: Thank you for your time. Goodbye!")
                break

            self.dispatch_stage(user_input)

            if self.stage == "wrapup_evaluation":
                self.evaluate_candidate()
                break


    # ===== Stage Handlers =====
    def dispatch_stage(self, user_input):
        stage_map = {
            "introduction": self.handle_intro_stage,
            "explain_job_role_briefly": self.handle_explain_job_role_briefly_stage,
            "answer_job_related_qna": self.handle_answer_job_related_qna_stage,
            "icebreaker": self.handle_icebreaker_stage,
            "intro_followup": self.handle_intro_followup_stage,
            "resume_discussion": self.handle_resume_discussion_stage,
            "core_question_followup": self.handle_core_question_followup_stage,
            "custom_questions": self.handle_custom_questions_stage,
            "custom_question_followup": self.handle_custom_question_followup_stage,
            "candidate_questions": self.handle_candidate_questions_stage,
            "wrapup_evaluation": self.evaluate_candidate
        }
        handler = stage_map.get(self.stage)
        if handler:
            handler(user_input)
        else:
            print(f"[ERROR] Unknown stage: {self.stage}")

    # ===== Stage Handlers =====


    def handle_intro_stage(self, user_input):
        log("handle_intro_stage")
        self.conversation_history.append({"role": "user", "content": user_input})
        if self.job_qna_done:
            log("Skipping job role explanation – already completed.")
        # 🔍 Check if candidate is asking about the job
        else:
            if self.should_explain_job_role() == "yes":
                self.stage = "explain_job_role_briefly"  # Go to role explanation stage
                self.dispatch_stage(user_input)
                return  # Exit this handler to avoid double-processing


        intro_status = self.assess_intro_progress()
        print(f"[DEBUG] Intro stage decision: {intro_status}")

        if intro_status == "continue":
            self.intro_done = True
            self.intro_retry_count = 0  # ✅ reset counter
            print("[DEBUG] Intro complete. Moving to icebreaker stage.")
            self.stage = "icebreaker"
            self.dispatch_stage("")
        else:
            self.intro_done = False
            self.intro_retry_count += 1

            if self.intro_retry_count >= self.max_intro_retries:
                print("[DEBUG] Max intro retries reached. Proceeding anyway.")
                self.stage = "icebreaker"
                self.dispatch_stage("")
                return

            reply = self.generate_contextual_intro_reply(user_input)
            print(f"Interview Assistant: {reply}")


    def generate_contextual_intro_reply(self, user_response):
        log("generate_contextual_intro_reply")

        base_prompt = """
        You are an AI interviewer conducting a formal but friendly job interview.

        Your goal is to guide the candidate through the introduction stage.
        Respond naturally and warmly — like a real human interviewer would — but avoid slang like "atcha", "buddy", "yo", or casual jokes.

        Keep the reply professional and under 15 words. Avoid greetings like "Nice to meet you" if already said.

        Examples:
        - "Hi! Can you tell me a bit about yourself?"
        - "Thanks! Let's begin — what's your background?"
        - "Could you share a quick intro?"

        Respond with one short sentence only. Avoid repeating earlier greetings or questions.
        """

        # ✅ Add a one-time nudge if job Q&A just finished
        if self.job_qna_done:
            base_prompt += "\nThe candidate just finished asking about the job role. Now gently transition back to the introduction."

        messages = [{"role": "system", "content": base_prompt}]
        messages.extend(self.conversation_history)
        messages.append({"role": "user", "content": user_response})

        try:
            response = ollama.chat(
                model=self.model,
                messages=messages
            )
            return response['message']['content'].strip()
        except Exception as e:
            print(f"[ERROR] contextual_intro_reply failed: {e}")
            return "Hi! Could you tell me a little about your background?"
       

    def assess_intro_progress(self):
        log("assess_intro_progress")
        prompt = f"""
        You are an AI interviewer at the beginning of a job interview. Here's the conversation so far:

        {json.dumps(self.conversation_history, indent=2)}

        Your goal is to determine if the candidate has successfully introduced themselves.
        A self-introduction should mention some combination of name, education, work experience, background, or motivation.

        Respond with only one of the following:
        - "continue" → if the candidate introduced themselves with name + education or any meaningful combo
        - "wait" → if they seem mid-way (e.g., paused, said “let me tell more”, etc.)
        - "retry" → only if they’re trolling, completely off-topic, or said something like “idk” or “whatever”

        Note: Accept responses like “that’s all” or “I’ve told everything” as "continue" if any intro details were already shared earlier.

        """

        try:
            response = ollama.chat(
                model=self.model,
                messages=[{"role": "system", "content": prompt}]
            )
            return response["message"]["content"].strip().lower()
        except Exception as e:
            print(f"[ERROR] assess_intro_progress failed: {e}")
            return "retry"
        

    
    

    def should_explain_job_role(self):
        log("should_explain_job_role")
        prompt = f"""
        You are an AI interviewer assistant in a live job interview.

        Here’s the conversation so far:
        {json.dumps(self.conversation_history, indent=2)}

        Determine if the assistant should now explain the job role or description.

        Say "yes" ONLY IF:
        - The candidate clearly asked about the job, responsibilities, or expectations (e.g. “what does this role involve?”, “can you explain the job?”, “what would I be doing?”, “tell me about the position”).
        - The assistant previously promised to explain the job but hasn’t yet.

        DO NOT say "yes" for vague or reactive replies like “why?”, “what?”, “no”, “idk”, “ok”, “I guess”, “maybe”, “huh?”, “can you repeat?”, etc.

        Answer with "yes" or "no" only.
        """


        try:
            response = ollama.chat(
                model=self.model,
                messages=[{"role": "system", "content": prompt}]
            )
            return response["message"]["content"].strip().lower()
        except Exception as e:
            print(f"[ERROR] Role explanation decision failed: {e}")
            return "no"

    

    
    
    # ===== END OF INTRO STAGE AND ITS RELEVANT FUNCTIONS USED =====


    # ===== BEGINING OF - EXPLAINING JOB DESCRIPTION STAGE AND ITS RELEVANT FUNCTIONS USED =====
    def handle_explain_job_role_briefly_stage(self, _):
        log("handle_explain_job_role_briefly_stage")

        # Step 1: Explain job role
        self.explain_job_role_naturally()

        # Step 2: Mark job explanation as done
        self.job_description_shown = True

        # Step 3: Ask if they have questions
        question_prompt = "Do you have any questions about the role before we proceed?"
        print(f"Interview Assistant: {question_prompt}")
        self.conversation_history.append({"role": "assistant", "content": question_prompt})

        follow_up = input("Candidate: ").strip()
        self.conversation_history.append({"role": "user", "content": follow_up})

        # Step 4: Decide next stage
        status = self.should_continue_after_job_explanation()
        if status == "done":
            print("Interview Assistant: Great — let’s continue then.")
            self.job_qna_done = True
            self.stage = "icebreaker" if self.intro_done else "introduction"
        else:
            self.stage = "answer_job_related_qna"


    def should_continue_after_job_explanation(self):
        log("should_continue_after_job_explanation")
        
        # Get the last 4 exchanges (user + assistant)
        recent_context = json.dumps(self.conversation_history[-4:], indent=2)
        
        # DEBUG: Print what the LLM sees
        print("\n[DEBUG] Job QnA Decision Context:\n" + recent_context + "\n")
        
        prompt = f"""
            You are an AI interviewer assistant.

            The candidate has just received an explanation of the job role. The assistant asked if they have any more questions about the role.

            Here is the last part of the conversation:
            {recent_context}

            Now determine if the candidate is finished asking about the job role.

            Respond with only one of the following:
            - "done" → if the candidate clearly indicated they are finished
            - "continue" → if the candidate might still have questions

             Consider it "done" ONLY IF the last user message clearly indicates they are finished:
            - "no"
            - "that's all"
            - "i'm good"
            - "nothing else"
            - "i'm clear"
            - "ready to proceed"
            - "let's continue"

             Even if those appear in longer messages (e.g. “no that's all”, “I think that’s all”), still respond with "done".

            If the user says “yes”, or says “yes” followed by a question, or simply asks a question, assume they want to continue and respond with "continue".

             Assume any question-like message means they are not done yet.

            Your response must be either "done" or "continue". Nothing else.

            """

        try:
            response = ollama.chat(
                model=self.model,
                messages=[{"role": "system", "content": prompt}]
            )
            resp = response["message"]["content"].strip().lower()
            log(f"should_continue_after_job_explanation → {resp}")
            return resp  # returns "done" or "continue"
        except Exception as e:
            print(f"[ERROR] should_continue_after_job_explanation failed: {e}")
            return "continue"

            
    def explain_job_role_naturally(self):
        log("explain_job_role_naturally")
        prompt = f"""
        You are a friendly and professional interviewer.

        Here's the job title:
        {self.job_title}

        And the job description:
        {self.job_description}

        Write a natural-sounding 2–3 sentence explanation of the role for a candidate.
        Do NOT ask if they have questions — just explain the job clearly.
        """
        try:
            response = ollama.chat(
                model=self.model,
                messages=[{"role": "system", "content": prompt}]
            )
            message = response["message"]["content"].strip()
            print(f"Interview Assistant: {message}")
            self.conversation_history.append({"role": "assistant", "content": message})
            self.job_description_shown = True
        except Exception as e:
            print(f"[ERROR] Job description summary failed: {e}")

       
    # ===== END OF - EXPLAINING JOB DESCRIPTION STAGE AND ITS RELEVANT FUNCTIONS USED =====


    # ===== BEGINING OF - ANSWERING JOB DESCRIPTION QNA STAGE AND ITS RELEVANT FUNCTIONS USED =====
    def handle_answer_job_related_qna_stage(self, user_input):
        log("handle_answer_job_related_qna_stage")

        # Step 1: Handle the initial question passed into the stage
        self.answer_job_related_question(user_input)

        status = self.is_job_qna_finished()
        if status == "done":
            print("Interview Assistant: Thanks for your questions — let's move on.")
            self.job_qna_done = True
            self.stage = "icebreaker" if self.intro_done else "introduction"
            return

        # Step 2: Enter loop for additional questions
        while True:
            print("Interview Assistant: Do you have any other questions about the role?")
            self.conversation_history.append({"role": "assistant", "content": "Do you have any other questions about the role?"})
            
            follow_up = input("Candidate: ").strip()
            self.conversation_history.append({"role": "user", "content": follow_up})

            # ✅ HARD OVERRIDE if candidate clearly says no
            if follow_up.lower() in ["no", "nope", "nothing", "nothing else", "that's all", "i'm good", "i'm clear", "ready to proceed", "let's continue"]:
                print("Interview Assistant: Thanks for your questions — let's move on.")
                self.job_qna_done = True
                self.stage = "icebreaker" if self.intro_done else "introduction"
                break

            self.answer_job_related_question(follow_up)

            status = self.is_job_qna_finished()
            if status == "done":
                print("Interview Assistant: Thanks for your questions — let's move on.")
                self.job_qna_done = True
                self.stage = "icebreaker" if self.intro_done else "introduction"
                break




    def is_job_qna_finished(self):
        log("is_job_qna_finished")
        
        recent_context = json.dumps(self.conversation_history[-4:], indent=2)
        
        prompt = f"""
        You are an AI interview assistant.

        The candidate is currently asking follow-up questions after receiving a job description.

        Your task is to decide if the candidate is done with their questions or still has more.

        Based on this recent part of the conversation:
        {recent_context}

        Reply with:
        - "done" → if they clearly indicate no more questions (e.g. “that’s all”, “nothing else”, “I'm good”)
        - "continue" → if they seem to have more questions or are unsure

        Be cautious: vague replies like “maybe”, “okay”, “not sure”, or new questions = "continue"
        """
        try:
            response = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            result = response["message"]["content"].strip().lower()
            log(f"is_job_qna_finished → {result}")
            return result
        except Exception as e:
            print(f"[ERROR] is_job_qna_finished failed: {e}")
            return "continue"

    def classify_user_followup(self, user_input):
        log("classify_user_followup")

        messages = [{
            "role": "system",
            "content": f"""
    You are an AI interview assistant.

    Your task is to determine whether the candidate's latest message is:
    1. A valid, specific question about the job
    2. A vague or incomplete response that needs encouragement to elaborate

    Here is the candidate’s latest message:
    \"\"\"{user_input}\"\"\"

    Respond with only one word:
    - "question" → if it's a clear job-related question
    - "prompt" → if it’s vague, affirmative, or incomplete and they should be encouraged to go on
    """
        }]

        try:
            response = ollama.chat(model=self.model, messages=messages)
            return response["message"]["content"].strip().lower()
        except Exception as e:
            print(f"[ERROR] classify_user_followup failed: {e}")
            return "prompt"


    def answer_job_related_question(self, user_input):
        log("answer_job_related_question")

        # Step 1: Let the LLM classify and respond naturally
        decision = self.classify_user_followup(user_input)

        if decision.strip().lower() == "prompt":
            # Let LLM generate a natural clarification response
            messages = [{
                "role": "system",
                "content": f"""
                You are an AI interview assistant.

                The candidate just said:
                \"{user_input}\"

                It was a vague or incomplete follow-up. Respond naturally, asking the candidate to clarify or go ahead with their question. Use a tone that is professional, polite, and slightly encouraging. Limit your response to 1–2 short sentences.
                """
            }]

            try:
                response = ollama.chat(model=self.model, messages=messages)
                reply = response["message"]["content"].strip()
                print(f"Interview Assistant: {reply}")
                self.conversation_history.append({"role": "assistant", "content": reply})
                return
            except Exception as e:
                print(f"[ERROR] LLM follow-up prompt failed: {e}")
                print("Interview Assistant: Could you please go ahead with your question?")
                return

        # Step 2: It's a valid question → answer it
        start_index = 0
        for i, message in enumerate(self.conversation_history):
            if self.job_description in message.get("content", ""):
                start_index = i
                break

        recent_conversation = self.conversation_history[start_index:]

        messages = [{
            "role": "system",
            "content": f"""
            You are an AI interview assistant.

            The candidate just asked a follow-up question about the job based on the role description.

            Your task is to answer it clearly and professionally in 1–3 sentences. Do not repeat the job description unless needed. Be concise and relevant.
            """
        }]
        messages.extend(recent_conversation)
        messages.append({"role": "user", "content": user_input})

        try:
            response = ollama.chat(model=self.model, messages=messages)
            reply = response["message"]["content"].strip()
            print(f"Interview Assistant: {reply}")
            self.conversation_history.append({"role": "assistant", "content": reply})
        except Exception as e:
            print(f"[ERROR] answer_job_related_question failed: {e}")
            print("Interview Assistant: Let me get back to that question in a moment.")

                
    # ===== END OF - ANSWERING JOB DESCRIPTION QNA STAGE AND ITS RELEVANT FUNCTIONS USED =====

    
    # ===== BEGINING OF - ICE BREAKER STAGE & ITS RELEVANT FUNCTIONS USED =====

    def handle_icebreaker_stage(self, _):
        log("handle_icebreaker_stage")
        self.icebreaker_retry_count = 0

        while self.icebreaker_retry_count < self.max_icebreaker_retries:
            question = self.generate_icebreaker_question()
            print(f"Interview Assistant: {question}")
            self.conversation_history.append({"role": "assistant", "content": question})

            user_response = input("Candidate: ").strip()
            self.conversation_history.append({"role": "user", "content": user_response})

            decision = self.assess_icebreaker_response(user_response)
            print(f"[DEBUG] Icebreaker judgment: {decision}")

            if decision == "valid":
                print("[DEBUG] Icebreaker accepted. Moving to intro_followup stage.")
                print("Interview Assistant: Thanks for sharing that!")
                self.stage = "intro_followup"
                self.dispatch_stage("")
                return
            else:
                self.icebreaker_retry_count += 1
                

        # After too many retries, move on anyway
        print("[DEBUG] Max icebreaker retries reached. Moving on anyway.")
        self.stage = "intro_followup"
        self.dispatch_stage("")




    def generate_icebreaker_question(self):
        log("generate_icebreaker_question")
        prompt = f"""
                You are an AI interviewer about to begin a conversation with a candidate for the role of {self.job_title}.
                Please generate a short and friendly icebreaker question to ask after the candidate's introduction.
                Keep it simple, human, and non-technical.Ask something off the topic , Not studies related. Avoid deep topics or clichés.
                Only respond with the question.
                """
        try:
            response = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return response['message']['content'].strip()
        except Exception as e:
            print(f"[ERROR] Icebreaker generation failed: {e}")
            return "What's a hobby you enjoy during weekends?"
        
    def assess_icebreaker_response(self, user_response):
        log("assess_icebreaker_response")
        prompt = f"""
        You are an AI interviewer assistant. Assess whether the candidate gave a thoughtful answer to the icebreaker.

        Icebreaker: (assume it was something casual like hobbies or interests)
        Candidate’s answer:
        "{user_response}"

        Respond with:
        - valid → if the response is a real activity, interest, hobby, or personal detail
        - retry → if the response is vague, dismissive, or non-engaging

        IMPORTANT: Only respond with **one word** — either "valid" or "retry". No explanation or commentary.
        """
        try:
            response = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return response['message']['content'].strip().lower().replace('"', '').replace("'", "")
        except Exception as e:
            print(f"[ERROR] Icebreaker assessment failed: {e}")
            return "retry"

    

    # ===== END OF - ICE BREAKER STAGE & ITS RELEVANT FUNCTIONS USED =====


    
    # ===== BEGGINING OF - INTRO FOLLOW-UP STAGE & ITS RELEVANT FUNCTIONS USED =====

    def handle_intro_followup_stage(self, _):
        log("handle_intro_followup_stage")
        self.followup_retry_count = 0

        while self.followup_retry_count < self.max_followup_retries:
            question = self.generate_dynamic_question("")

            print(f"Interview Assistant: {question}")
            self.conversation_history.append({"role": "assistant", "content": question})

            user_input = input("Candidate: ").strip()
            self.conversation_history.append({"role": "user", "content": user_input})

            response_quality = self.assess_followup_response(user_input)
            print(f"[DEBUG] Follow-up answer assessed as: {response_quality}")

            if response_quality == "strong":
                print("[DEBUG] Strong follow-up. Proceeding to resume discussion.")
                break
            else:
                self.followup_retry_count += 1
                if self.followup_retry_count < self.max_followup_retries:
                    print("[DEBUG] Follow-up was weak — trying another question.")

        self.stage = "resume_discussion"
        print("[DEBUG] Moving to resume_discussion stage.")
        self.dispatch_stage("")



    def assess_followup_response(self, user_response):
        log("assess_followup_response")
        prompt = f"""
        You are an AI interviewer.

        Assess the following candidate response for depth and relevance:
        "{user_response}"

        Respond with:
        - "strong" → if it includes clear, relevant detail about motivation, background, experience, or goals
        - "weak" → if it's vague, general, short, or uninformative

        Only reply with "strong" or "weak".
        """
        try:
            response = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return response["message"]["content"].strip().lower()
        except Exception as e:
            print(f"[ERROR] assess_followup_response failed: {e}")
            return "weak"


    def generate_dynamic_question(self, user_response=""):
        log("generate_dynamic_question")
        messages = [
            {"role": "system", "content": f"""
            You are an AI interviewer conducting an interview for the role of {self.job_title}.
            Based on the full conversation so far, suggest a follow-up question to learn more about the candidate's background, experience, or motivation.
            Respond with only the next interview question. Avoid commentary or repetition.
            """},
            *self.conversation_history
        ]
        try:
            response = ollama.chat(model=self.model, messages=messages)
            return response['message']['content'].strip()
        except Exception as e:
            print(f"[ERROR] generate_dynamic_question failed: {e}")
            return "Can you share more about what motivates you professionally?"


    # ===== END OF - INTRO FOLLOW-UP STAGE & ITS RELEVANT FUNCTIONS USED =====

    # ===== BEGINING OF - RESUME CORE QUESTIONS STAGE & ITS RELEVANT FUNCTIONS USED =====
    def handle_resume_discussion_stage(self, _):
        log("handle_resume_discussion_stage")

        if not self.core_questions:
            print("[DEBUG] No more core questions. Moving to custom questions.")
            self.stage = "custom_questions"
            self.dispatch_stage("")
            return

        self.current_question = self.core_questions.pop(0)
        print(f"Interview Assistant: {self.current_question}")
        self.conversation_history.append({"role": "assistant", "content": self.current_question})

        user_input = input("Candidate: ").strip()
        self.conversation_history.append({"role": "user", "content": user_input})

        self.memory["last_resume_reply"] = user_input

        needs_followup = self.should_follow_up(self.current_question, user_input)
        if needs_followup == "yes":
            self.followup_retry_count = 0   
            self.stage = "core_question_followup"
            print("[DEBUG][FLOW] Switching to core_question_followup and exiting resume_discussion")
            self.dispatch_stage("")
            return 
        else:
            evaluation = self.evaluate_response(self.current_question, user_input)
            self.evaluation_log.append({
                "stage": "resume",
                "question": self.current_question,
                "response": user_input,
                "evaluation": evaluation
            })
            self.stage = "resume_discussion"


    
    def should_follow_up(self, question, response):
        log("should_follow_up")
        prompt = f"""
            You are an AI interviewer.

            The candidate was asked:
            "{question}"

            They replied:
            "{response}"

            Determine if a follow-up is needed for deeper understanding.

            Respond with "yes" or "no".
            """
        try:
            result = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return result["message"]["content"].strip().lower()
        except Exception as e:
            print(f"[ERROR] Follow-up decision failed: {e}")
            return "no"

# ===== END OF - RESUME CORE QUESTIONS STAGE & ITS RELEVANT FUNCTIONS USED =====


# ===== BEGINING OF - RESUME CORE QUESTIONS FOLLOW UP STAGE & ITS RELEVANT FUNCTIONS USED =====


    def handle_core_question_followup_stage(self, _):
        log("handle_core_question_followup_stage")

        if self.followup_retry_count >= self.max_followup_retries:
            print("Interview Assistant: That’s okay — let’s move to the next topic.")
            self.evaluation_log.append({
                "stage": "resume_followup",
                "question": self.current_question,
                "response": "[Follow-up limit reached]",
                "evaluation": "no_answer"
            })
            self.stage = "resume_discussion"
            return   # ✅ Exit after dispatch

        followup = self.generate_followup(self.current_question, self.memory["last_resume_reply"])
        print(f"Interview Assistant: {followup}")
        self.conversation_history.append({"role": "assistant", "content": followup})

        user_input = input("Candidate: ").strip()
        self.conversation_history.append({"role": "user", "content": user_input})
        self.memory["last_resume_reply"] = user_input

        evaluation = self.evaluate_resume_qna_response(self.current_question + " (follow-up)", user_input)

        self.evaluation_log.append({
            "stage": "resume_followup",
            "question": followup,
            "response": user_input,
            "evaluation": evaluation
        })

        if evaluation in ["weak", "confused", "no_answer", "off_topic"]:
            self.followup_retry_count += 1

            if evaluation == "off_topic":
                reply = self.handle_offtopic_or_giveup(user_input)
                print(f"Interview Assistant: {reply}")
                return  # ✅ Exit early

            elif self.followup_retry_count == 1 and evaluation in ["weak", "confused"]:
                reply = self.generate_clarification(user_input)
                print(f"Interview Assistant: {reply}")
                return  # ✅ Exit early

            print(f"[DEBUG] Follow-up retry count: {self.followup_retry_count}")
            self.dispatch_stage("")
            return  # ✅ Exit to prevent more unintended input

        # ✅ If the answer was strong enough
        self.followup_retry_count = 0
        self.stage = "resume_discussion"
        return   # ✅ Proper transition and exit
   
    def generate_clarification(self, user_input):
        log("generate_clarification")
        prompt = f"""
            You're an AI interviewer.

            The candidate just responded vaguely:
            "{user_input}"

            Write a **short, polite clarification** question that:
            - Sounds natural and conversational
            - Does NOT mention the word "follow-up"
            - Does NOT explain itself
            - Simply prompts the candidate to clarify or expand their answer

            Examples:
            - "Could you give a quick example?"
            - "What do you mean by that?"
            - "Could you walk me through it?"

            Respond with only the clarifying sentence.
            """
        try:
            response = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return response["message"]["content"].strip()
        except Exception:
            return "Could you share a specific example from your experience?"

    def evaluate_resume_qna_response(self, question, response):
        log("evaluate_resume_qna_response")
        prompt = f"""
        You are an AI interviewer evaluating a candidate's answer to a resume-based technical question.

        Question: "{question}"
        Response: "{response}"

        Classify the response using only ONE of the following:

        - "clear" → well-explained, confident, relevant
        - "weak" → relevant but vague or lacking details
        - "confused" → tries to answer but seems to misunderstand
        - "no_answer" → says "I don't know", "not sure", or clearly expresses lack of knowledge
        - "off_topic" → completely unrelated, joke, or trolling response

        If the response is something like "I don't know", "no idea", "not sure", "that's all", or just "no" — use "no_answer", NOT "off_topic".

        Respond with one word only.
        """

        try:
            result = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return result["message"]["content"].strip().lower()
        except Exception as e:
            print(f"[ERROR] evaluate_resume_qna_response failed: {e}")
            return "confused"


    def handle_offtopic_or_giveup(self, user_input):
        log("handle_offtopic_or_giveup")
        prompt = f"""
        You're an AI interviewer. The candidate said:

        "{user_input}"

        Generate a short response that politely redirects them back to resume discussion.
        """
        try:
            result = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return result["message"]["content"].strip()
        except:
            return "No problem — let’s bring it back to your experience."
    def generate_followup(self, question, last_response):
        log("generate_followup")
        prompt = f"""
            You are an AI interviewer.

            The candidate was asked:
            "{question}"

            Their last reply was:
            "{last_response}"

            Generate a short, smart follow-up to clarify or go deeper.
            Just respond with the question.
            """
        try:
            result = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return result["message"]["content"].strip()
        except Exception as e:
            print(f"[ERROR] Follow-up generation failed: {e}")
            return "Can you explain a bit more?"


# ===== END OF - RESUME CORE QUESTIONS FOLLOW UP STAGE & ITS RELEVANT FUNCTIONS USED =====


# ===== BEGINING OF - CUSTOM QUESTIONS & FUNCTIONS USED =====

    def handle_custom_questions_stage(self, _):
        log("handle_custom_questions_stage")

        if not self.required_questions:
            print("Interview Assistant: That was all from the technical side.")
            self.stage = "candidate_questions"
            self.dispatch_stage("")
            return

        self.current_custom_question = self.required_questions.pop(0)
        print(f"Interview Assistant: {self.current_custom_question}")
        self.conversation_history.append({"role": "assistant", "content": self.current_custom_question})

        user_input = input("Candidate: ").strip()
        self.conversation_history.append({"role": "user", "content": user_input})

        self.memory["last_custom_reply"] = user_input

        decision = self.should_follow_up_custom(self.current_custom_question, user_input)
        if decision == "yes":
            self.custom_followup_retry_count = 0
            self.custom_followup_evaluations = [] 
            self.stage = "custom_question_followup"
        else:
            evaluation = self.evaluate_custom_response(self.current_custom_question, user_input)
            self.evaluation_log.append({
                "stage": "custom",
                "question": self.current_custom_question,
                "response": user_input,
                "evaluation": evaluation
            })
            self.stage = "custom_questions"

        self.dispatch_stage("")

    def evaluate_custom_response(self, question, response):
        log("evaluate_custom_response")
        prompt = f"""
        You are an AI interviewer evaluating a candidate's response to a custom technical or behavioral question.

        Question: "{question}"
        Response: "{response}"

        Classify the response using only ONE of the following:

        - "clear" → well-explained, confident, relevant
        - "weak" → relevant but vague or lacking detail
        - "confused" → seems to misunderstand the question
        - "no_answer" → says "I don't know", "not sure", etc.
        - "off_topic" → unrelated, joke, or trolling

        Only return one word.
        """
        try:
            result = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return result["message"]["content"].strip().lower()
        except Exception as e:
            print(f"[ERROR] evaluate_custom_response failed: {e}")
            return "confused"

    def should_follow_up_custom(self, question, response):
        log("should_follow_up_custom")
        prompt = f"""
        You are an AI interviewer.

        The candidate was asked:
        "{question}"

        They replied:
        "{response}"

        Determine if a follow-up is needed.

        Say "yes" if:
        - The response is vague, generic, short (e.g., "okay", "sure", "I guess", "maybe", "idk", "not sure")
        - The response lacks any explanation or example

        Say "no" only if:
        - The candidate gave a confident and detailed answer

        Respond with "yes" or "no" only.
        """

        try:
            result = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return result["message"]["content"].strip().lower()
        except Exception as e:
            print(f"[ERROR] should_follow_up_custom failed: {e}")
            return "no"

# ===== END OF - CUSTOM QUESTIONS & FUNCTIONS USED =====


# ===== BEGINING OF - CUSTOM QUESTIONS FOLLOW UP STAGE & ITS RELEVANT FUNCTIONS USED =====
    # def handle_custom_question_followup_stage(self, _):
    #     log("handle_custom_question_followup_stage")

    #     if self.custom_followup_retry_count >= self.max_custom_followup_retries:
    #         # Check if all attempts were weak or worse
    #         print(f"[DEBUG] custom_followup_evaluations: {self.custom_followup_evaluations}")
    #         bad_responses = all(e in ["weak", "confused", "no_answer", "off_topic"] for e in self.custom_followup_evaluations)
            
    #         if bad_responses:
    #             correct_answer = self.generate_model_answer(self.current_custom_question)
    #             print(f"Interview Assistant: No worries — let me explain. {correct_answer}")
            
    #         else:
    #             print("Interview Assistant: Thanks for your effort — let’s continue.")
            
    #         self.evaluation_log.append({
    #             "stage": "custom_followup",
    #             "question": self.current_custom_question,
    #             "response": "[Follow-up limit reached]",
    #             "evaluation": "no_answer"
    #         })
    #         self.stage = "custom_questions"
    #         self.dispatch_stage("")
    #         return


    #     followup = self.generate_custom_followup(self.current_custom_question, self.memory["last_custom_reply"])
    #     print(f"Interview Assistant: {followup}")
    #     self.conversation_history.append({"role": "assistant", "content": followup})

    #     user_input = input("Candidate: ").strip()
    #     self.conversation_history.append({"role": "user", "content": user_input})
    #     self.memory["last_custom_reply"] = user_input

    #     evaluation = self.evaluate_custom_response(self.current_custom_question + " (follow-up)", user_input)
    #     self.custom_followup_evaluations.append(evaluation)

    #     self.evaluation_log.append({
    #         "stage": "custom_followup",
    #         "question": followup,
    #         "response": user_input,
    #         "evaluation": evaluation
    #     })


    #     if evaluation in ["weak", "confused", "no_answer", "off_topic"]:
    #         self.custom_followup_retry_count += 1

    #         # Log to verify
    #         print(f"[DEBUG] custom_followup_retry_count: {self.custom_followup_retry_count}")
    #         print(f"[DEBUG] custom_followup_evaluations: {self.custom_followup_evaluations}")

    #         if self.custom_followup_retry_count >= self.max_custom_followup_retries:
    #             bad_responses = all(e in ["weak", "confused", "no_answer", "off_topic"] for e in self.custom_followup_evaluations)

    #             if bad_responses:
    #                 correct_answer = self.generate_model_answer(self.current_custom_question)
    #                 print(f"Interview Assistant: No worries — let me explain. {correct_answer}")
    #             else:
    #                 print("Interview Assistant: Thanks for your effort — let’s continue.")

    #             self.evaluation_log.append({
    #                 "stage": "custom_followup",
    #                 "question": self.current_custom_question,
    #                 "response": "[Follow-up limit reached]",
    #                 "evaluation": "no_answer"
    #             })
    #             self.stage = "custom_questions"
    #             self.dispatch_stage("")
    #             return

    #         if evaluation == "off_topic":
    #             reply = self.handle_custom_offtopic_redirect(user_input)
    #             print(f"Interview Assistant: {reply}")
    #             return

    #         elif self.custom_followup_retry_count == 1:
    #             reply = self.generate_custom_clarification(user_input)
    #             print(f"Interview Assistant: {reply}")
    #             return

    #     else:
    #         self.custom_followup_retry_count = 0

    #     self.stage = "custom_questions"
    #     self.dispatch_stage("")
 
    def handle_custom_question_followup_stage(self, _):
        log("handle_custom_question_followup_stage")

        followup = self.generate_custom_followup(self.current_custom_question, self.memory["last_custom_reply"])
        print(f"Interview Assistant: {followup}")
        self.conversation_history.append({"role": "assistant", "content": followup})

        user_input = input("Candidate: ").strip()
        self.conversation_history.append({"role": "user", "content": user_input})
        self.memory["last_custom_reply"] = user_input

        evaluation = self.evaluate_custom_response(self.current_custom_question + " (follow-up)", user_input)
        self.custom_followup_evaluations.append(evaluation)

        self.evaluation_log.append({
            "stage": "custom_followup",
            "question": followup,
            "response": user_input,
            "evaluation": evaluation
        })

        if evaluation in ["weak", "confused", "no_answer", "off_topic"]:
            self.custom_followup_retry_count += 1

            print(f"[DEBUG] custom_followup_retry_count: {self.custom_followup_retry_count}")
            print(f"[DEBUG] custom_followup_evaluations: {self.custom_followup_evaluations}")

            if self.custom_followup_retry_count >= self.max_custom_followup_retries:
                bad_responses = all(e in ["weak", "confused", "no_answer", "off_topic"] for e in self.custom_followup_evaluations)
                if bad_responses:
                    correct_answer = self.generate_model_answer(self.current_custom_question)
                    print(f"Interview Assistant: No worries — let me explain. {correct_answer}")
                else:
                    print("Interview Assistant: Thanks for your effort — let’s continue.")

                self.evaluation_log.append({
                    "stage": "custom_followup",
                    "question": self.current_custom_question,
                    "response": "[Follow-up limit reached]",
                    "evaluation": "no_answer"
                })

                self.stage = "custom_questions"
                return

            if evaluation == "off_topic":
                reply = self.handle_custom_offtopic_redirect(user_input)
                print(f"Interview Assistant: {reply}")
                return

            elif self.custom_followup_retry_count == 1:
                reply = self.generate_custom_clarification(user_input)
                print(f"Interview Assistant: {reply}")
                return

            # if retry count < max and not off_topic/clarification
            self.stage = "custom_question_followup"
            return

        else:
            # If answer was strong/clear
            self.custom_followup_retry_count = 0
            self.stage = "custom_questions"
            return


    def generate_custom_followup(self, question, last_response):
        log("generate_custom_followup")
        prompt = f"""
        You are an AI interviewer.

        The candidate was asked:
        "{question}"

        Their last response was:
        "{last_response}"

        Write a short follow-up question to go deeper or clarify.
        Just return the follow-up question only.
        """
        try:
            result = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return result["message"]["content"].strip()
        except Exception:
            return "Can you clarify your point with an example?"

    def generate_model_answer(self, question):
        log("generate_model_answer")
        prompt = f"""
            You are a knowledgeable and supportive AI interviewer.

            The candidate struggled to answer this interview question:
            "{question}"

            Please provide a strong model answer that:
            - Clearly explains the key concepts or logic behind the question.
            - Includes a brief example if it's a technical question.
            - Is concise (3–5 sentences) and easy to understand.
            - Sounds like you’re helpfully wrapping up and explaining to the candidate, not just dumping theory.

            End your answer with a tone like: "That’s how you could approach it."
            """
        try:
            response = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return response["message"]["content"].strip()
        except Exception as e:
            print(f"[ERROR] generate_model_answer failed: {e}")
            return "Here's what a strong answer could look like: explain the key concepts, steps, or examples related to this question."

    def generate_custom_clarification(self, user_input):
        log("generate_custom_clarification")
        prompt = f"""
        The candidate just gave a vague response: "{user_input}"

        Write a polite, short follow-up like:
        "Could you elaborate on that?" or
        "Would you like to add an example?"

        Only return the sentence.
        """
        try:
            result = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return result["message"]["content"].strip()
        except Exception:
            return "Would you like to provide more detail?"


    def handle_custom_offtopic_redirect(self, user_input):
        log("handle_custom_offtopic_redirect")
        prompt = f"""
        You're an AI interviewer. The candidate responded with:

        "{user_input}"

        Politely bring the candidate back to the question with a one-liner.
        """
        try:
            result = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return result["message"]["content"].strip()
        except Exception:
            return "Let’s circle back to the question for clarity."

# ===== END OF - CUSTOM QUESTIONS FOLLOW UP STAGE & ITS RELEVANT FUNCTIONS USED =====

# ===== BEGINING OF - END OF INTERVIEW CANDIDATE DOUBT CLARIFICATION STAGE & ITS RELEVANT FUNCTIONS USED =====
    def handle_candidate_questions_stage(self, _):
        log("handle_candidate_questions_stage")
        print("Interview Assistant: Do you have any questions for me before we wrap up?")
        user_input = input("Candidate: ").strip()
        self.conversation_history.append({"role": "user", "content": user_input})

        # check if question is meaningful or just "no"
        if user_input.lower() in ["no", "none", "nope", "nothing", "not really", "i’m good", "no thanks"]:
            print("Interview Assistant: Alright, let’s proceed to the final evaluation.")
            self.stage = "wrapup_evaluation"
            self.dispatch_stage("")
        else:
            self.answered_candidate_questions = True
            reply = self.answer_candidate_query(user_input)
            print(f"Interview Assistant: {reply}")
            self.conversation_history.append({"role": "assistant", "content": reply})

            # You could optionally loop again or just go to evaluation
            print("Interview Assistant: That was a great question. Let’s wrap up.")
            self.stage = "wrapup_evaluation"
            self.dispatch_stage("")

    def answer_candidate_query(self, question):
        log("answer_candidate_query")
        prompt = f"""
        You are a hiring manager being interviewed by a candidate.

        The candidate asked:
        "{question}"

        Respond professionally, clearly, and positively. Limit to 2–3 sentences.
        """
        try:
            result = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return result["message"]["content"].strip()
        except Exception as e:
            print(f"[ERROR] answer_candidate_query failed: {e}")
            return "That’s a thoughtful question — I’ll be happy to answer it in a follow-up."

# ===== END OF - END OF INTERVIEW CANDIDATE DOUBT CLARIFICATION STAGE & ITS RELEVANT FUNCTIONS USED =====

# ===== BEGINING OF - EVALAUATION , EMTIONAL CHECK , RATING CANDIDATE STAGE & ITS RELEVANT FUNCTIONS USED =====

    def evaluate_candidate(self, *_):
        log("evaluate_candidate")
        print("Interview Assistant: Thank you! Let me summarize your interview.\n")

        # Step 1: Analyze all responses in detail
        detailed_log = self.analyze_individual_responses()

        # Step 2: Generate overall summary
        final_summary = self.generate_final_summary_review(detailed_log)

        # Step 3: Print and Save
        print("\nFinal Evaluation:\n" + final_summary)
        self.save_transcript(final_summary, detailed_log)
        print("\nInterview Assistant: This concludes your interview. Goodbye!")



    def analyze_individual_responses(self):
        log("analyze_individual_responses")
        analyzed = []
        for item in self.evaluation_log:
            q = item["question"]
            a = item["response"]

            prompt = f"""
            Evaluate the following interview response:

            Question: "{q}"
            Candidate's Answer: "{a}"

            1. Rate the candidate's depth of knowledge on a scale of 1 to 10.
            2. Detect the emotion/tone conveyed: choose from [confident, nervous, neutral, enthusiastic, unsure, disinterested, evasive].

            Respond in JSON format:
            {{
                "knowledge_rating": x,
                "emotion": "label"
            }}
            """
            try:
                result = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
                parsed = json.loads(result["message"]["content"])
                item["knowledge_rating"] = parsed.get("knowledge_rating", 5)
                item["emotion"] = parsed.get("emotion", "neutral")
                analyzed.append(item)
            except Exception as e:
                print(f"[ERROR] analyze_individual_responses failed: {e}")
                item["knowledge_rating"] = 5
                item["emotion"] = "unknown"
                analyzed.append(item)

        return analyzed

    def generate_final_summary_review(self, analyzed_log):
        log("generate_final_summary_review")

        prompt = f"""
        You are an expert interview evaluator. Based on the following interaction:

        Job Title: {self.job_title}
        
        Here is the full conversation:
        {json.dumps(self.conversation_history, indent=2)}

        And here is the evaluated log:
        {json.dumps(analyzed_log, indent=2)}

        Please write a short 2–3 sentence summary evaluating the candidate's overall fit for this job. Consider:
        - Knowledge and clarity across questions
        - Emotional tone (confidence, nervousness, etc.)
        - Communication effectiveness

        End the summary with a clear tone about whether they are a **strong**, **average**, or **weak** fit.
        """

        try:
            result = ollama.chat(model=self.model, messages=[{"role": "system", "content": prompt}])
            return result["message"]["content"].strip()
        except Exception as e:
            print(f"[ERROR] generate_final_summary_review failed: {e}")
            return "Summary evaluation failed due to an error."


    def save_transcript(self, final_summary="", analyzed_log=None):
        with open("transcript.json", "w") as f:
            json.dump(self.conversation_history, f, indent=2)
        with open("evaluations.json", "w") as f:
            json.dump(analyzed_log or self.evaluation_log, f, indent=2)
        if final_summary:
            with open("final_summary.txt", "w") as f:
                f.write(final_summary)
        print("[INFO] Transcript, evaluations, and summary saved.")


# ===== END OF - EVALAUATION , EMTIONAL CHECK , RATING CANDIDATE STAGE & ITS RELEVANT FUNCTIONS USED =====

# === Run Script ===
if __name__ == "__main__":
    bot = InteractiveInterviewBot(config_path="interview_config.json")
    bot.start_interview()
