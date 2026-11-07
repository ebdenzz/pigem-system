"""
================================================================================
FILE: api/_auth.py
PURPOSE:
  Authentication and Anti-Bot Security Module for the Cloud FastAPI Backend.
  Demonstrates Object-Oriented Programming (Abstraction, Inheritance, and
  Encapsulation) together with Regular Expressions:
    - BaseTokenVerifier     : Abstract parent class defining the auth contract.
    - SupabaseTokenVerifier : Concrete child class verifying Supabase Bearer JWT
                              tokens and Google reCAPTCHA v2 checkbox tokens.
================================================================================
"""

# ------------------------------------------------------------------------------
# IMPORTS EXPLANATION (Why each library is imported in the cloud):
# ------------------------------------------------------------------------------
# `getenv` (from Python's standard `os` library) reads the Cloud Environment
# Variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RECAPTCHA_SECRET_KEY`) that
# you saved in the Vercel Project Settings dashboard—no secrets are hardcoded.
from os import getenv

# `re` (Regular Expressions) validates that an incoming HTTP `Authorization`
# header strictly follows the `Bearer <jwt_token>` format before calling Supabase.
import re

# `httpx` performs secure HTTPS calls from Vercel's cloud container to Supabase
# Auth (`/auth/v1/user`) and Google's reCAPTCHA `siteverify` server.
import httpx

# `Header` (from FastAPI) extracts the `Authorization` HTTP header sent by the
# browser on API requests.
from fastapi import Header


# ------------------------------------------------------------------------------
# ABSTRACT PARENT CLASS (OOP Abstraction)
# ------------------------------------------------------------------------------
class BaseTokenVerifier:
    """
    Abstract base class defining the required methods for any token verifier.
    Subclasses must override `is_configured()` and `verify_header()`.
    """

    def is_configured(self) -> bool:
        """Returns True if cloud authentication credentials are present."""
        raise NotImplementedError("Subclasses must implement is_configured().")

    def verify_header(self, authorization: str) -> dict:
        """Validates an HTTP Authorization header and returns user context."""
        raise NotImplementedError("Subclasses must implement verify_header().")


# ------------------------------------------------------------------------------
# CONCRETE CHILD CLASS (OOP Inheritance & Encapsulation)
# ------------------------------------------------------------------------------
class SupabaseTokenVerifier(BaseTokenVerifier):
    """
    Concrete verifier that validates Supabase JWT session tokens and Google
    reCAPTCHA v2 tokens using cloud environment variables.
    """

    # Private compiled Regular Expression matching `Bearer <JWT>` headers safely
    _BEARER_REGEX = re.compile(r"^Bearer\s+([A-Za-z0-9._\-]+)$", re.IGNORECASE)

    def _get_credentials(self) -> tuple:
        """
        Private helper (Encapsulation) reading `SUPABASE_URL` and
        `SUPABASE_ANON_KEY` from Vercel Cloud Environment Variables.
        """
        url = (getenv("SUPABASE_URL") or "").strip().rstrip("/")
        key = (getenv("SUPABASE_ANON_KEY") or "").strip()
        return url, key

    def is_configured(self) -> bool:
        """Returns True when both Supabase URL and Anon Key exist in Vercel env."""
        url, key = self._get_credentials()
        return bool(url and key)

    def is_recaptcha_configured(self) -> bool:
        """Returns True when `RECAPTCHA_SECRET_KEY` exists in Vercel env."""
        secret = (getenv("RECAPTCHA_SECRET_KEY") or "").strip()
        return bool(secret)

    def verify_header(self, authorization: str) -> dict:
        """
        Checks the `Authorization: Bearer <token>` header:
          - If no token is attached (for example a public applicant submitting
            `apply.html` before activating an account), returns `{"public": True}`.
          - If a Bearer token is attached, verifies it against Supabase Cloud Auth.
        """
        if not self.is_configured():
            return {"demo": True}

        header_text = (authorization or "").strip()
        if not header_text:
            return {"public": True}

        # Match header against the Bearer JWT regular expression
        match = self._BEARER_REGEX.match(header_text)
        if match:
            token = match.group(1)
            url, key = self._get_credentials()
            try:
                # Ask Supabase Auth server whether this JWT belongs to a real session
                reply = httpx.get(
                    url + "/auth/v1/user",
                    headers={"apikey": key, "Authorization": "Bearer " + token},
                    timeout=10,
                )
                if reply.status_code == 200:
                    data = reply.json()
                    if isinstance(data, dict) and data.get("id"):
                        return data
            except Exception:
                # Fail safely to public context if network lookup times out
                pass

        return {"public": True}

    def verify_recaptcha_token(self, response_token: str, remote_ip: str = "") -> dict:
        """
        Sends the user's Google reCAPTCHA v2 checkbox token to Google's official
        `siteverify` endpoint using `RECAPTCHA_SECRET_KEY` from Vercel env.
        """
        clean_token = (response_token or "").strip()
        if not clean_token:
            return {"verified": False, "reason": "Missing CAPTCHA verification token."}

        secret = (getenv("RECAPTCHA_SECRET_KEY") or "").strip()
        if not secret:
            return {"verified": True, "unconfigured_bypass": True}

        # Prepare form-encoded verification request for Google reCAPTCHA v2
        payload = {"secret": secret, "response": clean_token}
        if remote_ip:
            payload["remoteip"] = remote_ip

        try:
            reply = httpx.post(
                "https://www.google.com/recaptcha/api/siteverify",
                data=payload,
                timeout=10,
            )
            if reply.status_code == 200:
                body = reply.json()
                return {
                    "verified": bool(body.get("success")),
                    "hostname": body.get("hostname") or "",
                    "error_codes": body.get("error-codes") or [],
                }
        except Exception as err:
            return {"verified": False, "reason": str(err)}

        return {"verified": False, "reason": "CAPTCHA verification service returned an error."}


# Single shared verifier instance reused across serverless requests
_verifier = SupabaseTokenVerifier()


# ------------------------------------------------------------------------------
# MODULE-LEVEL PUBLIC FUNCTIONS CALLED BY `api/index.py`
# ------------------------------------------------------------------------------
def is_configured() -> bool:
    """Used by `/api/health` to confirm Supabase environment variables are set."""
    return _verifier.is_configured()


def is_recaptcha_configured() -> bool:
    """Used by `/api/health` to confirm Google reCAPTCHA Secret Key is set."""
    return _verifier.is_recaptcha_configured()


def verify_recaptcha(token: str, remote_ip: str = "") -> dict:
    """Used by `/api/verify-captcha` to validate human checkbox completions."""
    return _verifier.verify_recaptcha_token(token, remote_ip)


def require_login(authorization: str = Header(default="")) -> dict:
    """FastAPI dependency injected into protected routes via `Depends(...)`."""
    return _verifier.verify_header(authorization)
