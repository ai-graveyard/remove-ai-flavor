from typing import Annotated

import redis
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer
from sqlmodel import Session

from app.core.i18n import Language
from app.core.security import decode_token
from app.db.base import get_session
from app.models.user import User


def get_redis(request: Request):
    return request.app.state.redis


RedisDep = Annotated[redis.Redis, Depends(get_redis)]

SessionDep = Annotated[Session, Depends(get_session)]

scheme = HTTPBearer()


def get_user(token: str = Depends(scheme), session: Session = Depends(get_session)):
    payload = decode_token(token.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid access token")

    try:
        user_id = int(payload["sub"])
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid access token")

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_language(request: Request) -> str:
    """
    获取语言参数依赖项

    功能说明:
    - 从 Accept-Language 头部获取语言设置
    - 解析并验证语言参数的有效性
    - 提供默认值

    参数:
    - request: FastAPI 请求对象

    返回:
    - str: 验证后的语言代码
    """
    # 从 Accept-Language 头部获取语言
    accept_language = request.headers.get("Accept-Language", "")
    if accept_language:
        # 解析 Accept-Language 头部，格式如: "zh-CN,zh;q=0.9,en;q=0.8"
        languages = []
        for lang_item in accept_language.split(","):
            lang_code = lang_item.split(";")[0].strip().lower()
            # 提取主要语言代码（忽略地区代码）
            primary_lang = lang_code.split("-")[0]
            if primary_lang in [Language.ZH.value, Language.EN.value]:
                languages.append(primary_lang)
        
        # 返回第一个支持的语言
        if languages:
            return languages[0]
    
    # 默认返回中文
    return Language.ZH.value


UserDep = Annotated[User, Depends(get_user)]
LangDep = Annotated[str, Depends(get_language)]
