import os
from urllib import error, request
from urllib.parse import quote

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")

# New Supabase secret key, with legacy service-role fallback
SUPABASE_SECRET_KEY = (
    os.getenv("SUPABASE_SECRET_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or ""
)

NOTICE_BUCKET = os.getenv("SUPABASE_NOTICE_BUCKET", "notice-documents")


def _validate_config():
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is not configured.")

    if not SUPABASE_SECRET_KEY:
        raise RuntimeError("SUPABASE_SECRET_KEY is not configured.")


def _storage_object_url(storage_path: str) -> str:
    encoded_bucket = quote(NOTICE_BUCKET, safe="")
    encoded_path = quote(storage_path, safe="/")

    return f"{SUPABASE_URL}/storage/v1/object/" f"{encoded_bucket}/{encoded_path}"


def get_public_notice_url(storage_path: str) -> str:
    encoded_bucket = quote(NOTICE_BUCKET, safe="")
    encoded_path = quote(storage_path, safe="/")

    return (
        f"{SUPABASE_URL}/storage/v1/object/public/" f"{encoded_bucket}/{encoded_path}"
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

    _validate_config()

    url = _storage_object_url(storage_path)

    req = request.Request(
        url,
        data=file_bytes,
        method="POST",
        headers={
            "apikey": SUPABASE_SECRET_KEY,
            "Content-Type": content_type,
            "x-upsert": "false",
        },
    )

    try:
        with request.urlopen(req, timeout=60) as response:
            response.read()

    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")

        raise RuntimeError(
            f"Supabase Storage upload failed " f"({exc.code}): {body}"
        ) from exc

    except error.URLError as exc:
        raise RuntimeError(
            f"Could not connect to Supabase Storage: {exc.reason}"
        ) from exc

    return get_public_notice_url(storage_path)


def download_notice_file(storage_path: str) -> bytes:
    """
    Download a previously uploaded notice from Supabase Storage.
    Used by the background processing worker.
    """

    _validate_config()

    url = _storage_object_url(storage_path)

    req = request.Request(
        url,
        method="GET",
        headers={
            "apikey": SUPABASE_SECRET_KEY,
        },
    )

    try:
        with request.urlopen(req, timeout=60) as response:
            return response.read()

    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")

        raise RuntimeError(
            f"Supabase Storage download failed " f"({exc.code}): {body}"
        ) from exc

    except error.URLError as exc:
        raise RuntimeError(
            f"Could not connect to Supabase Storage: {exc.reason}"
        ) from exc
