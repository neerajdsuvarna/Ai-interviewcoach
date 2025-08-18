from Resumeparser import run_pipeline_from_api, parse_job_description_file

# Use your actual paths
resume_path = r"C:\Users\neera\Downloads\anshuljs.pdf"
config_path = r"E:\many\virtual_human_simulation-clerk-auth\INTERVIEW\interview_config.json"
job_description_path = r"E:\many\virtual_human_simulation-clerk-auth\INTERVIEW\job_description.txt"

result = run_pipeline_from_api(resume_path, config_path)
job = parse_job_description_file(job_description_path)

if result["success"]:
    print("[SUCCESS] Resume processed successfully.")
    print(f"Candidate Name: {result['candidate']}")
    print(f"Final Answer CSV Path: {result['csv_path']}")
else:
    print("[ERROR] Failed to process resume.")
    print(f"Reason: {result['error']}")