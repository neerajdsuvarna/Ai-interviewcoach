# from Resumeparser import run_pipeline_from_api, parse_job_description_file

# # Use your actual paths
# resume_path = r"C:\Users\neera\Downloads\anshuljs.pdf"
# config_path = r"E:\many\virtual_human_simulation-clerk-auth\INTERVIEW\interview_config.json"
# job_description_path = r"E:\many\virtual_human_simulation-clerk-auth\INTERVIEW\job_description.txt"

# result = run_pipeline_from_api(resume_path, config_path)
# job = parse_job_description_file(job_description_path)

# if result["success"]:
#     print("[SUCCESS] Resume processed successfully.")
#     print(f"Candidate Name: {result['candidate']}")
#     print(f"Final Answer CSV Path: {result['csv_path']}")
# else:
#     print("[ERROR] Failed to process resume.")
#     print(f"Reason: {result['error']}")

from Resumeparser import run_pipeline_from_api, parse_job_description_file

# Use your actual paths
resume_path = r"C:\Users\Likhith-Moback\Downloads\YashRamani_Resume.pdf"
job_description_path = r"C:\Users\Likhith-Moback\Downloads\Job D - Fullstack.docx"

# Parse job description
job = parse_job_description_file(job_description_path)

# Define how many questions you want
question_counts = {
    'beginner': 1,
    'medium': 1,
    'hard': 1
}

# Run pipeline with split enabled (e.g., 60% resume, 40% JD)
result = run_pipeline_from_api(
    resume_path=resume_path,
    job_title=job["job_title"],
    job_description=job["job_description"],
    question_counts=question_counts,
    include_answers=True,
    split=True,        # toggle ON the split mode
    resume_pct=50,     # 60% resume-based
    jd_pct=50          # 40% JD-based
)

if result["success"]:
    print("[SUCCESS] Resume processed successfully.")
    print(f"Candidate Name: {result['candidate']}")
    print(f"Questions Generated: {result['questions_count']}")
    print(f"Original CSV Path: {result['qa_csv']}")
    
    # ✅ NEW: Copy CSV to current directory
    import shutil
    import os
    from datetime import datetime
    
    # Create filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    local_csv_name = f"interview_questions_{result['candidate']}_{timestamp}.csv"
    
    # Copy the CSV file to current directory
    try:
        shutil.copy2(result['qa_csv'], local_csv_name)
        print(f"✅ CSV saved to current directory: {os.path.abspath(local_csv_name)}")
    except Exception as e:
        print(f"❌ Failed to copy CSV to current directory: {e}")
        print(f"Original file location: {result['qa_csv']}")
    
    # ✅ NEW: Show coding detection results
    print("\n=== CODING DETECTION RESULTS ===")
    coding_questions = [q for q in result['questions'] if q.get('requires_code', False)]
    print(f"Total Questions: {len(result['questions'])}")
    print(f"Coding Questions Found: {len(coding_questions)}")
    
    for i, q in enumerate(coding_questions, 1):
        print(f"{i}. Question: {q['question_text'][:60]}...")
        print(f"   Language: {q.get('code_language', 'Unknown')}")
        print(f"   Difficulty: {q.get('difficulty_category', 'Unknown')}")
        print()
else:
    print("[ERROR] Failed to process resume.")
    print(f"Reason: {result['error']}")

# from Resumeparser import run_pipeline_from_api, parse_job_description_file

# # Use your actual paths
# resume_path = r"C:\Users\neera\Downloads\anshuljs.pdf"
# job_description_path = r"C:\Users\neera\Downloads\Job Title- Elasticsearch senior engineer.docx"

# # Parse job description
# job = parse_job_description_file(job_description_path)

# # Define how many questions you want
# question_counts = {
#     'beginner': 1,
#     'medium': 1,
#     'hard': 1
# }

# # === BLEND MODE TEST ===
# print("\n===== TEST: BLEND MODE (70% Resume / 30% JD) =====")
# result_blend = run_pipeline_from_api(
#     resume_path=resume_path,
#     job_title=job["job_title"],
#     job_description=job["job_description"],
#     question_counts=question_counts,
#     include_answers=True,
#     split=False,          # ensure split is OFF
#     blend=True,           # enable blend
#     blend_pct_resume=70,  # 70% resume
#     blend_pct_jd=30       # 30% JD
# )

# if result_blend["success"]:
#     print(f"[BLEND] Candidate: {result_blend['candidate']}")
#     print(f"[BLEND] Questions Generated: {result_blend['questions_count']}")
#     print(f"[BLEND] Final CSV Path: {result_blend['qa_csv']}")
# else:
#     print(f"[BLEND] Error: {result_blend['error']}")


# from Resumeparser import run_pipeline_from_api, parse_job_description_file

# # Use your actual paths
# resume_path = r"C:\Users\neera\Downloads\anshuljs.pdf"
# job_description_path = r"C:\Users\neera\Downloads\Job Title- Elasticsearch senior engineer.docx"

# # Parse job description
# job = parse_job_description_file(job_description_path)

# # Define how many questions you want
# question_counts = {
#     'beginner': 3,
#     'medium': 5,
#     'hard': 2
# }

# # === HYBRID MODE TEST ===
 
# result_hybrid = run_pipeline_from_api(
#     resume_path=resume_path,
#     job_title=job["job_title"],
#     job_description=job["job_description"],
#     question_counts=question_counts,
#     include_answers=True,
#     split=True,          # required for hybrid
#     blend=True,          # required for hybrid
#     resume_pct=26,       # 40% resume-only
#     jd_pct=74,           # 30% JD-only
#     blend_pct_resume=75, # when blending, use 50% resume
#     blend_pct_jd=25      # when blending, use 50% JD
# )

# if result_hybrid["success"]:
#     print(f"[HYBRID] Candidate: {result_hybrid['candidate']}")
#     print(f"[HYBRID] Questions Generated: {result_hybrid['questions_count']}")
#     print(f"[HYBRID] Final CSV Path: {result_hybrid['qa_csv']}")
# else:
#     print(f"[HYBRID] Error: {result_hybrid['error']}")
