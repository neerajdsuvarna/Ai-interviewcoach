from Support_manager import SupportBotManager

# Initialize bot
bot = SupportBotManager(model="llama3")

print("Type your message (type 'exit' to quit)\n")

while True:
    query = input("You: ").strip()
    if query.lower() in ["exit", "quit"]:
        print("Session ended.")
        break

    response = bot.receive_input(query)

    # Debug info: show which sections were retrieved (if available)
    if "retrieved_sections" in response:
        print(f"[DEBUG] Retrieved sections: {', '.join(response['retrieved_sections'])}")

    print(f'\033[96mBOT: "{response["message"]}"\033[0m')
