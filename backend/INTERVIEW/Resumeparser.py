
import argparse
import os
import json
import textract
import ollama
import re
from datetime import datetime
from collections import defaultdict
import csv
from io import StringIO
from textract import process
import PyPDF2
import docx
from colorama import Fore, Style, init
init(autoreset=True)

ENABLE_LOGGING = False
try:
    import tiktoken
except ImportError:
    print("[ERROR] Missing dependency: tiktoken\nRun this: pip install tiktoken")
    exit(1)

if ENABLE_LOGGING and not os.path.exists("logs"):
    os.makedirs("logs")


# === CONFIGURATION ===
RESUME_PATH = "C:\\Users\\neera\\Downloads\\iimjobs_srinivas.pdf"  # <-- Update this
CONFIG_PATH = "E:\\many\\SEPERATE_RESUME\\RESUME\\interview_config.json"
PARSED_RESUME_PATH = "E:\\many\\SEPERATE_RESUME\\RESUME\\parsed_resume.json"

def sanitize_json_string(s):
    # Remove all control characters except newline (\n), tab (\t), carriage return (\r)
    s = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F]', '', s)

    # Fix unescaped newlines (inside strings) that break JSON
    s = s.replace('\r\n', '\\n').replace('\n', '\\n').replace('\r', '\\r')

    # Ensure tabs are escaped properly
    s = s.replace('\t', '\\t')

    return s

def truncate_resume_text(text, max_chars=12000):
    # Truncates the resume text to fit within model context limits
    return text[:max_chars]



def clean_json_like_text(raw_text):
    # Remove JS-style comments
    raw_text = re.sub(r'//.*', '', raw_text)

    # Remove trailing commas before closing braces/brackets
    raw_text = re.sub(r',\s*([\]}])', r'\1', raw_text)

    return raw_text.strip()
# === RESUME PARSING ===
def extract_text_from_resume(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"[ERROR] File not found: {file_path}")
    
    print(f"[INFO] Extracting text from: {file_path}")
    
    try:
        file_ext = file_path.lower().split('.')[-1]
        
        if file_ext == 'pdf':
            # Use PyPDF2 for PDF files (more reliable on Windows)
            return extract_text_from_pdf(file_path)
        elif file_ext in ['docx', 'doc']:
            # Use python-docx for Word documents
            return extract_text_from_docx(file_path)
        else:
            # Fallback to textract for other file types
            return extract_text_from_textract(file_path)
            
    except Exception as e:
        raise RuntimeError(f"[ERROR] Failed to extract text: {e}")

def extract_text_from_pdf(file_path):
    """Extract text from PDF using PyPDF2"""
    try:
        text = ""
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        print(f"[WARNING] PyPDF2 failed: {e}")
        # Fallback to textract
        return extract_text_from_textract(file_path)

def extract_text_from_docx(file_path):
    """Extract text from DOCX using python-docx"""
    try:
        doc = docx.Document(file_path)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text.strip()
    except Exception as e:
        print(f"[WARNING] python-docx failed: {e}")
        # Fallback to textract
        return extract_text_from_textract(file_path)

def extract_text_from_textract(file_path):
    """Fallback method using textract"""
    try:
        text = textract.process(file_path).decode("utf-8", errors="ignore")
        return text
    except Exception as e:
        raise RuntimeError(f"[ERROR] Textract failed: {e}")

def split_resume_into_chunks(text, max_tokens=1500, overlap=200):
    try:
        import tiktoken
    except ImportError:
        raise ImportError("Please install tiktoken: pip install tiktoken")

    enc = tiktoken.get_encoding("cl100k_base")
  # You can use "gpt-3.5-turbo" if llama3 gives error
    tokens = enc.encode(text)
    print(f"[INFO] Resume token count: {len(tokens)}")

    chunks = []
    start = 0

    while start < len(tokens):
        end = min(start + max_tokens, len(tokens))
        chunk = enc.decode(tokens[start:end])
        chunks.append(chunk)
        start += max_tokens - overlap

    return chunks

