import uuid
import time
from Support_functions import load_faq_sections, build_faq_index, generate_support_reply

class SupportBotManager:
    def __init__(self, model="llama3", faq_path="support_bot.md"):
        self.model = model
        self.session_id = str(uuid.uuid4())
        self.conversation_history = []
        self.api_call_count = 0
        self.start_time = time.time()
        
        # Load FAQ sections (dict of {title: content})
        self.faq_sections = load_faq_sections(faq_path)

        # Build FAISS index for semantic retrieval
        build_faq_index(self.faq_sections)

        greeting = "Hello! I’m your support assistant. How can I help you today?"
        self.conversation_history.append({"role": "assistant", "content": greeting})

    def receive_input(self, user_input: str):
        """Process input and return support reply"""
        self.api_call_count += 1
        print(f"[INFO] API call #{self.api_call_count} | Session: {self.session_id}")

        # Store user input
        self.conversation_history.append({"role": "user", "content": user_input})

        # Get reply using retrieval
        reply, retrieved_titles = generate_support_reply(
            self.faq_sections,
            self.conversation_history,
            user_input,
            model=self.model
        )

        # Save reply
        self.conversation_history.append({"role": "assistant", "content": reply})

        return {
            "session_id": self.session_id,
            "message": reply,
            "conversation_length": len(self.conversation_history),
            "retrieved_sections": retrieved_titles
        }
