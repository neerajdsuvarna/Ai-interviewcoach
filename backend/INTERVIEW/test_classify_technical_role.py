#!/usr/bin/env python3
"""
Simple test script for classify_if_technical_role function.
Just change the job_title and job_description variables below to test different roles.
"""

from Resumeparser import classify_if_technical_role

# ============================================
# CHANGE THESE VALUES TO TEST DIFFERENT ROLES
# ============================================

job_title = "Python Developer "

job_description = """

"""

# ============================================
# TEST THE CLASSIFIER
# ============================================

if __name__ == "__main__":
    print("=" * 60)
    print("Testing Technical Role Classifier")
    print("=" * 60)
    print(f"\nJob Title: {job_title}")
    print(f"\nJob Description:\n{job_description}")
    print("\n" + "-" * 60)
    print("Classifying...")
    print("-" * 60)
    
    try:
        is_technical = classify_if_technical_role(job_title, job_description, model="llama3")
        
        print(f"\n✅ Result: {'TECHNICAL' if is_technical else 'NON-TECHNICAL'}")
        print(f"   Coding questions should be: {'SHOWN' if is_technical else 'HIDDEN'}")
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