def ask_ollama_for_structured_data_chunked(resume_text, model="llama3"):
    chunks = split_resume_into_chunks(resume_text)
    merged_result = {
        "full_name": "",
        "email": "",
        "phone": "",
        "location": "",
        "summary": "",
        "skills": [],
        "education": [],
        "work_experience": [],
        "projects": [],
        "certifications": [],
        "tools_and_technologies": {
        "Operating Systems": [],
        "Languages": [],
        "Databases": [],
        "Automation Tools": [],
        "Load Testing": [],
        "Version Control": [],
        "Bug Trackers": []
        },
        "links": {
        "linkedin": "",
        "github": ""
        }

    }
    print(f"[INFO] Total chunks to process: {len(chunks)}")
    for idx, chunk in enumerate(chunks):
        print(f"[INFO] Processing chunk {idx + 1}/{len(chunks)}...")
        prompt = f"""
        You are a strict but intelligent JSON resume parser. Extract **detailed** structured resume data for the following chunk.

        IMPORTANT:
        - Do NOT include explanations.
        - Do NOT return arrays or lists at the top level.
        - Do NOT wrap JSON in markdown (no ```json).
        - Respond with ONE and ONLY ONE valid JSON object.

        Use this format:
        {{
        "full_name": "",
        "email": "",
        "phone": "",
        "location": "",
        "summary": "",  // Write a strong summary if found
        "skills": [],  // Parse technical and soft skills
        "tools_and_technologies": {{
            "Operating Systems": [],
            "Languages": [],
            "Databases": [],
            "Automation Tools": [],
            "Load Testing": [],
            "Version Control": [],
            "Bug Trackers": []
        }},
        "education": [{{"institution": "", "degree": "", "year": "", "percentage": ""}}],
        "work_experience": [{{"title": "", "company": "", "location": "", "from": "", "to": "", "description": ""}}],
        "projects": [{{"name": "", "role": "", "tools": [], "description": ""}}],
        "certifications": [],
        "links": {{
            "linkedin": "",
            "github": ""
            }}
        }}

        Instructions:
        - Include **descriptions** for experience and projects if available.
        - Infer missing data like location or role **only if contextually obvious**.
        - Deduplicate repeated tool variants (e.g., Selenium WebDriver, Selenium).
        - Use consistent formatting for dates and names.

        Resume chunk:
        \"\"\"
        {chunk}
        \"\"\"
        """

        response = try_ollama_chat(prompt, model=model)
        content = response["message"]["content"]
        if ENABLE_LOGGING:
            chunk_log_path = f"logs/chunk_{idx+1}_response.json"
            with open(chunk_log_path, "w", encoding="utf-8") as f:
                f.write(content)
        try:
            partial = json.loads(content)
            # Skip if the chunk returned almost empty JSON
            missing_fields = [key for key in partial if not partial.get(key) and key != "summary"]
            if len(missing_fields) == len(partial) - 1:
                print(f"[WARNING] Chunk {idx+1} returned mostly empty fields: {missing_fields}. Skipping.")
                continue

        except Exception:
            print(f"[WARNING] Chunk {idx+1} failed JSON parse. Trying manual fix.")
            try:
                cleaned = clean_json_like_text(content)
                match = re.search(r'(\{[\s\S]*\})', cleaned)
                if match:
                    partial = json.loads(match.group(1))
                else:
                    continue
            except Exception:
                print(f"[ERROR] Still failed after manual fix. Skipping chunk {idx+1}.")
                if ENABLE_LOGGING:
                    with open("logs/failed_chunks.txt", "a", encoding="utf-8") as f:
                        f.write(f"\n=== CHUNK {idx+1} ===\n{content}\n")
                continue



        # Merge logic (combine lists, fill blanks)
        for key in merged_result:
            if isinstance(merged_result[key], list):
                merged_result[key].extend(item for item in partial.get(key, []) if item not in merged_result[key])
            elif not merged_result[key] and partial.get(key):
                merged_result[key] = partial[key]
            elif key == "summary" and partial.get(key):
                if partial[key] not in merged_result[key]:
                    merged_result[key] += " " + partial[key]
        # Merge links (GitHub/LinkedIn)
        if "links" in partial:
            # Handle case where links might be returned as a list instead of dict
            if isinstance(partial["links"], list):
                print(f"[WARNING] Chunk {idx+1} returned links as list instead of dict: {partial['links']}")
                # Try to extract links from the list if possible
                for link_item in partial["links"]:
                    if isinstance(link_item, str):
                        if "linkedin.com" in link_item.lower() and not merged_result["links"]["linkedin"]:
                            merged_result["links"]["linkedin"] = link_item
                        elif "github.com" in link_item.lower() and not merged_result["links"]["github"]:
                            merged_result["links"]["github"] = link_item
            elif isinstance(partial["links"], dict):
                # Normal case - links is a dictionary
                for platform in ["linkedin", "github"]:
                    if partial["links"].get(platform) and not merged_result["links"].get(platform):
                        merged_result["links"][platform] = partial["links"][platform]
            else:
                print(f"[WARNING] Chunk {idx+1} returned links as unexpected type: {type(partial['links'])}")

        # Special merging for nested tools_and_technologies
        # Normalize known mislabels to match the target schema
        tool_aliases = {
            "Bug Tracking tools": "Bug Trackers",
            "Load testing tools": "Load Testing",
            "Version control": "Version Control",
            "Operating System": "Operating Systems",
            "OS": "Operating Systems",
            "Automation Tool": "Automation Tools"
        }
        if "tools_and_technologies" in partial:
            for tech_key, tech_values in partial["tools_and_technologies"].items():
                normalized_key = tool_aliases.get(tech_key.strip(), tech_key.strip())
                if normalized_key not in merged_result["tools_and_technologies"]:
                    merged_result["tools_and_technologies"][normalized_key] = []
                merged_result["tools_and_technologies"][normalized_key].extend([
                    v for v in tech_values if v not in merged_result["tools_and_technologies"][normalized_key]
                ])

    # Deduplicate fields
    merged_result["skills"] = deduplicate_string_list(merged_result["skills"])
    # simple strings

    # Use custom deduplicator for lists of dictionaries
    for key in ["projects", "certifications", "education", "work_experience"]:
        merged_result[key] = deduplicate_dict_list(merged_result[key])
    # Move email/phone into contact object
    # Normalize title casing and whitespace for job titles and company names
    for exp in merged_result["work_experience"]:
        if "title" in exp and exp["title"]:
            exp["title"] = exp["title"].strip().title()
        if "company" in exp and exp["company"]:
            exp["company"] = exp["company"].strip()

    merged_result["contact"] = {
        "email": merged_result.pop("email", ""),
        "phone": merged_result.pop("phone", "")
    }

    # Rename full_name to name
    if "full_name" in merged_result:
        merged_result["name"] = ' '.join(w.capitalize() for w in merged_result.pop("full_name").split())

    if not merged_result["summary"]:
        summary_prompt = f"Summarize this resume in 2–3 sentences as if you're describing the candidate's professional profile:\n\n{chunks[0]}"
        summary_resp = try_ollama_chat(summary_prompt, model=model)
        merged_result["summary"] = summary_resp["message"]["content"].strip()
    merged_result["education"] = [e for e in merged_result["education"] if isinstance(e, dict) and any(e.values())]
    merged_result["projects"] = [p for p in merged_result["projects"] if isinstance(p, dict) and any(p.values())]

    # Deduplicate entries within each tools_and_technologies category
    for k in merged_result["tools_and_technologies"]:
        merged_result["tools_and_technologies"][k] = deduplicate_string_list(
            merged_result["tools_and_technologies"][k]
        )

    print("[DONE] Completed parsing all chunks.")
    # Fallback: Try regex detection if links are still missing
    if not merged_result["links"]["linkedin"]:
        match = re.search(r'https?://(www\.)?linkedin\.com/in/[a-zA-Z0-9\-_]+', resume_text)
        if match:
            merged_result["links"]["linkedin"] = match.group(0)

    if not merged_result["links"]["github"]:
        match = re.search(r'https?://(www\.)?github\.com/[a-zA-Z0-9\-_]+', resume_text)
        if match:
            merged_result["links"]["github"] = match.group(0)

    return merged_result

