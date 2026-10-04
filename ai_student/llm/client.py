import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

# ============================================================
# PROJECT ROOT / ENVIRONMENT
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = PROJECT_ROOT / ".env"

load_dotenv(dotenv_path=ENV_PATH, override=True)


# ============================================================
# OPENAI CONFIGURATION
# ============================================================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not configured.")


base_url = "https://api.openai.com/v1"


# ============================================================
# CLIENT
# ============================================================
#
# Important:
# - timeout prevents one request from hanging too long
# - max_retries=0 disables the SDK's automatic retries
#   because service.py has its own controlled retry logic
#
# OpenAI SDK itself retries some transient failures by default.
# We disable those retries here so we do not accidentally get:
#
# SDK retries + our custom retries
#
# ============================================================

client = OpenAI(
    api_key=OPENAI_API_KEY,
    base_url=base_url,
    timeout=45.0,
    max_retries=0,
)
