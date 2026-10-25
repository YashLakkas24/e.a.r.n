import os
import numpy as np

from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


EMBEDDING_MODEL = "text-embedding-3-small"


def create_embedding(text: str) -> list[float]:
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=text)

    return response.data[0].embedding


PREFERENCE_NORMALIZATION_MODEL = "gpt-5-nano"


def create_preference_embedding(preferences: str) -> list[list[float]]:
    preferences = preferences.strip()

    if not preferences:
        raise ValueError("Preferences cannot be empty.")

    try:
        response = client.chat.completions.create(
            model=PREFERENCE_NORMALIZATION_MODEL,
            temperature=0,
            max_tokens=300,
            messages=[
                {
                    "role": "system",
                    "content": """
                        You are a student preference expansion engine.

                        The student may mention multiple independent interests in one sentence.

                        Your job is to identify each distinct interest and expand it into
                        related topics, activities, events and opportunities.

                        Return ONE LINE PER DISTINCT INTEREST.

                        Example:

                        Student:
                        "I am interested in football competitions and electronics events."

                        Output:

                        football competitions, football tournaments, football matches,
                        football championships, football events, inter-college football

                        electronics, electronics competitions, electronics events,
                        electronics workshops, electronics projects, embedded systems,
                        circuits

                        Rules:
                            - Preserve the student's actual intent.
                            - Detect multiple independent interests.
                            - Expand each interest moderately.

                            - Only include concepts that are direct semantic equivalents
                              or very close practical forms of the student's stated interest.

                            - Do NOT broaden a general interest into unrelated subfields,
                              career areas, technologies, competitions, or activities unless
                              the student explicitly mentioned them.

                              Examples:

                                    "technical events and workshops"

                                    → technical events, technical workshops, engineering workshops,
                                    technology workshops, technical seminars

                                    NOT:
                                    entrepreneurship, startups, innovation challenges, conferences
                                    
                                    "sports"
                                    → sports, sports events, sports competitions, sports tournaments,
                                    athletic activities
                            - Keep related concepts belonging to the same interest on the same line.
                            - Return exactly ONE line for each distinct interest.
                            - Each line must contain comma-separated related concepts.
                            - NEVER wrap one interest across multiple lines.
                            - Do NOT combine unrelated interests into one line.
                            - Do NOT add unrelated career interests.
                            - Do NOT invent organizations or specific events.
                            - Return ONLY the expanded interest groups.
                            - Maximum 8 interest groups.
                            """,
                },
                {
                    "role": "user",
                    "content": preferences,
                },
            ],
        )

        normalized = (response.choices[0].message.content or "").strip()

        if not normalized:
            normalized = preferences

        print("\n========== PREFERENCE DEBUG ==========")
        print("RAW:", preferences)
        print("NORMALIZED:")
        print(normalized)
        print("=====================================\n")

    except Exception as e:
        print(f"Preference normalization failed: {e}")
        normalized = preferences

    # ---------------------------------------------
    # Create one embedding per independent interest
    # ---------------------------------------------

    groups = [line.strip() for line in normalized.splitlines() if line.strip()]

    if not groups:
        groups = [preferences]

    print("=== PREFERENCE GROUPS ===")
    for i, group in enumerate(groups[:8]):
        print(f"{i + 1}: {group}")

    embeddings = []

    for group in groups[:8]:

        # embedding_text = group

        embeddings.append(create_embedding(group))

    return embeddings


def cosine_similarity(vector_a: list[float], vector_b: list[float]) -> float:
    a = np.array(vector_a)
    b = np.array(vector_b)

    denominator = np.linalg.norm(a) * np.linalg.norm(b)

    if denominator == 0:
        return 0.0

    return float(np.dot(a, b) / denominator)