def deduplicate_dict_list(lst):
    seen = set()
    deduped = []
    for item in lst:
        key = json.dumps(item, sort_keys=True)
        if key not in seen:
            deduped.append(item)
            seen.add(key)
    return deduped

def save_json_output(data, output_path):
    with open(output_path, "w") as f:
        json.dump(data, f, indent=4)
    print(f"[DONE] Parsed resume saved to: {output_path}")



# === CORE QUESTION GENERATION ===

def extract_json_array(text):
    # Try regex first
    match = re.search(r"\[\s*{.*?}\s*]", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))

    # Fallback method: find first [ and last ]
    start = text.find("[")
    end = text.rfind("]") + 1
    if start != -1 and end != -1:
        json_chunk = text[start:end]
        return json.loads(json_chunk)

    return []


def generate_core_questions(structured_resume, job_title, job_description, beginner_count=2, medium_count=2, hard_count=2, model="llama3"):
    def generate_questions_by_level(level, count, weight, retries=2):
        # Map the level to the correct database constraint values
        level_mapping = {
            'beginner': 'easy',
            'medium': 'medium', 
            'hard': 'hard'
        }
        db_level = level_mapping.get(level, level)
        
        for attempt in range(retries):
            prompt = f"""
        You are an expert AI interviewer preparing questions for a candidate applying for the role of **{job_title}**.

        Job Description:
        {job_description}

        Candidate's Resume (structured JSON):
        {json.dumps(structured_resume, indent=2)}

        Your task:
        Generate {count} unique interview questions with difficulty: "{level}".

        Rules:
        - Each question must be labeled with "difficulty": "{level}" and "weight": {weight}.
        - Only return a pure JSON array of {count} objects.
        - No explanations, no markdown, no text before/after the JSON.

        Format:
        [
        {{
            "question": "...",
            "difficulty": "{level}",
            "weight": {weight}
        }},
        ...
        ]
        """
            try:
                response = try_ollama_chat(prompt.strip(), model=model)
                raw = response["message"]["content"]
                questions = extract_json_array(raw)
                if len(questions) == count:
                    return questions
                else:
                    print(f"[WARNING] Got {len(questions)} {level} questions instead of {count}. Retrying...")
            except Exception as e:
                print(f"[ERROR] Failed to generate {level} questions: {e}")
        print(f"[ERROR] Failed to get valid {level} questions after {retries} attempts.")
        return []

    print("[INFO] Generating core questions by difficulty...")
    beginner_qs = generate_questions_by_level("beginner", beginner_count, 1)
    medium_qs = generate_questions_by_level("medium", medium_count, 3)
    hard_qs = generate_questions_by_level("hard", hard_count, 5)

    print(f"[DEBUG] Beginner: {len(beginner_qs)} | Medium: {len(medium_qs)} | Hard: {len(hard_qs)}")

    return {
        "beginner": beginner_qs,
        "medium": medium_qs,
        "hard": hard_qs
    }

# === CORE QUESTION GENERATION WITH SPLIT INTEGRATED ===

def generate_split_questions(structured_resume, job_title, job_description,
                             beginner_count=2, medium_count=2, hard_count=2,
                             resume_pct=50, jd_pct=50, model="llama3"):
    def generate_questions_by_source(level, count, weight, source, retries=2):
        if count <= 0:
            return []
        """Helper: generate questions from either resume or JD context"""
        for attempt in range(retries):
            if source == "resume":
                context = f"Candidate's Resume (structured JSON):\n{json.dumps(structured_resume, indent=2)}"
            else:  # JD
                context = f"Job Title: {job_title}\nJob Description:\n{job_description}"

            prompt = f"""
            You are an expert AI interviewer preparing questions for a candidate.

            Context Source: {source.upper()}
            {context}

            Task:
            Generate {count} unique interview questions with difficulty: "{level}".

            Rules:
            - Each question must be labeled with "difficulty": "{level}" and "weight": {weight}.
            - Only return a pure JSON array of {count} objects.
            """
            try:
                response = try_ollama_chat(prompt.strip(), model=model)
                raw = response["message"]["content"]
                questions = extract_json_array(raw)
                if len(questions) == count:
                    return questions
                else:
                    print(f"[WARNING] Got {len(questions)} {level}-{source} questions instead of {count}. Retrying...")
            except Exception as e:
                print(f"[ERROR] Failed to generate {level}-{source} questions: {e}")
        return []

    # === Calculate totals ===
    total = beginner_count + medium_count + hard_count
    if total == 0:
        return {"beginner": [], "medium": [], "hard": []}

    resume_total = round(total * resume_pct / 100)
    jd_total = total - resume_total

    print(f"\n{Fore.BLUE}=== SPLIT MODE DEBUG ==={Style.RESET_ALL}")
    print(f"{Fore.CYAN}[REQUESTED]{Style.RESET_ALL} Resume={resume_pct}% ({resume_total}), JD={jd_pct}% ({jd_total})")

    # === Proportional split per difficulty ===
    def distribute(bucket_total, total):
        if bucket_total == 0:
            return (0, 0, 0)
        b = round(bucket_total * (beginner_count / total))
        m = round(bucket_total * (medium_count / total))
        h = round(bucket_total * (hard_count / total))
        # Fix rounding drift
        while b + m + h < bucket_total:
            b += 1
        while b + m + h > bucket_total:
            if b > 0: b -= 1
            elif m > 0: m -= 1
            else: h -= 1
        return (b, m, h)

    resume_dist = list(distribute(resume_total, total))
    jd_dist = list(distribute(jd_total, total))

    print(f"{Fore.CYAN}[BALANCED]{Style.RESET_ALL}")
    print(f"  {Fore.YELLOW}Resume -> Beginner={resume_dist[0]}, Medium={resume_dist[1]}, Hard={resume_dist[2]}{Style.RESET_ALL}")
    print(f"  {Fore.GREEN}JD     -> Beginner={jd_dist[0]}, Medium={jd_dist[1]}, Hard={jd_dist[2]}{Style.RESET_ALL}")
    print(f"{Fore.BLUE}=========================={Style.RESET_ALL}\n")

    # === Generate questions ===
    beginner_qs, medium_qs, hard_qs = [], [], []

    beginner_qs.extend(generate_questions_by_source("beginner", resume_dist[0], 1, "resume"))
    beginner_qs.extend(generate_questions_by_source("beginner", jd_dist[0], 1, "jd"))

    medium_qs.extend(generate_questions_by_source("medium", resume_dist[1], 3, "resume"))
    medium_qs.extend(generate_questions_by_source("medium", jd_dist[1], 3, "jd"))

    hard_qs.extend(generate_questions_by_source("hard", resume_dist[2], 5, "resume"))
    hard_qs.extend(generate_questions_by_source("hard", jd_dist[2], 5, "jd"))

    print(f"[DONE] Final counts -> Beginner: {len(beginner_qs)}, Medium: {len(medium_qs)}, Hard: {len(hard_qs)}")

    return {
        "beginner": beginner_qs,
        "medium": medium_qs,
        "hard": hard_qs
    }

