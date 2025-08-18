##ollama serve
##ollama pull mistral

import datetime
import requests
from enum import Enum
import os
from dotenv import load_dotenv

# Load .env from the same folder
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))


# Load environment variables
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL")
OLLAMA_MODEL_NAME = os.getenv("OLLAMA_MODEL_NAME")
OLLAMA_TAGS_URL = os.getenv("OLLAMA_TAGS_URL")
OLLAMA_MAX_TOKENS = int(os.getenv("OLLAMA_MAX_TOKENS", "25"))

if not all([OLLAMA_API_URL, OLLAMA_MODEL_NAME, OLLAMA_TAGS_URL]):
    raise EnvironmentError("Missing one or more OLLAMA-related environment variables")


class Status(Enum):
    LIVE = "LIVING"
    DEAD = "DEAD"


class NLPModel:
    API_URL = OLLAMA_API_URL
    model_name = OLLAMA_MODEL_NAME
    max_tokens = OLLAMA_MAX_TOKENS
    OLLAMA_URL = OLLAMA_TAGS_URL

    def __init__(self, name, relationship, status):
        """
        Initialize the NLP model with dynamic values passed from app.py.
        """
        self.name = name
        self.relationship = relationship
        self.status = status
        self.conversation_history = []  #  Store chat history

    def ask_LLM(self, prompt, model=None):
        """
        Queries Ollama and generates a short response based on user input.
        """
        if model is None:
            model = self.model_name

        #  Generate a personalized system message
        system_message = (
            f"You are {self.name}, a {self.status.value} {self.relationship}. "
            "If the user’s message is casual or short, reply concisely. "
            "If it is deep, emotional, or requires advice, respond thoughtfully and at length. "
            "Keep responses natural and human-like, avoiding robotic phrasing."
        )


        data = {
            "model": model,
            "prompt": f"{system_message}\nUser said: {prompt}\n",
            "max_tokens": self.max_tokens,
            "stream": False
        }

        response = requests.post(self.API_URL, json=data)

        if response.status_code == 200:
            reply = response.json().get("response", "No response from model.")
            if len(reply.split()) > self.max_tokens:
                return self.truncate_reply(reply)
            return reply.strip()
        else:
            return f"Error: {response.status_code} - {response.text}"

    def truncate_reply(self, reply, max_words=25):
        """Ensures the response is no longer than max_words."""
        words = reply.split()
        return " ".join(words[:max_words]) + "..." if len(words) > max_words else reply

    def get_answer(self, prompt):
        """
        Processes user input and generates a response while maintaining conversation history.
        """
        if not prompt.strip():
            return "I'm not sure what to say. Can you rephrase?"

        #  Keep last 5 messages for context
        self.conversation_history.append(f"You: {prompt}")
        full_context = "\n".join(self.conversation_history[-5:])

        #  Generate bot response
        bot_reply = self.ask_LLM(full_context)

        #  Store bot response in history
        self.conversation_history.append(f"Bot: {bot_reply}")

        return bot_reply

    def chat(self):
        """
        CLI-based chat method for testing.
        """
        print(" Ollama and model are available! Proceeding with API request.")
        while True:
            user_input = input("You: ")
            if user_input.lower() in ["exit", "quit"]:
                break
            reply = self.get_answer(user_input)
            print(f"{self.name}: {reply}")

if __name__ == "__main__":
    chatbot = NLPModel("Tira", "Father", Status.LIVE)  #  Test with example profile
    chatbot.chat()
