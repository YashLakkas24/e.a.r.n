import os

from strands import Agent, tool
from dotenv import load_dotenv
from strands.models import OpenAIModel

from agents.prompts import NOTICE_SYSTEM_PROMPT
from schemas import NoticeMetadata

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not configured.")


model = OpenAIModel(
    client_args={
        "api_key": OPENAI_API_KEY,
    },
    model_id="gpt-5-nano",
    params={
        "temperature": 0.1,
        "max_tokens": 1200,
    },
)

notice_agent = Agent(
    model=model,
    system_prompt=NOTICE_SYSTEM_PROMPT,
)


def process_new_notice(raw_text: str) -> NoticeMetadata:

    if not raw_text or not raw_text.strip():
        raise ValueError("Notice text cannot be empty.")

    result = notice_agent(
        f"""
        Analyze the following college notice.

        RAW NOTICE:
        ----------------
        {raw_text}
        ----------------

        Extract all available information according to the NoticeMetadata schema.
        Do not invent missing information.
""",
        structured_output_model=NoticeMetadata,
    )
    return result.structured_output
