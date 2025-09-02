from Interview_manager import InterviewManager

# Initialize manager object
manager = InterviewManager(model="llama3")

print("Type your message. Type 'exit' to quit.\n")

while True:
    user_input = input("You: ").strip()
    if user_input.lower() in ["exit", "quit"]:
        print("Session ended.")
        break

    # Simulate API call
    response = manager.receive_input(user_input)

    if response:
        print(f'[DEBUG] Stage: {response["stage"]}')
        print(f'\033[96mBOT: "{response["message"]}"\033[0m')  # Cyan text

# import json
# import sys
# import os

# # Add the current directory to Python path to import Interview_functions
# sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# from Interview_functions import generate_final_summary_review

# def test_complete_evaluation():
#     """Test the complete evaluation process"""
    
#     print("🚀 Testing Complete Evaluation Process")
#     print("=" * 60)
    
#     # Test the comprehensive evaluation function
#     print("\n🔍 Testing Comprehensive Evaluation Generation...")
    
#     try:
#         # Load local transcript.json
#         print("�� Loading transcript.json...")
#         with open("transcript.json", "r") as f:
#             conversation_history = json.load(f)
#         print(f"✅ Loaded transcript with {len(conversation_history)} conversation entries")
        
#         # Load local evaluations.json
#         print("📁 Loading evaluations.json...")
#         with open("evaluations.json", "r") as f:
#             analyzed_log = json.load(f)
#         print(f"✅ Loaded evaluations with {len(analyzed_log)} evaluation entries")
        
#         job_title = "AWS Engineer"
        
#         # Test the comprehensive function
#         evaluation_result = generate_final_summary_review(
#             job_title=job_title,
#             conversation_history=conversation_history,
#             analyzed_log=analyzed_log,
#             model="llama3"
#         )
        
#         print("\n�� EVALUATION RESULTS:")
#         print("=" * 60)
#         print(f"✅ Summary:\n{evaluation_result['summary']}")
#         print("\n" + "=" * 60)
#         print(f"✅ Key Strengths:\n{evaluation_result['key_strengths']}")
#         print("\n" + "=" * 60)
#         print(f"✅ Improvement Areas:\n{evaluation_result['improvement_areas']}")
#         print("=" * 60)
        
#         # Test JSON serialization
#         try:
#             json.dumps(evaluation_result)
#             print("\n✅ Result can be serialized to JSON (ready for database storage)")
#         except Exception as json_error:
#             print(f"\n❌ JSON serialization failed: {json_error}")
        
#         # Create the complete feedback data structure
#         feedback_data = {
#             "summary": evaluation_result['summary'],
#             "key_strengths": evaluation_result['key_strengths'],
#             "improvement_areas": evaluation_result['improvement_areas']
#         }
        
#         print(f"\n📊 Complete feedback data structure:")
#         print(json.dumps(feedback_data, indent=2))
        
#         return evaluation_result
        
#     except Exception as e:
#         print(f"❌ Test failed: {e}")
#         import traceback
#         traceback.print_exc()
#         return None

# if __name__ == "__main__":
#     test_complete_evaluation()