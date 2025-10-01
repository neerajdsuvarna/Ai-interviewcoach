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

# from Resumeparser import run_pipeline_from_api, parse_job_description_file

# # Use your actual paths
# resume_path = r"C:\Users\neera\Downloads\anshuljs.pdf"
# job_description_path = r"C:\Users\neera\Downloads\Job Title- Elasticsearch senior engineer.docx"

# # Parse job description
# job = parse_job_description_file(job_description_path)

# # Define how many questions you want
# question_counts = {
#     'beginner': 2,
#     'medium': 2,
#     'hard': 2
# }

# # Run pipeline with split enabled (e.g., 60% resume, 40% JD)
# result = run_pipeline_from_api(
#     resume_path=resume_path,
#     job_title=job["job_title"],
#     job_description=job["job_description"],
#     question_counts=question_counts,
#     include_answers=True,
#     split=True,        # toggle ON the split mode
#     resume_pct=60,     # 60% resume-based
#     jd_pct=40          # 40% JD-based
# )

# if result["success"]:
#     print("[SUCCESS] Resume processed successfully.")
#     print(f"Candidate Name: {result['candidate']}")
#     print(f"Questions Generated: {result['questions_count']}")
#     print(f"Final CSV Path: {result['qa_csv']}")
# else:
#     print("[ERROR] Failed to process resume.")
#     print(f"Reason: {result['error']}")

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
