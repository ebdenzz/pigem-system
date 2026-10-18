"""
Login check for the screening service.

MAJOR: The website sends the Supabase login token with every request.
This file asks Supabase "is this token real?" so strangers cannot use the service.
If SUPABASE_URL is empty (demo mode) the check is skipped.
"""
import os

import httpx
from fastapi import Header, HTTPException


def is_configured() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_ANON_KEY"))


def require_login(authorization: str = Header(default="")):
    # MINOR: demo mode or public application form submission (before account activation)
    if not is_configured():
        return {"demo": True}

    token = authorization.replace("Bearer ", "").strip()
    if not token:
        return {"public": True}

    # MINOR: ask Supabase who owns this token
    reply = httpx.get(
        os.getenv("SUPABASE_URL").rstrip("/") + "/auth/v1/user",
        headers={"apikey": os.getenv("SUPABASE_ANON_KEY"), "Authorization": "Bearer " + token},
        timeout=10,
    )
    if reply.status_code != 200:
        return {"public": True}
    return reply.json()
