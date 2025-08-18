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
