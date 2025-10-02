from fastapi import APIRouter, Depends, HTTPException

from app.core.i18n import create_response_message, get_message
from app.core.logging import get_logger
from app.dependencies.auth import get_current_user
from app.dependencies.db import LangDep, RedisDep, SessionDep
from app.models.user import User
from app.schemas.user import (
    EmailRequest,
    PasswordReset,
    RefreshToken,
    Token,
    UserLogin,
    UserProfile,
    UserRegister,
    VerifyCode,
)
from app.services.email_service import send_verification_code
from app.services.membership_service import MembershipService
from app.services.user_service import (
    login_with_password,
    refresh_access_token,
    register_user,
    reset_password,
    verify_admin_code,
    verify_user_code,
)

auth_router = APIRouter(prefix="/auth")
logger = get_logger(__name__)


@auth_router.post("/send_code")
async def send_code(data: EmailRequest, redis: RedisDep) -> dict:
    """Send verification code to the specified email for different purposes"""
    logger.debug(f"发送验证码请求: email={data.email}, purpose={data.purpose}, lang={data.lang}")
    try:
        await send_verification_code(data.email, data.lang, redis, data.purpose)
        logger.info(f"验证码发送成功: email={data.email}, purpose={data.purpose}")
        return create_response_message("verification_code_sent", data.lang)
    except Exception as e:
        logger.error(f"发送验证码失败: email={data.email}, error={str(e)}")
        error_msg = get_message("internal_error", data.lang)
        raise HTTPException(status_code=500, detail=error_msg)


@auth_router.post("/verify", response_model=Token)
def verify(data: VerifyCode, session: SessionDep, redis: RedisDep) -> Token:
    """验证邮箱验证码并登录已存在的用户"""
    return verify_user_code(data.email, data.code, session, redis, data.lang)


@auth_router.post("/admin/verify", response_model=Token)
def admin_verify(data: VerifyCode, session: SessionDep, redis: RedisDep) -> Token:
    """验证管理员邮箱验证码并登录，只允许已存在的管理员用户登录"""
    return verify_admin_code(data.email, data.code, session, redis, data.lang)


@auth_router.post("/refresh_token", response_model=Token)
async def refresh_token(data: RefreshToken, session: SessionDep) -> Token:
    """Refresh access token"""
    return refresh_access_token(data.refresh_token, session, data.lang)


@auth_router.post("/register", response_model=Token)
def register(data: UserRegister, session: SessionDep, redis: RedisDep) -> Token:
    """用户注册，需要提供用户名、邮箱、密码和验证码"""
    return register_user(data.email, data.username, data.password, data.code, session, redis, data.lang)


@auth_router.post("/login", response_model=Token)
def login(data: UserLogin, session: SessionDep) -> Token:
    """密码登录"""
    return login_with_password(data.email, data.password, session, data.lang)


@auth_router.post("/reset_password")
def reset_user_password(data: PasswordReset, session: SessionDep, redis: RedisDep) -> dict:
    """重置密码"""
    return reset_password(data.email, data.code, data.new_password, session, redis, data.lang)


@auth_router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    session: SessionDep,
    lang: LangDep,
    current_user: User = Depends(get_current_user),
) -> UserProfile:
    """Get current user profile"""

    # 获取用户当前会员状态
    membership_service = MembershipService(session)
    membership_status = membership_service.get_user_membership_status(current_user.id)

    return UserProfile(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        user_type=current_user.user_type,
        membership_type=membership_status.membership_type,
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at,
    )