# === END OF CORE QUESTION GENERATION WITH SPLIT INTEGRATED ===



# === CORE QUESTION GENERATION WITH BLEND INTEGRATED ===

def generate_blend_questions(structured_resume, job_title, job_description,
                             beginner_count=2, medium_count=2, hard_count=2,
                             blend_pct_resume=50, blend_pct_jd=50, model="llama3"):
    """
    Generate interview questions where each question blends resume and JD info
    according to given percentages.
    """

    def generate_questions_blend(level, count, weight, retries=2):
        if count <= 0: 
            return []
        level_mapping = {
            'beginner': 'easy',
            'medium': 'medium',
            'hard': 'hard'
        }
        db_level = level_mapping.get(level, level)

        for attempt in range(retries):
            prompt = f"""
            You are an expert AI interviewer preparing questions for a candidate.

            Blend Context:
            - Use {blend_pct_resume}% of the candidate's resume:
            {json.dumps(structured_resume, indent=2)}

            - Use {blend_pct_jd}% of the job description:
            Job Title: {job_title}
            Job Description: {job_description}

            Task:
            Generate {count} unique interview questions with difficulty: "{level}".

            Rules:
            - Each question must naturally combine both resume and JD information.
            - Each question must be labeled with "difficulty": "{level}" and "weight": {weight}.
            - Only return a pure JSON array of {count} objects.
            - No explanations, no markdown, no text before/after the JSON.

            Format:
            [
              {{
                "question": "...",
                "difficulty": "{level}",
                "weight": {weight}
              }},
              ...
            ]
            """
            try:
                response = try_ollama_chat(prompt.strip(), model=model)
                raw = response["message"]["content"]
                questions = extract_json_array(raw)
                if len(questions) == count:
                    return questions
                else:
                    print(f"[WARNING] Got {len(questions)} {level}-blend questions instead of {count}. Retrying...")
            except Exception as e:
                print(f"[ERROR] Failed to generate {level}-blend questions: {e}")
        return []

    print(f"[INFO] Generating blended questions (Resume {blend_pct_resume}% | JD {blend_pct_jd}%)")

    beginner_qs, medium_qs, hard_qs = [], [], []

    if beginner_count > 0:
        beginner_qs = generate_questions_blend("beginner", beginner_count, 1)
    if medium_count > 0:
        medium_qs = generate_questions_blend("medium", medium_count, 3)
    if hard_count > 0:
        hard_qs = generate_questions_blend("hard", hard_count, 5)

    return {
        "beginner": beginner_qs,
        "medium": medium_qs,
        "hard": hard_qs
    }

# === END OF CORE QUESTION GENERATION WITH BLEND INTEGRATED ===


# === CORE QUESTION GENERATION WITH HYBRID INTEGRATED ===

