from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.agents.agno import create_agno_response
from app.core.i18n import get_message
from app.core.logging import get_logger
from app.crud.agent import get_accessible_agent, get_active_agents
from app.dependencies.db import LangDep, RedisDep, SessionDep, UserDep
from app.models.agent import Agent
from app.schemas.message import MessageOut, MessageRole
from app.services.guest_usage_service import (
    GUEST_USAGE_LIMIT,
    GuestUsageLimitExceeded,
    GuestUsageService,
)
from app.services.membership_service import MembershipService

text_optimizer_router = APIRouter(prefix="/text-optimizer")
logger = get_logger(__name__)


class OptimizeTextRequest(BaseModel):
    """
    文本优化请求模型

    字段说明:
    - text: 需要优化的原始文本
    - agent_id: 使用的优化模式 ID（可选，默认使用第一个可用的 agent）
    """

    text: str = Field(..., min_length=1, max_length=50000, description="需要优化的文本内容")
    agent_id: Optional[int] = Field(None, description="优化模式 ID")


class OptimizeTextResponse(BaseModel):
    """
    文本优化响应模型

    字段说明:
    - optimized_text: 优化后的文本
    - tokens_used: 本次优化使用的 token 数量
    """

    optimized_text: str = Field(..., description="优化后的文本")
    tokens_used: int = Field(..., description="使用的 token 数量")


class GuestOptimizeTextResponse(OptimizeTextResponse):
    """
    访客文本优化响应模型。

    字段说明:
    - usage_count: 当前访客已经使用的次数。
    - usage_limit: 访客可用的总次数。
    """

    usage_count: int = Field(..., description="当前访客已使用次数")
    usage_limit: int = Field(default=GUEST_USAGE_LIMIT, description="访客使用次数上限")


def _build_optimization_messages(text: str) -> list[MessageOut]:
    """
    构造 Agno 文本优化所需的无状态消息。

    参数:
    - text: 已去除首尾空白的原始文本。

    返回:
    - list[MessageOut]: 仅包含原文的单条用户消息，规则由 stop-slop Skill 提供。
    """
    now = datetime.now(timezone.utc)
    return [
        MessageOut(
            id=1,
            chat_id=0,
            role=MessageRole.USER,
            content=text,
            is_deleted=False,
            created_at=now,
            updated_at=now,
        ),
    ]


async def _optimize_with_agent(
    text: str,
    agent: Agent,
    user_id: Optional[int | str] = None,
) -> OptimizeTextResponse:
    """
    使用指定 Agent 完成一次无状态文本优化。

    参数:
    - text: 需要优化的文本。
    - agent: 已完成权限和可用性校验的 Agent。
    - user_id: 登录用户 ID；访客调用时为空。

    返回:
    - OptimizeTextResponse: 优化结果与 token 用量。
    """
    messages = _build_optimization_messages(text)
    optimized_text, token_usage = await create_agno_response(messages, agent, user_id=user_id)
    return OptimizeTextResponse(
        optimized_text=optimized_text,
        tokens_used=token_usage.get("total_tokens", 0),
    )


