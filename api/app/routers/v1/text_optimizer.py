from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.llm import create_llm_response
from app.core.i18n import get_message
from app.crud.agent import get_agent_detail
from app.dependencies.db import LangDep, SessionDep, UserDep
from app.models.agent import Agent
from app.schemas.message import MessageOut, MessageRole

text_optimizer_router = APIRouter(prefix="/text-optimizer")


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
    try:
        # 验证文本内容
        if not request.text.strip():
            raise HTTPException(
                status_code=400,
                detail=get_message("text_empty", lang)
            )

        # 获取 Agent
        agent: Optional[Agent] = None
        if request.agent_id:
            agent = get_agent_detail(session, request.agent_id)
            if not agent:
                raise HTTPException(
                    status_code=404,
                    detail=get_message("agent_not_found", lang)
                )
        
        # 如果没有指定 agent_id，使用默认配置
        if not agent:
            # TODO: 这里可以从配置中获取默认的 agent
            # 暂时使用 None，让 create_llm_response 使用默认配置
            pass

        # 构造消息列表（模拟对话格式）
        # 系统提示：指导 AI 如何优化文本
        system_prompt = """你是一个专业的文本优化助手。你的任务是将 AI 生成的文本改写得更像人类写作风格。

请遵循以下原则：
1. 去除过于正式和机械的表达方式
2. 减少"首先"、"其次"、"最后"等明显的结构化词汇
3. 避免使用"值得注意的是"、"需要强调的是"等套话
4. 使用更自然、更口语化的表达
5. 保持原文的核心意思和信息
6. 适当增加一些个人化的语气和观点
7. 让文字更流畅、更有温度

请直接输出优化后的文本，不要添加任何解释或说明。"""

        messages = [
            MessageOut(
                id=0,
                chat_id=0,
                role=MessageRole.SYSTEM,
                content=system_prompt,
                created_at="",
                updated_at=""
            ),
            MessageOut(
                id=1,
                chat_id=0,
                role=MessageRole.USER,
                content=request.text,
                created_at="",
                updated_at=""
            )
        ]

        # 调用 LLM 进行文本优化
        optimized_text, token_usage = create_llm_response(
            messages=messages,
            agent=agent
        )

        # 返回优化结果
        return OptimizeTextResponse(
            optimized_text=optimized_text,
            tokens_used=token_usage.get("total_tokens", 0)
        )

    except HTTPException:
        # 重新抛出 HTTP 异常
        raise
    except Exception as e:
        # 记录错误并返回通用错误信息
        print(f"❌ [文本优化失败] user_id={user.id}, error={str(e)}")
        raise HTTPException(
            status_code=500,
            detail=get_message("text_optimization_failed", lang)
        )

