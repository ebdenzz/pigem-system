import os
import re
import httpx
from fastapi import Header

class BaseTokenVerifier:

    def is_configured(self) -> bool:
        raise NotImplementedError("Subclasses must implement is_configured().")

    def verify_header(self, authorization: str) -> dict:
        raise NotImplementedError("Subclasses must implement verify_header().")

class SupabaseTokenVerifier(BaseTokenVerifier):

    _BEARER_REGEX = re.compile(r"^Bearer\s+([A-Za-z0-9._\-]+)$", re.IGNORECASE)

    def __init__(self) -> None:
        self._env_path_checked = True

    def _get_credentials(self) -> tuple:
        url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
        key = (os.getenv("SUPABASE_ANON_KEY") or "").strip()
        return url, key

    def is_configured(self) -> bool:
        url, key = self._get_credentials()
        if url and key:
            return True
        return False

    def verify_header(self, authorization: str) -> dict:
        if not self.is_configured():
            return {"demo": True}

        header_text = (authorization or "").strip()
        if not header_text:
            return {"public": True}

        match = self._BEARER_REGEX.match(header_text)
        if match:
            token = match.group(1)
            url, key = self._get_credentials()
            try:
                reply = httpx.get(
                    url + "/auth/v1/user",
                    headers={
                        "apikey": key,
                        "Authorization": "Bearer " + token,
                    },
                    timeout=10,
                )
                if reply.status_code == 200:
                    data = reply.json()
                    if isinstance(data, dict) and data.get("id"):
                        return data
            except Exception:
                pass

        return {"public": True}

_verifier = SupabaseTokenVerifier()

def is_configured() -> bool:
    return _verifier.is_configured()

def require_login(authorization: str = Header(default="")):
    return _verifier.verify_header(authorization)
