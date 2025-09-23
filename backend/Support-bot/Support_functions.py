import ollama
from collections import defaultdict
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

# -------------------------------
# Embedding Model + FAISS Globals
# -------------------------------
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
faq_index = None
faq_titles = []
faq_contents = []

# -------------------------------
# FAQ Parsing
# -------------------------------
def load_faq_sections(faq_path="support_bot.md"):
    """
    Parse the FAQ markdown file into a dictionary of {title: content}.
    Splits by '## ' headers.
    """
    sections = defaultdict(str)
    current_title = None

    with open(faq_path, "r", encoding="utf-8") as f:
        for line in f:
            # Detect section titles (## ...)
            if line.startswith("## "):
                current_title = line.strip("# \n")
                sections[current_title] = ""
            elif current_title:
                sections[current_title] += line

    return dict(sections)

# -------------------------------
# Build FAISS Index
# -------------------------------
def build_faq_index(faq_sections):
    """
    Build FAISS index from FAQ sections.
    """
    global faq_index, faq_titles, faq_contents

    faq_titles = list(faq_sections.keys())
    faq_contents = list(faq_sections.values())

    # Encode all FAQ texts (title + content)
    corpus_embeddings = embedding_model.encode(
        [title + " " + content for title, content in faq_sections.items()],
        convert_to_numpy=True,
        normalize_embeddings=True
    )

    # Create FAISS index
    dim = corpus_embeddings.shape[1]
    faq_index = faiss.IndexFlatIP(dim)  # cosine similarity via inner product
    faq_index.add(corpus_embeddings)

# -------------------------------
# Retriever
# -------------------------------
def find_relevant_sections(query, top_k=2):
    """
    Retrieve most relevant FAQ sections using embeddings + FAISS.
    """
    if faq_index is None:
        raise ValueError("FAQ index not built. Call build_faq_index first.")

    # Encode query
    query_embedding = embedding_model.encode([query], convert_to_numpy=True, normalize_embeddings=True)

    # Search FAISS
    distances, indices = faq_index.search(query_embedding, top_k)

    results = []
    for idx in indices[0]:
        if 0 <= idx < len(faq_titles):
            results.append((faq_titles[idx], faq_contents[idx]))
    return results

# -------------------------------
# Generate Reply
# -------------------------------
def generate_support_reply(faq_sections, conversation_history, user_input, model="llama3"):
    """
    Generate a contextual support reply using *retrieved FAQ sections* + conversation history.
    """
    # Retrieve top relevant sections
    relevant_sections = find_relevant_sections(user_input, top_k=2)

    if relevant_sections:
        context_text = "\n\n".join([f"### {title}\n{content}" for title, content in relevant_sections])
    else:
        context_text = "No relevant FAQ section found."

    system_prompt = f"""
    You are a helpful support assistant for the AI Interview Coach platform.
    Use ONLY the following FAQ sections to guide your answers:

    {context_text}

    Instructions:
    - Always answer based on this FAQ when possible.
    - Provide answers in a short and concise style (3–5 bullet points or steps max).
    - Avoid copying full paragraphs — summarize instead.
    - If the query is unrelated, politely say you can only help with support topics.
    """


    messages = [{"role": "system", "content": system_prompt}] + conversation_history
    messages.append({"role": "user", "content": user_input})

    try:
        response = ollama.chat(model=model, messages=messages)
        return response["message"]["content"].strip(), [title for title, _ in relevant_sections]
    except Exception as e:
        print(f"[ERROR] generate_support_reply failed: {e}")
        return "Sorry, I encountered an error. Please try again.", []
