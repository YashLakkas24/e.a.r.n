import os
from urllib.parse import quote

from supabase import create_client, Client


SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")
NOTICE_BUCKET = os.getenv("SUPABASE_NOTICE_BUCKET", "notice-documents")


def _validate_config():
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is not configured.")

    if not SUPABASE_SECRET_KEY:
        raise RuntimeError("SUPABASE_SECRET_KEY is not configured.")


def _get_supabase_client() -> Client:
    _validate_config()
    return create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)


def get_public_notice_url(storage_path: str) -> str:
    encoded_bucket = quote(NOTICE_BUCKET, safe="")
    encoded_path = quote(storage_path, safe="/")

    return (
        f"{SUPABASE_URL}/storage/v1/object/public/"
        f"{encoded_bucket}/{encoded_path}"
    )


def upload_notice_file(
    file_bytes: bytes,
    storage_path: str,
    content_type: str,
) -> str:
    """
    Upload a notice document to Supabase Storage.

    Returns the public URL of the uploaded document.
    """

    supabase = _get_supabase_client()

    try:
        supabase.storage.from_(NOTICE_BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={
                "content-type": content_type,
                "upsert": False,
            },
        )

    except Exception as exc:
        raise RuntimeError(
            f"Supabase Storage upload failed: {exc}"
        ) from exc

    return get_public_notice_url(storage_path)


def download_notice_file(storage_path: str) -> bytes:
    """
    Download a previously uploaded notice from Supabase Storage.
    Used by the background processing worker.
    """

    supabase = _get_supabase_client()

    try:
        return supabase.storage.from_(NOTICE_BUCKET).download(storage_path)

    except Exception as exc:
        raise RuntimeError(
            f"Supabase Storage download failed: {exc}"
        ) from exc
