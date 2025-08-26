import json
import ollama



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


# ===== BEGINING OF - INTRO & EXPLAINING JOB DESCRIPTION IF NECESSARY FUNCTIONS USED =====


def generate_contextual_intro_reply(job_title, job_description, conversation_history, user_input):
    log("generate_contextual_intro_reply")

    prompt = f"""
    You are an AI interviewer conducting a friendly but professional job interview for the role of: {job_title}.

    Here is the job description:
    {job_description}

    Your job is to:
    1. If the candidate is asking about the job role, explain it in a **natural and conversational** way. Don’t say things like “The job description says…” or “According to the posting.” Instead, speak as if you're the interviewer summarizing it in your own words.
    2. If the job has already been explained and the candidate is asking follow-up questions, answer those briefly and clearly.
    3. If they are not asking about the job, assume you're still in the introduction phase. Just ask something simple like “Can you tell me a bit about yourself?” — keep it short and friendly.
    4. If the job Q&A just ended, gently transition back to the introduction.

    Keep the tone warm, natural, and interviewer-like.
    Respond with 1–2 well-formed sentences only — no headings, labels, or formatting.
    Avoid repeating greetings like "welcome" or "nice to meet you."

    Only explain the job role if the candidate **explicitly asks** about the role, their responsibilities, or what the job involves.
    Do NOT mention the job unless they directly request it.

    If you are explaining the job role because they asked about it, append this tag at the end of your reply: [[job_explained]]
    Do NOT say or display this tag. It will be used internally.

    """

    messages = [{"role": "system", "content": prompt}]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_input})

    try:
        response = ollama.chat(model="llama3", messages=messages)
        content = response["message"]["content"].strip()
        job_flag = False
        if "[[job_explained]]" in content:
            job_flag = True
            content = content.replace("[[job_explained]]", "").strip()

        return {"message": content, "job_explained": job_flag}

    except Exception as e:
        print(f"[ERROR] contextual_intro_reply failed: {e}")
        return {"message": "Could you tell me a bit about yourself?", "job_explained": False}