def generate_hybrid_questions(structured_resume, job_title, job_description, 
                              beginner_count=2, medium_count=2, hard_count=2,
                              resume_pct=40, jd_pct=30,
                              blend_pct_resume=50, blend_pct_jd=50, model="llama3"):
    """
    Hybrid mode: 40% blended questions, 60% split (resume vs JD).
    Preserves user-requested beginner/medium/hard counts.
    """

    total = beginner_count + medium_count + hard_count
    if total == 0:
        return {"beginner": [], "medium": [], "hard": []}

    # --- Step 1: Decide blend vs split buckets ---
    blend_total = round(total * 0.4)   # fixed 40% blend
    split_total = total - blend_total  # remaining 60%

    # --- Step 2: Inside split, allocate Resume vs JD ---
    resume_total = round(split_total * (resume_pct / 100))
    jd_total = split_total - resume_total

    print(f"[INFO] Hybrid distribution -> Resume-only: {resume_total}, JD-only: {jd_total}, Blend: {blend_total}")

    # --- Step 3: Per-difficulty distribution ---
    def distribute(bucket_total, total):
        if bucket_total == 0 or total == 0:
            return (0, 0, 0)

        # Proportional allocation
        b = round(bucket_total * (beginner_count / total))
        m = round(bucket_total * (medium_count / total))
        h = round(bucket_total * (hard_count / total))

        # Adjust if rounding wiped everything out
        if b + m + h == 0 and bucket_total > 0:
            b = bucket_total

        # Fix rounding drift
        while b + m + h < bucket_total:
            b += 1
        while b + m + h > bucket_total:
            if b > 0:
                b -= 1
            elif m > 0:
                m -= 1
            else:
                h -= 1

        return (b, m, h)

    resume_dist = list(distribute(resume_total, total))
    jd_dist = list(distribute(jd_total, total))
    blend_dist = list(distribute(blend_total, total))

    print(f"\n{Fore.BLUE}=== DISTRIBUTION DEBUG ==={Style.RESET_ALL}")

    print(f"{Fore.CYAN}[REQUESTED]{Style.RESET_ALL}")
    print(f"  Resume -> {Fore.YELLOW}BEGINNER={resume_total}, MEDIUM=?, HARD=? (pre-split){Style.RESET_ALL}")
    print(f"  JD     -> {Fore.GREEN}BEGINNER={jd_total}, MEDIUM=?, HARD=? (pre-split){Style.RESET_ALL}")
    print(f"  Blend  -> {Fore.MAGENTA}BEGINNER={blend_total}, MEDIUM=?, HARD=? (pre-split){Style.RESET_ALL}")

    # --- Step 3b: Balance across buckets ---
    def rebalance_buckets(resume_dist, jd_dist, blend_dist,
                          beginner_count, medium_count, hard_count):
        totals = [
            resume_dist[0] + jd_dist[0] + blend_dist[0],
            resume_dist[1] + jd_dist[1] + blend_dist[1],
            resume_dist[2] + jd_dist[2] + blend_dist[2]
        ]
        requested = [beginner_count, medium_count, hard_count]

        for _ in range(30):  # safeguard loop
            for i in range(3):
                if totals[i] > requested[i]:
                    for j in range(3):
                        if totals[j] < requested[j]:
                            totals[i] -= 1
                            totals[j] += 1
                            # shift from JD first, then Resume, then Blend
                            if jd_dist[i] > 0:
                                jd_dist[i] -= 1
                                jd_dist[j] += 1
                            elif resume_dist[i] > 0:
                                resume_dist[i] -= 1
                                resume_dist[j] += 1
                            elif blend_dist[i] > 0:
                                blend_dist[i] -= 1
                                blend_dist[j] += 1
                            break
            if totals == requested:
                break

        return resume_dist, jd_dist, blend_dist

    resume_dist, jd_dist, blend_dist = rebalance_buckets(
        resume_dist, jd_dist, blend_dist,
        beginner_count, medium_count, hard_count
    )

    print(f"\n{Fore.CYAN}[BALANCED]{Style.RESET_ALL}")
    print(f"  Resume -> {Fore.YELLOW}BEGINNER={resume_dist[0]}, MEDIUM={resume_dist[1]}, HARD={resume_dist[2]}{Style.RESET_ALL}")
    print(f"  JD     -> {Fore.GREEN}BEGINNER={jd_dist[0]}, MEDIUM={jd_dist[1]}, HARD={jd_dist[2]}{Style.RESET_ALL}")
    print(f"  Blend  -> {Fore.MAGENTA}BEGINNER={blend_dist[0]}, MEDIUM={blend_dist[1]}, HARD={blend_dist[2]}{Style.RESET_ALL}")

    print(f"{Fore.BLUE}==========================\n{Style.RESET_ALL}")

    beginner_qs, medium_qs, hard_qs = [], [], []

    # --- Local helper: Resume-only or JD-only ---
    def generate_from_source(level, count, weight, source):
        if count <= 0:
            return []
        context = (
            f"Candidate's Resume (structured JSON):\n{json.dumps(structured_resume, indent=2)}"
            if source == "resume"
            else f"Job Title: {job_title}\nJob Description:\n{job_description}"
        )
        prompt = f"""
        You are an expert AI interviewer preparing questions for a candidate.

        Context Source: {source.upper()}
        {context}

        Task:
        Generate {count} unique interview questions with difficulty: "{level}".

        Rules:
        - Each question must be labeled with "difficulty": "{level}" and "weight": {weight}.
        - Only return a pure JSON array of {count} objects.
        """
        try:
            response = try_ollama_chat(prompt.strip(), model=model)
            return extract_json_array(response["message"]["content"])
        except Exception as e:
            print(f"[ERROR] Failed to generate {level}-{source} questions: {e}")
            return []

    # --- Local helper: Blended ---
    def generate_blended(level, count, weight):
        if count <= 0:
            return []
        prompt = f"""
        You are an expert AI interviewer preparing questions.

        Blend Context:
        - Use {blend_pct_resume}% of the candidate's resume:
        {json.dumps(structured_resume, indent=2)}

        - Use {blend_pct_jd}% of the job description:
        Job Title: {job_title}
        Job Description: {job_description}

        Task:
        Generate {count} unique interview questions with difficulty "{level}".

        Rules:
        - Each question must combine resume + JD naturally.
        - Each question must be labeled with "difficulty": "{level}", "weight": {weight}.
        - Only return a pure JSON array of {count} objects.
        """
        try:
            response = try_ollama_chat(prompt.strip(), model=model)
            return extract_json_array(response["message"]["content"])
        except Exception as e:
            print(f"[ERROR] Failed to generate {level}-blend questions: {e}")
            return []

    # --- Step 4–6: Generate Questions ---
    beginner_qs.extend(generate_from_source("beginner", resume_dist[0], 1, "resume"))
    medium_qs.extend(generate_from_source("medium", resume_dist[1], 3, "resume"))
    hard_qs.extend(generate_from_source("hard", resume_dist[2], 5, "resume"))

    beginner_qs.extend(generate_from_source("beginner", jd_dist[0], 1, "jd"))
    medium_qs.extend(generate_from_source("medium", jd_dist[1], 3, "jd"))
    hard_qs.extend(generate_from_source("hard", jd_dist[2], 5, "jd"))

    beginner_qs.extend(generate_blended("beginner", blend_dist[0], 1))
    medium_qs.extend(generate_blended("medium", blend_dist[1], 3))
    hard_qs.extend(generate_blended("hard", blend_dist[2], 5))

    # --- Step 7: Guarantee final counts match user input ---
    def trim_or_pad(lst, target, level, weight):
        if len(lst) > target:
            return lst[:target]
        while len(lst) < target:
            new_qs = generate_from_source(level, 1, weight, "jd")
            if not new_qs:
                new_qs = generate_from_source(level, 1, weight, "resume")
            if not new_qs:
                new_qs = generate_blended(level, 1, weight)
            if not new_qs:
                new_qs = [{"question": f"Fallback {level} question", "difficulty": level, "weight": weight}]
            lst.extend(new_qs)
        return lst

    beginner_qs = trim_or_pad(beginner_qs, beginner_count, "beginner", 1)
    medium_qs   = trim_or_pad(medium_qs, medium_count, "medium", 3)
    hard_qs     = trim_or_pad(hard_qs, hard_count, "hard", 5)

    print(f"[DONE] Final counts -> Beginner: {len(beginner_qs)}, Medium: {len(medium_qs)}, Hard: {len(hard_qs)}")

    return {
        "beginner": beginner_qs,
        "medium": medium_qs,
        "hard": hard_qs
    }