@text_optimizer_router.post("/guest-optimize", response_model=GuestOptimizeTextResponse)
async def guest_optimize_text(
    request: OptimizeTextRequest,
    session: SessionDep,
    redis: RedisDep,
    lang: LangDep,
    guest_id: UUID = Header(..., alias="X-Guest-ID"),
) -> GuestOptimizeTextResponse:
    """
    为未登录访客提供最多十次无状态文本优化。

    权限与限制:
    - 不需要 JWT。
    - 必须携带浏览器持久化的 `X-Guest-ID` UUID。
    - 仅允许使用免费 Agent。
    - 第十一次请求返回 429。
    """
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail=get_message("text_empty", lang))

    free_agents = sorted(get_active_agents(session, "free"), key=lambda item: item.id)
    agent = next(
        (item for item in free_agents if request.agent_id is None or item.id == request.agent_id),
        None,
    )
    if not agent:
        raise HTTPException(status_code=404, detail=get_message("agent_not_found", lang))

    guest_id_value = str(guest_id)
    usage_service = GuestUsageService(redis)
    try:
        usage_service.reserve(guest_id_value)
    except GuestUsageLimitExceeded as exc:
        raise HTTPException(
            status_code=429,
            detail=get_message("guest_usage_limit_reached", lang),
        ) from exc

    try:
        result = await _optimize_with_agent(
            text,
            agent,
            user_id=guest_id_value,
        )
        # 仅在模型成功后提交额度，返回值只统计已完成的优化次数。
        usage_count = usage_service.commit(guest_id_value)
        return GuestOptimizeTextResponse(
            optimized_text=result.optimized_text,
            tokens_used=result.tokens_used,
            usage_count=usage_count,
            usage_limit=GUEST_USAGE_LIMIT,
        )
    except Exception as exc:
        # 外部模型失败不应消耗访客次数。
        try:
            usage_service.release(guest_id_value)
        except Exception as release_error:
            # Redis 故障不能覆盖原始模型异常；日志不记录访客 ID 或异常正文。
            logger.error(
                "访客额度归还失败: agent_id=%s, error_type=%s",
                getattr(agent, "id", None),
                type(release_error).__name__,
            )
        logger.error(
            "访客文本优化失败: agent_id=%s, error_type=%s",
            getattr(agent, "id", None),
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=500,
            detail=get_message("text_optimization_failed", lang),
        ) from exc


@text_optimizer_router.post("/optimize", response_model=OptimizeTextResponse)
async def optimize_text(
    request: OptimizeTextRequest,
    session: SessionDep,
    user: UserDep,
    lang: LangDep,
):
    """
    文本优化 API 端点

    功能说明:
    - 接收用户输入的 AI 生成文本
    - 调用指定的 Agent 进行文本优化
    - 返回优化后的文本和 token 使用情况

    权限:
    - 需要用户登录

    请求:
    - text: 需要优化的文本（1-50000 字符）
    - agent_id: 可选，指定使用的优化模式

    响应 (200):
    - optimized_text: 优化后的文本
    - tokens_used: 使用的 token 数量

    响应 (400):
    - 文本为空或过长

    响应 (404):
    - Agent 不存在或不可用

    响应 (500):
    - AI 服务调用失败
    """
    agent: Optional[Agent] = None
    try:
        # 验证文本内容
        if not request.text.strip():
            raise HTTPException(status_code=400, detail=get_message("text_empty", lang))

        membership_status = MembershipService(session).get_user_membership_status(user.id)

        # 只允许选择当前会员等级可使用的活跃 Agent。
        if request.agent_id:
            agent = get_accessible_agent(
                session,
                request.agent_id,
                membership_status.membership_type,
            )
            if not agent:
                raise HTTPException(status_code=404, detail=get_message("agent_not_found", lang))

        # 未指定 Agent 时使用当前会员可访问列表中的第一个 Agent。
        if not agent:
            active_agents = sorted(
                get_active_agents(session, membership_status.membership_type),
                key=lambda item: item.id,
            )
            agent = active_agents[0] if active_agents else None
        if not agent:
            raise HTTPException(status_code=404, detail=get_message("agent_not_found", lang))

        return await _optimize_with_agent(
            request.text.strip(),
            agent,
            user_id=user.id,
        )

    except HTTPException:
        # 重新抛出 HTTP 异常
        raise
    except Exception as e:
        # 日志不记录原文、用户 ID、API Key 或上游响应正文。
        logger.error(
            "登录用户文本优化失败: agent_id=%s, error_type=%s",
            getattr(agent, "id", None),
            type(e).__name__,
        )
        raise HTTPException(status_code=500, detail=get_message("text_optimization_failed", lang))
