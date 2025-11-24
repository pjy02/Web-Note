import hashlib
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from config import APP_CONFIG


def _expected_token() -> Optional[str]:
    password = APP_CONFIG.get("ADMIN_PASSWORD", "")
    if not password:
        return None
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def require_auth(session_token: Optional[str] = Cookie(default=None, alias=APP_CONFIG["COOKIE_NAME"])):
    expected = _expected_token()
    if not expected:
        return True
    if session_token != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="需要登录")
    return True


def login(password: str):
    expected = _expected_token()
    if expected is None:
        return JSONResponse({"message": "无需登录"})
    if hashlib.sha256(password.encode("utf-8")).hexdigest() != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="密码错误")
    response = JSONResponse({"message": "登录成功"})
    response.set_cookie(
        APP_CONFIG["COOKIE_NAME"],
        expected,
        httponly=True,
        secure=False,
        samesite="lax",
    )
    return response


def logout():
    response = JSONResponse({"message": "已登出"})
    response.delete_cookie(APP_CONFIG["COOKIE_NAME"])
    return response