# === END OF CORE QUESTION GENERATION WITH HYBRID INTEGRATED ===



# === CORE QUESTION GENERATION WITH ANSWERS INTEGRATED ===

def generate_answers_for_existing_questions(structured_resume, job_title, job_description, questions_csv_path, output_path, model="llama3"):
    if not os.path.exists(questions_csv_path):
        raise FileNotFoundError(f"[ERROR] CSV not found: {questions_csv_path}")

    # FIX: Use the correct output path instead of overwriting the input file
    with open(questions_csv_path, "r", encoding="utf-8") as infile, open(output_path, "w", newline='', encoding="utf-8") as outfile:
        reader = csv.DictReader(infile)
        writer = csv.writer(outfile)
        writer.writerow(["question_id", "question", "level", "strength", "answer"])

        for row in reader:
            if row["strength"]:  # Skip rows that already have answers
                continue
            print(f"[DEBUG] Generating answers for {row['question_id']} [{row['level']}]: {row['question'][:80]}...")        
            for strength in ["weak", "medium", "strong"]:  # These map to beginner, intermediate, expert in read_questions_from_csv
                prompt = f"""
You are an expert interviewer.

Write a {strength} answer to this interview question:

Job Title: {job_title}
Level: {row['level']}
Question: "{row['question']}"

Resume:
{json.dumps(structured_resume, indent=2)}

Job Description:
{job_description}

Only respond with the answer text, no formatting.
"""
                try:
                    response = try_ollama_chat(prompt.strip(), model=model)
                    answer = response["message"]["content"].strip().replace('"', "'")
                    writer.writerow([row["question_id"], row["question"], row["level"], strength, answer])
                    print(f"[DEBUG] ↳ {strength.capitalize()} answer generated.")
                except Exception as e:
                    print(f"[ERROR] Failed generating answer for {row['question_id']} [{strength}]: {e}")
                    print(f"[ERROR] ↳ {strength.capitalize()} answer failed for {row['question_id']}")

    print(f"[DONE] Answers written to: {output_path}")


# === END OF CORE QUESTION GENERATION WITH ANSWERS INTEGRATED ===

#---------------------------------------------------------------------------------------------------------------------------------------------
# JD PARSING
#---------------------------------------------------------------------------------------------------------------------------------------------
def parse_job_description_file(file_path, model="llama3"):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    try:
        full_text = process(file_path).decode("utf-8", errors="ignore")
    except Exception as e:
        raise RuntimeError(f"Text extraction failed: {e}")

    # Token-based chunking
    enc = tiktoken.get_encoding("cl100k_base")
    tokens = enc.encode(full_text)
    max_tokens = 1500
    overlap = 200

    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + max_tokens, len(tokens))
        chunk = enc.decode(tokens[start:end])
        chunks.append(chunk)
        start += max_tokens - overlap

    print(f"[INFO] JD token count: {len(tokens)}; Total Chunks: {len(chunks)}")

    result = {
        "job_title": "",
        "job_description": ""
    }

    for idx, chunk in enumerate(chunks):
        print(f"[INFO] Parsing JD chunk {idx+1}/{len(chunks)}")

        prompt = f"""
        You are an intelligent AI assistant. Extract a structured **job title** and **complete job description summary** from the following job description chunk.

        Job title should be a concise label (e.g., "Product Manager").

        Job description should:
        - Include purpose, responsibilities, required skills, education, tools, and expectations
        - Be written as a clean paragraph (not a list)
        - Include only what's mentioned in the chunk
        - Avoid repetition or vague filler

        Return JSON:
        {{
        "job_title": "...",
        "job_description": "..."
        }}

        Job Description Chunk:
        \"\"\"{chunk}\"\"\"
        """

        try:
            response = try_ollama_chat(prompt.strip(), model=model)
            raw = response["message"]["content"]

            try:
                parsed = json.loads(raw)
            except:
                match = re.search(r'\{[\s\S]*\}', raw)
                if match:
                    parsed = json.loads(match.group(0))
                else:
                    print(f"[WARNING] Skipping chunk {idx+1} due to parse failure.")
                    continue

            # Set job title once (if not yet filled)
            if not result["job_title"] and parsed.get("job_title"):
                result["job_title"] = parsed["job_title"]

            # Append description
            desc = parsed.get("job_description", "").strip()
            if desc and desc not in result["job_description"]:
                result["job_description"] += " " + desc

        except Exception as e:
            print(f"[ERROR] Failed to process chunk {idx+1}: {e}")
            continue

    result["job_description"] = result["job_description"].strip()
    return result

#---------------------------------------------------------------------------------------------------------------------------------------------
# JD PARSING END
#---------------------------------------------------------------------------------------------------------------------------------------------

def try_ollama_chat(prompt, model="llama3", max_retries=2):
    for attempt in range(max_retries):
        try:
            return ollama.chat(model=model, messages=[{"role": "user", "content": prompt}])
        except Exception as e:
            print(f"[WARNING] Ollama attempt {attempt+1} failed: {e}")
    raise RuntimeError("Ollama API failed after multiple attempts.")


