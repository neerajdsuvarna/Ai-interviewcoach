import json
from analyze_performance_trends import analyze_performance_from_feedbacks, print_analysis_results

def main():
    print("\n=== TESTING PERFORMANCE TREND ANALYSIS (LOCAL JSON INPUT) ===\n")

    # Load sample feedback data
    with open("sample_feedbacks.json", "r") as f:
        feedbacks = json.load(f)

    # Run analysis using LLM
    results = analyze_performance_from_feedbacks(
        feedbacks=feedbacks,
        model="llama3"   # You can change this if needed
    )

    # Print the analysis in a readable format
    print_analysis_results(results)

    # Save results to file
    with open("test_output.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print("\n[INFO] Analysis complete — results saved to test_output.json")

if __name__ == "__main__":
    main()