def assess_intro_progress(conversation_history):
    log("assess_intro_progress")
    prompt = f"""
    You are an AI interviewer at the beginning of a job interview. Here's the conversation so far:

    {json.dumps(conversation_history, indent=2)}

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
        model="llama3",
        messages=[{"role": "system", "content": prompt}]
        )
        return response["message"]["content"].strip().lower()

    except Exception as e:
        print(f"[ERROR] assess_intro_progress failed: {e}")
        return "retry"
    



# ===== END OF - INTRO & EXPLAINING JOB DESCRIPTION IF NECESSARY FUNCTIONS USED =====

# ===== BEGINING OF - ICE BREAKER FUNCTIONS USED =====
def assess_icebreaker_response(user_response, question):
    log("assess_icebreaker_response")

    prompt = f"""
        You are an AI interviewer assistant. Determine if the candidate's response is relevant and thoughtful in the context of the following icebreaker question.

        Icebreaker Question: "{question}"
        Candidate’s Answer: "{user_response}"

        A valid response should:
        - Either directly answer the question OR mention a personal activity, habit, or interest that reflects their personality.
        - Even if off-topic, a sincere and relevant personal detail is acceptable.
        - Avoid rejecting responses just because they aren’t directly about the question topic — as long as they show effort and honesty.


        A retry is only needed if:
        - The response is vague, clearly off-topic, dismissive, or non-personal
        - The candidate avoids answering or responds with things like “idk”, “nothing”, “whatever”, or gibberish

        Important: Casual or short answers like “I just go to the gym” or “I like being outside” are still valid.

        Respond strictly with one word:
        - valid
        - retry
        """


    try:
        response = ollama.chat(
        model="llama3",
        messages=[{"role": "system", "content": prompt}]
        )
        raw = response['message']['content']
        return raw.strip().lower().replace('"', '').replace("'", "")
    except Exception as e:
        print(f"[ERROR] Icebreaker assessment failed: {e}")
        return "retry"


def generate_icebreaker_question(job_title):
    log("generate_icebreaker_question")
    prompt = f"""
            You are an AI interviewer about to begin a conversation with a candidate for the role of {job_title}.
            Please generate a short and friendly icebreaker question to ask after the candidate's introduction.
            Keep it simple, human, and non-technical.Ask something off the topic , Not studies related. Avoid deep topics or clichés.
            Only respond with the question.
            """
    try:
        response = ollama.chat(model="llama3", messages=[{"role": "system", "content": prompt}])
        return response['message']['content'].strip()

    except Exception as e:
        print(f"[ERROR] Icebreaker generation failed: {e}")
        return "What's a hobby you enjoy during weekends?"    
        
# ===== END OF - ICE BREAKER FUNCTIONS USED =====
    

# ===== BEGGINING OF - INTRO FOLLOW-UP FUNCTIONS USED =====

def assess_followup_response(question, user_response):
    log("assess_followup_response")

    system_prompt = """
        You are an AI interviewer evaluating a candidate’s answer to a follow-up question.

        - "strong" → thoughtful, expressive, connected to personal experience or values — even if casual or emotional.
        - "weak" → vague, generic, or unclear — only if it lacks relevance or effort.

        Respond with:
        - strong
        - weak
        Only one word.
    """

    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
            {"role": "assistant", "content": user_response}
        ]
        response = ollama.chat(model="llama3", messages=messages)
        result = response["message"]["content"].strip().lower()
        return result if result in ["strong", "weak"] else "strong"
    except Exception as e:
        print(f"[ERROR] assess_followup_response failed: {e}")
        return "strong"



def generate_dynamic_question(job_title, job_description, conversation_history):
    log("generate_dynamic_question")
    messages = [
        {
            "role": "system",
            "content": f"""
            You are an AI interviewer conducting an interview for the role of: {job_title}.

            Job Description:
            {job_description}

            Your goal is to ask a relevant follow-up question to learn more about the candidate’s background, experience, or motivation.

            Use the conversation below to avoid repeating anything and ask something that hasn’t been discussed yet.
            Make the question sound human, natural, and concise — no more than one sentence.
            Avoid asking about technical skills (those come later).

            Only return the question — no explanations, no labels, no intro.
            """
        },
        *conversation_history
    ]

    try:
        response = ollama.chat(model="llama3", messages=messages)
        return response['message']['content'].strip()

    except Exception as e:
        print(f"[ERROR] generate_dynamic_question failed: {e}")
        return "Can you tell me more about your motivation for applying to this role?"


# ===== END OF - INTRO FOLLOW-UP FUNCTIONS USED =====


# ===== BEGGINING OF - RESUME DISCUSSION FUNCTIONS USED =====

def evaluate_resume_response(question, response):
    log("evaluate_resume_response")
    prompt = f"""
    You are an AI interviewer evaluating a candidate's response.

    Question: "{question}"
    Answer: "{response}"

    Label it:
    - strong
    - weak
    - confused
    - off_topic

    Only one word response.
    """
    try:
        res = ollama.chat(model="llama3", messages=[{"role": "system", "content": prompt}])
        return res["message"]["content"].strip().lower()

    except Exception as e:
        print(f"[ERROR] evaluate_resume_response failed: {e}")
        return "confused"

def generate_followup_question(original_question, weak_response):
    log("generate_followup_question")
    prompt = f"""
    You're an AI interviewer. The candidate gave a vague response.

    Original Q: "{original_question}"
    Weak Response: "{weak_response}"

    Generate a polite, specific follow-up question to clarify.
    Only return the follow-up question.
    """
    try:
        res = ollama.chat(model="llama3", messages=[{"role": "system", "content": prompt}])
        return res["message"]["content"].strip()

    except:
        return "Could you elaborate a bit more on that?"

# ===== END OF - RESUME DISCUSSION FUNCTIONS USED =====

# ===== BEGINING OF - FUCNTIONS USED FOR CUSTOM QUESTIONS ====== 

def evaluate_custom_response(question, response):
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
        result = ollama.chat(model="llama3", messages=[{"role": "system", "content": prompt}])
        return result["message"]["content"].strip().lower()

    except Exception as e:
        print(f"[ERROR] evaluate_custom_response failed: {e}")
        return "confused"

def generate_custom_followup(question, last_response):
    log("generate_custom_followup")
    prompt = f"""
    You are an AI interviewer.

    The candidate was asked:
    "{question}"

    Their last response was:
    "{last_response}"

    Write a short follow-up question to go deeper or clarify.
    Focus on understanding the candidate's conceptual grasp of the topic.
    Just return the follow-up question only.
    """
    try:
        result = ollama.chat(model="llama3", messages=[{"role": "system", "content": prompt}])
        return result["message"]["content"].strip()

    except Exception:
        return "Could you clarify your thinking or give an example?"

def generate_model_answer(question):
    log("generate_model_answer")
    prompt = f"""
        You are an AI interviewer.

        The candidate struggled to answer:
        "{question}"

        Give a **short** model answer in 2–3 concise sentences:
        - Clearly explain the key concept.
        - If helpful, include a quick example.
        - End with “That’s how you could approach it.”

        Keep it crisp and under 50 words.
        Only return the answer — no explanation or extra text.
        """
    try:
        result = ollama.chat(model="llama3", messages=[{"role": "system", "content": prompt}])
        return result["message"]["content"].strip()

    except Exception as e:
        print(f"[ERROR] generate_model_answer failed: {e}")
        return "Tuples are immutable; lists are not. Use tuples when values shouldn't change. That’s how you could approach it."

# ===== END OF - FUCNTIONS USED FOR CUSTOM QUESTIONS ====== 

# ===== BEGINING OF - FUCNTIONS USED FOR END OF INTERVIEW CANDIDATE QUESTION====== 

def assess_candidate_has_question(user_input):
    log("assess_candidate_has_question")
    prompt = f"""
    You are an AI interviewer wrapping up an interview.

    The candidate was asked: "Do you have any questions before we wrap up?"

    Their response was:
    "{user_input}"

    Decide if they **want to ask something**.

    Respond with:
    - "yes" → if it sounds like a question or shows interest
    - "no" → if it clearly indicates no question or they're done

    Accept phrases like “no”, “not really”, “I'm good”, etc. as "no". Anything question-like = "yes".
    """
    try:
        result = ollama.chat(model="llama3", messages=[{"role": "system", "content": prompt}])
        return result["message"]["content"].strip().lower()

    except Exception as e:
        print(f"[ERROR] assess_candidate_has_question failed: {e}")
        return "no"

def generate_candidate_qna_response(user_question, conversation_history, evaluation_log, job_title, last_chance=False):
    log("generate_candidate_qna_response")
    prompt = f"""
    You are an AI interviewer wrapping up an interview for the role of **{job_title}**.

    Here’s the candidate’s latest message:
    "{user_question}"

    Conversation so far:
    {json.dumps(conversation_history, indent=2)}

    Candidate's performance log:
    {json.dumps(evaluation_log, indent=2)}

    Instructions:
    1. If they ask about next steps, company, or job → answer helpfully.
    2. If they ask for feedback (e.g., “how did I do?”) → give **brief, constructive** feedback without sounding harsh.
    3. If they ask about YOU or try to reverse-interview → politely deflect and return to your role as interviewer.
    4. If the message is vague (“yes”, “I have one”) → say “Sure, go ahead” or “What’s on your mind?”
    5. If the question is clearly off-topic or not appropriate for a job interview setting,
        politely deflect. This includes:
        - Trivia or definitions (e.g., “What is a tuple?”, “What is a black hole?”)
        - Personal questions directed at you as the interviewer
        - General knowledge or unrelated educational topics
        - Attempts to reverse-interview you

        Respond with one of the following:
        - “Let’s stay focused on the interview — happy to address role-related questions.”
        - “That’s a good topic for another time — let’s keep this relevant to the role today.”
        - “I’d love to keep this focused on your fit for the position, if that’s alright.”


    Tone:
    - Keep your response brief (2–3 sentences max).
    - Be professional, kind, and neutral.
    - Avoid scoring, long lectures, or phrases like “great question” or “thanks for asking.”
    - Never make the candidate feel embarrassed or criticized.
    - Only return the reply — no formatting or labels.
    """


    if last_chance:
        prompt += """
    Important: This may be the candidate's **last question**.
    If the question is valid, end your reply with a warm closing line like:
    “This is probably a good place to wrap up — thanks for your thoughtful questions.”

    But only add that if it makes sense — don’t force it on vague or unclear inputs.
    """

    prompt += """
    Tone:
    - Stay professional, clear, and human-like.
    - Be brief: no more than 3 sentences.
    - Avoid phrases like “great question” or “thanks for asking.”
    - Never act like you’re the one being interviewed.
    - Only return your reply — no formatting, tags, or explanations.
    """


    try:
        result = ollama.chat(model="llama3", messages=[{"role": "system", "content": prompt}])
        return result["message"]["content"].strip()

    except Exception as e:
        print(f"[ERROR] generate_candidate_qna_response failed: {e}")
        return "Please go ahead — I'm happy to answer."



# ===== END OF - FUCNTIONS USED FOR END OF INTERVIEW CANDIDATE QUESTION====== 

# ===== BEGINING OF - FUCNTIONS USED FOR EVALUATING CANDIDATE QUESTION====== 

def analyze_individual_responses(evaluation_log, model="llama3"):
    log("analyze_individual_responses")
    analyzed = []

    for item in evaluation_log:
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
            result = ollama.chat(model=model, messages=[{"role": "system", "content": prompt}])
            response_text = result["message"]["content"].strip()
            
            # Try to extract JSON from the response
            try:
                # First, try to parse the whole response
                parsed = json.loads(response_text)
            except json.JSONDecodeError:
                # If that fails, try to extract JSON from the response
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1
                
                if json_start != -1 and json_end != 0:
                    json_text = response_text[json_start:json_end]
                    parsed = json.loads(json_text)
                else:
                    # If no JSON found, use default values
                    raise Exception("No JSON found in response")
            
            item["knowledge_rating"] = parsed.get("knowledge_rating", 5)
            item["emotion"] = parsed.get("emotion", "neutral")
            
        except Exception as e:
            print(f"[ERROR] analyze_individual_responses failed for question '{q[:50]}...': {e}")
            print(f"[DEBUG] Response text: {response_text if 'response_text' in locals() else 'No response'}")
            item["knowledge_rating"] = 5
            item["emotion"] = "unknown"

        analyzed.append(item)

    return analyzed


def generate_final_summary_review(job_title, conversation_history, analyzed_log, model="llama3"):
    log("generate_final_summary_review")

    # Calculate overall statistics for context
    total_responses = len(analyzed_log)
    if total_responses > 0:
        avg_knowledge_rating = sum(item.get('knowledge_rating', 5) for item in analyzed_log) / total_responses
        weak_responses = sum(1 for item in analyzed_log if item.get('evaluation') in ['weak', 'confused'])
        strong_responses = sum(1 for item in analyzed_log if item.get('evaluation') in ['strong', 'good'])
        nervous_responses = sum(1 for item in analyzed_log if item.get('emotion') == 'nervous')
        unsure_responses = sum(1 for item in analyzed_log if item.get('emotion') == 'unsure')
    else:
        avg_knowledge_rating = 5
        weak_responses = strong_responses = nervous_responses = unsure_responses = 0

    prompt = f"""
    You are an expert interview evaluator. Based on the following interaction, provide a comprehensive evaluation:

    Job Title: {job_title}

    Here is the full conversation:
    {json.dumps(conversation_history, indent=2)}

    And here is the evaluated log:
    {json.dumps(analyzed_log, indent=2)}

    EVALUATION STATISTICS:
    - Total Responses: {total_responses}
    - Average Knowledge Rating: {avg_knowledge_rating:.1f}/10
    - Weak Responses: {weak_responses}
    - Strong Responses: {strong_responses}
    - Nervous Responses: {nervous_responses}
    - Unsure Responses: {unsure_responses}

    Please provide a comprehensive evaluation in JSON format with three sections:

    1. SUMMARY: Write a short 2–3 sentence summary evaluating the candidate's overall fit for this job. Consider:
       - Knowledge and clarity across questions
       - Emotional tone (confidence, nervousness, etc.)
       - Communication effectiveness
       End the summary with a clear tone about whether they are a **strong**, **average**, or **weak** fit.

    2. KEY STRENGTHS: List 6-8 specific strengths the candidate demonstrated during the interview. Focus on:
       - Technical knowledge and skills (mention specific ratings if above 6/10)
       - Communication abilities
       - Problem-solving approach
       - Professional demeanor
       - Relevant experience

    3. IMPROVEMENT AREAS: List 6-8 specific areas where the candidate could improve. Focus on:
       - Technical gaps or weaknesses (mention specific ratings if below 5/10)
       - Communication issues
       - Problem-solving limitations
       - Professional development needs
       - Skill gaps for the role

    Format your response as JSON:
    {{
        "summary": "Your 2-3 sentence summary here...",
        "key_strengths": "1. [Specific strength 1]\\n2. [Specific strength 2]\\n3. [Specific strength 3]",
        "improvement_areas": "1. [Specific area 1]\\n2. [Specific area 2]\\n3. [Specific area 3]",
        "overall_rating": {avg_knowledge_rating:.1f}
    }}

    Be specific, constructive, and relevant to the {job_title} position. Base your analysis on the actual conversation and evaluation data provided.
    """

    try:
        result = ollama.chat(model=model, messages=[{"role": "system", "content": prompt}])
        response_text = result["message"]["content"].strip()
        
        print(f"[DEBUG] AI Response for comprehensive evaluation: {response_text}")
        
        # Try to parse JSON response
        try:
            # First, try to extract JSON from the response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start != -1 and json_end != 0:
                json_text = response_text[json_start:json_end]
                print(f"[DEBUG] Extracted JSON text: {json_text}")
                parsed_response = json.loads(json_text)
                print(f"[DEBUG] Successfully parsed JSON: {parsed_response}")
                
                return {
                    'summary': parsed_response.get('summary', ''),
                    'key_strengths': parsed_response.get('key_strengths', ''),
                    'improvement_areas': parsed_response.get('improvement_areas', ''),
                    'overall_rating': parsed_response.get('overall_rating', avg_knowledge_rating)
                }
            else:
                # If no JSON brackets found, try parsing the whole response
                parsed_response = json.loads(response_text)
                return {
                    'summary': parsed_response.get('summary', ''),
                    'key_strengths': parsed_response.get('key_strengths', ''),
                    'improvement_areas': parsed_response.get('improvement_areas', ''),
                    'overall_rating': parsed_response.get('overall_rating', avg_knowledge_rating)
                }
                
        except json.JSONDecodeError as json_error:
            print(f"[WARNING] JSON parsing failed: {json_error}")
            print(f"[WARNING] Raw response: {response_text}")
            
            # Fallback: Create analysis from evaluation log with proper ratings
            if total_responses > 0:
                # Create summary based on performance
                if avg_knowledge_rating >= 7:
                    summary = f"Based on the evaluated log, this candidate demonstrates strong knowledge and understanding of {job_title} concepts with an average rating of {avg_knowledge_rating:.1f}/10. Their responses show confidence and technical competence. Overall, I would rate this candidate as **strong** fit for the {job_title} position."
                elif avg_knowledge_rating >= 5:
                    summary = f"Based on the evaluated log, this candidate shows mixed performance with an average rating of {avg_knowledge_rating:.1f}/10. They demonstrate some understanding but have areas for improvement. Overall, I would rate this candidate as **average** fit for the {job_title} position."
                else:
                    summary = f"Based on the evaluated log, this candidate appears to be struggling with demonstrating their knowledge and understanding of {job_title} concepts with an average rating of {avg_knowledge_rating:.1f}/10. Their responses consistently indicate a lack of confidence and clarity. Overall, I would rate this candidate as **weak** fit for the {job_title} position."
                
                # Create specific strengths based on actual performance
                key_strengths = []
                if avg_knowledge_rating >= 6:
                    key_strengths.append(f"1. Demonstrated good technical knowledge (Average rating: {avg_knowledge_rating:.1f}/10)")
                if strong_responses > 0:
                    key_strengths.append(f"2. Showed strong responses in {strong_responses} out of {total_responses} questions")
                key_strengths.append("3. Participated actively in the interview process")
                key_strengths.append("4. Maintained professional demeanor throughout")
                
                # Create specific improvement areas based on actual performance
                improvement_areas = []
                if avg_knowledge_rating < 6:
                    improvement_areas.append(f"1. Technical knowledge needs improvement (Current average: {avg_knowledge_rating:.1f}/10)")
                if weak_responses > 0:
                    improvement_areas.append(f"2. Struggled with {weak_responses} out of {total_responses} questions")
                if nervous_responses > 0:
                    improvement_areas.append(f"3. Confidence issues (Nervous in {nervous_responses} responses)")
                if unsure_responses > 0:
                    improvement_areas.append(f"4. Decision-making needs improvement (Unsure in {unsure_responses} responses)")
                improvement_areas.append("5. Communication skills and detailed explanations need enhancement")
            else:
                summary = f"Interview evaluation completed for {job_title} position. Detailed analysis available in transcript and evaluation data."
                key_strengths = ["1. Participated in the interview process"]
                improvement_areas = ["1. Technical knowledge and communication skills need development"]
            
            return {
                'summary': summary,
                'key_strengths': '\n'.join(key_strengths),
                'improvement_areas': '\n'.join(improvement_areas),
                'overall_rating': avg_knowledge_rating
            }
            
    except Exception as e:
        print(f"[ERROR] generate_final_summary_review failed: {e}")
        import traceback
        traceback.print_exc()
        
        # Ultimate fallback
        return {
            'summary': f"Interview evaluation completed for {job_title} position. Detailed analysis available in transcript and evaluation data.",
            'key_strengths': 'Strengths analysis failed due to an error.',
            'improvement_areas': 'Improvement areas analysis failed due to an error.',
            'overall_rating': avg_knowledge_rating
        }