def deduplicate_string_list(lst):
    return sorted(list(set(item.strip() for item in lst if isinstance(item, str) and item.strip())))


def save_questions_to_csv(questions_by_level, output_path):
    with open(output_path, "w", newline='', encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["question_id", "question", "level", "strength", "answer"])
        qid_counter = 1
        for level in ["beginner", "medium", "hard"]:
            for q in questions_by_level.get(level, []):
                writer.writerow([f"q{qid_counter}", q["question"], level, "", ""])
                qid_counter += 1
    print(f"[DEBUG] Saving questions. "
          f"Beginner: {len(questions_by_level.get('beginner', []))}, "
          f"Medium: {len(questions_by_level.get('medium', []))}, "
          f"Hard: {len(questions_by_level.get('hard', []))}")
    print(f"[DONE] Questions saved to: {output_path}")


# === MAIN DRIVER ===


class ResumeParseError(Exception):
    pass
def main():
    parser = argparse.ArgumentParser(description="Parse resume and generate core questions")
    parser.add_argument("--resume", required=True, help="Path to the resume file (PDF, DOCX)")
    parser.add_argument("--config", required=True, help="Path to the interview_config.json")
    args = parser.parse_args()

    max_retries = 1000
    for attempt in range(max_retries):
        try:
            print(f"\n[INFO] Attempt {attempt + 1} of {max_retries}")
            # run_resume_pipeline(args.resume, args.config)
            break  # ✅ success
        except ResumeParseError as e:
            print(f"[WARNING] Resume parsing failed: {e}")
            if attempt == max_retries - 1:
                print("[ERROR] Max retries reached. Exiting.")
                raise
            print("[INFO] Retrying from scratch...\n")

# def run_pipeline_from_api(resume_path, job_title, job_description,
#                           question_counts=None, include_answers=True,
#                           split=False, resume_pct=50, jd_pct=50,
#                           max_retries=1000):
#     if question_counts is None:
#         question_counts = {
#             'beginner': 1,
#             'medium': 1, 
#             'hard': 1
#         }
    
#     for attempt in range(max_retries):
#         try:
#             print(f"\n[INFO] API Attempt {attempt + 1} of {max_retries}")
            
#             # Validate inputs
#             if not os.path.exists(resume_path):
#                 raise FileNotFoundError(f"Resume not found: {resume_path}")
            
#             if not job_title or not job_description:
#                 raise ValueError("Job title and description are required")
            
#             print(f"[INFO] Processing resume for: {job_title}")
#             print(f"[INFO] Question counts: {question_counts}")
#             print(f"[INFO] Include answers: {include_answers}")
            
#             # Extract resume text and parse into structured data
#             resume_text = extract_text_from_resume(resume_path)
#             structured_data = ask_ollama_for_structured_data_chunked(resume_text)
            
#             # Validate parsed data
#             if not isinstance(structured_data, dict):
#                 raise ResumeParseError("Resume parsing returned an invalid format.")
            
#             if (
#                 not structured_data.get("work_experience") and
#                 not structured_data.get("projects") and
#                 not structured_data.get("education")
#             ):
#                 raise ResumeParseError("Parsed resume has no usable sections.")
            
#             # Generate candidate name for file naming
#             candidate_name = structured_data.get("name", "candidate").replace(" ", "_")
            
#             # Create temporary output directory
#             import tempfile
#             temp_dir = tempfile.mkdtemp(prefix=f"resume_processing_{candidate_name}_")
            
#             # Generate file paths
#             parsed_resume_path = os.path.join(temp_dir, "parsed_resume.json")
#             questions_path = os.path.join(temp_dir, "questions.csv")
#             qa_path = os.path.join(temp_dir, "interview_output.csv")
            
#             # Save parsed resume
#             save_json_output(structured_data, parsed_resume_path)
            
#             # Generate questions with frontend data
#             core_questions = generate_core_questions(
#                 structured_data, 
#                 job_title, 
#                 job_description,
#                 question_counts.get('beginner', 1),
#                 question_counts.get('medium', 1), 
#                 question_counts.get('hard', 1)
#             )
            
#             # Save questions to CSV
#             save_questions_to_csv(core_questions, questions_path)
            
#             # Generate answers if requested
#             if include_answers:
#                 generate_answers_for_existing_questions(
#                     structured_data, 
#                     job_title, 
#                     job_description,
#                     questions_path, 
#                     qa_path
#                 )
#                 final_csv_path = qa_path
#             else:
#                 print("[INFO] Skipping answer generation as requested.")
#                 final_csv_path = questions_path
            
#             # Read the generated questions for return
#             questions = read_questions_from_csv(final_csv_path)
            
#             return {
#                 "success": True,
#                 "candidate": candidate_name,
#                 "questions": questions,
#                 "questions_count": len(questions),
#                 "parsed_resume": structured_data,
#                 "temp_dir": temp_dir,  # For cleanup if needed
#                 "qa_csv": final_csv_path
#             }
            
#         except Exception as e:
#             print(f"[ERROR] Attempt {attempt + 1} failed: {e}")
#             import traceback
#             traceback.print_exc()
            
#             if attempt == max_retries - 1:
#                 return {
#                     "success": False,
#                     "error": f"Max retries reached: {e}"
#                 }
#             print("[INFO] Retrying...\n")

