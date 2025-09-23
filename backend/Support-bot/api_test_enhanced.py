from Support_manager_enhanced import SupportBotManager

# Initialize enhanced bot with LLM-based classification
bot = SupportBotManager(model="llama3")

# TEMPORARY: Hardcode your auth token for testing
AUTH_TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vMTI3LjAuMC4xOjU0MzIxL2F1dGgvdjEiLCJzdWIiOiI1ZWRkMWE4MC01OGRjLTQ2MDEtYWM5ZS0wNDQzYjBhOTAwMmUiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzU4MjYzNTcwLCJpYXQiOjE3NTgyNTk5NzAsImVtYWlsIjoibmVlcmFqc0Btb2JhY2suY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6Im5lZXJhanNAbW9iYWNrLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJOZWVyYWogRCBTdXZhcm5hIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI1ZWRkMWE4MC01OGRjLTQ2MDEtYWM5ZS0wNDQzYjBhOTAwMmUifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc1ODE3NDQ2MH1dLCJzZXNzaW9uX2lkIjoiNTdhY2VhMTEtMzliNC00NzQ2LWE5MmMtNGJlOTY2YTFlOGNhIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.ofu7ql59hZL9SgJgRFWVmyOL4dwqBHXulvtTB-TJnl8"
bot.set_auth_token(AUTH_TOKEN)

print("🤖 Enhanced Support Bot with LLM-Based Database Classification")
print("=" * 60)
print("Type your message (type 'exit' to quit)")
print("Note: Auth token is already set for testing")
print("=" * 60)

while True:
    query = input("\nYou: ").strip()
    if query.lower() in ["exit", "quit"]:
        print("Session ended.")
        break
    
    # Special command to set auth token
    if query.startswith("AUTH:"):
        token = query[5:].strip()
        bot.set_auth_token(token)
        print("✅ Auth token set! You can now ask about your payments, interviews, etc.")
        continue

    response = bot.receive_input(query)

    # Debug info
    if "retrieved_sections" in response and response["retrieved_sections"]:
        print(f"[DEBUG] Retrieved FAQ sections: {', '.join(response['retrieved_sections'])}")
    
    print(f"[DEBUG] Has Auth: {response.get('has_auth', False)}")
    print(f'\033[96m🤖 BOT: "{response["message"]}"\033[0m')