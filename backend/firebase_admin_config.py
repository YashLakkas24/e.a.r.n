import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials

load_dotenv()

private_key = os.getenv("FIREBASE_PRIVATE_KEY")
project_id = os.getenv("FIREBASE_PROJECT_ID")
client_email = os.getenv("FIREBASE_CLIENT_EMAIL")

if not private_key:
    raise RuntimeError("FIREBASE_PRIVATE_KEY is not set")

if not project_id:
    raise RuntimeError("FIREBASE_PROJECT_ID is not set")

if not client_email:
    raise RuntimeError("FIREBASE_CLIENT_EMAIL is not set")

cred = credentials.Certificate(
    {
        "type": "service_account",
        "project_id": project_id,
        "private_key": private_key.replace("\\n", "\n"),
        "client_email": client_email,
        "token_uri": "https://oauth2.googleapis.com/token",
    }
)

firebase_admin.initialize_app(cred)