def run_pipeline_from_api(
    resume_path,
    job_title,
    job_description,
    question_counts={'beginner': 1, 'medium': 1, 'hard': 1},
    include_answers=True,
    split=False,
    resume_pct=50,
    jd_pct=50,
    blend=False,
    blend_pct_resume=50,   # for blend mode: percentage weight of resume context
    blend_pct_jd=50,       # for blend mode: percentage weight of JD context
    max_retries=1000
):

    """
    Run the resume pipeline with data from frontend instead of config file
    
    Args:
        resume_path: Path to resume file
        job_title: Job title from frontend
        job_description: Job description from frontend  
        question_counts: Dict with 'beginner', 'medium', 'hard' counts (default: 1 each)
        include_answers: Whether to generate sample answers (default: True)
        split: Whether to split questions by resume vs JD percentage
        resume_pct, jd_pct: Percentage split when split=True
        max_retries: Number of retry attempts
    """
    
    for attempt in range(max_retries):
        try:
            print(f"\n[INFO] API Attempt {attempt + 1} of {max_retries}")
            
            # Validate inputs
            if not os.path.exists(resume_path):
                raise FileNotFoundError(f"Resume not found: {resume_path}")
            if not job_title or not job_description:
                raise ValueError("Job title and description are required")
            
            print(f"[INFO] Processing resume for: {job_title}")
            print(f"[INFO] Question counts: {question_counts}")
            print(f"[INFO] Include answers: {include_answers}")
            print(f"[INFO] Split mode: {split} (Resume {resume_pct}% | JD {jd_pct}%)")
            
            # Extract resume text and parse into structured data
            resume_text = extract_text_from_resume(resume_path)
            structured_data = ask_ollama_for_structured_data_chunked(resume_text)
            
            # Validate parsed data
            if not isinstance(structured_data, dict):
                raise ResumeParseError("Resume parsing returned an invalid format.")
            if (
                not structured_data.get("work_experience") and
                not structured_data.get("projects") and
                not structured_data.get("education")
            ):
                raise ResumeParseError("Parsed resume has no usable sections.")
            
            # Candidate name for file naming
            candidate_name = structured_data.get("name", "candidate").replace(" ", "_")
            
            # Create temporary output directory
            import tempfile
            temp_dir = tempfile.mkdtemp(prefix=f"resume_processing_{candidate_name}_")
            
            # File paths
            parsed_resume_path = os.path.join(temp_dir, "parsed_resume.json")
            questions_path = os.path.join(temp_dir, "questions.csv")
            qa_path = os.path.join(temp_dir, "interview_output.csv")
            
            # Save parsed resume
            save_json_output(structured_data, parsed_resume_path)
            
            # === Generate questions ===
            if split and blend:
                core_questions = generate_hybrid_questions(
                    structured_data,
                    job_title,
                    job_description,
                    question_counts.get('beginner', 1),
                    question_counts.get('medium', 1),
                    question_counts.get('hard', 1),
                    resume_pct,
                    jd_pct,
                    blend_pct_resume=blend_pct_resume,
                    blend_pct_jd=blend_pct_jd
                )
            elif split:
                core_questions = generate_split_questions(
                    structured_data,
                    job_title,
                    job_description,
                    question_counts.get('beginner', 1),
                    question_counts.get('medium', 1),
                    question_counts.get('hard', 1),
                    resume_pct,
                    jd_pct
                )
            elif blend:
                core_questions = generate_blend_questions(
                    structured_data,
                    job_title,
                    job_description,
                    question_counts.get('beginner', 1),
                    question_counts.get('medium', 1),
                    question_counts.get('hard', 1),
                    blend_pct_resume,
                    blend_pct_jd
                )
            else:
                core_questions = generate_core_questions(
                    structured_data,
                    job_title,
                    job_description,
                    question_counts.get('beginner', 1),
                    question_counts.get('medium', 1),
                    question_counts.get('hard', 1)
                )


            
            # Save questions to CSV
            save_questions_to_csv(core_questions, questions_path)
            
            # Generate answers if requested
            if include_answers:
                generate_answers_for_existing_questions(
                    structured_data,
                    job_title,
                    job_description,
                    questions_path,
                    qa_path
                )
                final_csv_path = qa_path
            else:
                print("[INFO] Skipping answer generation as requested.")
                final_csv_path = questions_path
            
            # Read back questions
            questions = read_questions_from_csv(final_csv_path)
            
            return {
                "success": True,
                "candidate": candidate_name,
                "questions": questions,
                "questions_count": len(questions),
                "parsed_resume": structured_data,
                "temp_dir": temp_dir,
                "qa_csv": final_csv_path
            }
        
        except Exception as e:
            print(f"[ERROR] Attempt {attempt + 1} failed: {e}")
            import traceback; traceback.print_exc()
            
            if attempt == max_retries - 1:
                return {
                    "success": False,
                    "error": f"Max retries reached: {e}"
                }
            print("[INFO] Retrying...\n")


def read_questions_from_csv(csv_file_path):
    """
    Read questions from CSV file and return them in the format expected by the frontend
    This is a simple wrapper to read the existing CSV output
    """
    questions = []
    
    try:
        if not os.path.exists(csv_file_path):
            print(f"[ERROR] CSV file not found: {csv_file_path}")
            return []
            
        with open(csv_file_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                # Map CSV values to database constraint values
                level_mapping = {
                    'beginner': 'easy',
                    'medium': 'medium', 
                    'hard': 'hard'
                }
                
                strength_mapping = {
                    'weak': 'beginner',
                    'medium': 'intermediate',
                    'strong': 'expert'
                }
                
                # Get the mapped values, with fallbacks
                difficulty_category = level_mapping.get(row['level'], 'medium')
                difficulty_experience = strength_mapping.get(row['strength'], 'beginner')
                
                # Debug logging
                print(f"[DEBUG] Mapping CSV values: level='{row['level']}' -> difficulty_category='{difficulty_category}', strength='{row['strength']}' -> difficulty_experience='{difficulty_experience}'")
                
                question_data = {
                    "question_text": row['question'],
                    "difficulty_category": difficulty_category,  # easy, medium, hard
                    "difficulty_experience": difficulty_experience  # beginner, intermediate, expert
                }
                
                # Include answer if available
                if 'answer' in row and row['answer']:
                    question_data["expected_answer"] = row['answer']
                
                questions.append(question_data)
        
        return questions
    except Exception as e:
        print(f"[ERROR] Failed to read questions from CSV: {e}")
        return []


if __name__ == "__main__":
    main()