import asyncio
from functools import wraps
from typing import Tuple, Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse


from app.agents.agno import (
    create_agno_response,
    create_agno_response_stream,
    estimate_conversation_tokens,
    snapshot_agent_config,
    test_agno_connection,
)
from app.core.i18n import get_message
from app.crud.agent import get_accessible_agent, get_active_agents, get_agent_detail
from app.crud.chat import (
    create_chat,
    get_all_chats,
    get_chat,
    soft_delete_chat,
    update_chat,
)
from app.crud.message import create_message, get_all_messages, update_message_content
from app.db.base import get_session
from app.dependencies.db import LangDep, SessionDep, UserDep
from app.models.agent import Agent
from app.schemas.agent import AgentPublic as AgentSchema
from app.schemas.chat import ChatCreate, ChatOut, ChatUpdate
from app.schemas.message import MessageCreate, MessageOut, MessageRole
from app.services.membership_service import MembershipService

chat_router = APIRouter(prefix="/chat")


class MessageLogger:
    """
    消息记录日志工具类
    
    功能说明:
    - 提供统一的消息记录日志格式
    - 记录消息创建、更新、错误等关键事件
    - 便于调试和监控消息记录功能
    """
    
    @staticmethod
    def log_message_start(user_id: int, chat_id: int, content_length: int, is_stream: bool = False):
        """记录消息处理开始"""
        mode = "流式" if is_stream else "非流式"
        print(f"📝 [消息开始] user_id={user_id}, chat_id={chat_id}, content_length={content_length}, mode={mode}")
    
    @staticmethod
    def log_user_message_saved(message_id: int, chat_id: int):
        """记录用户消息保存成功"""
        print(f"💾 [用户消息] message_id={message_id}, chat_id={chat_id} - 用户消息已保存")
    
    @staticmethod
    def log_ai_response_start(agent_id: int, is_stream: bool = False):
        """记录AI回复开始生成"""
        mode = "流式" if is_stream else "非流式"
        print(f"🤖 [AI回复开始] agent_id={agent_id}, mode={mode}")
    
    @staticmethod
    def log_ai_response_success(message_id: int, content_length: int, tokens: int):
        """记录AI回复生成成功"""
        print(f"✅ [AI回复成功] message_id={message_id}, content_length={content_length}, tokens={tokens}")
    
    @staticmethod
    def log_ai_response_error(error: str, chat_id: int):
        """记录AI回复生成失败"""
        print(f"❌ [AI回复失败] chat_id={chat_id}, error={error}")
    
    @staticmethod
    def log_stream_progress(message_id: int, chunks: int, content_length: int):
        """记录流式响应进度"""
        print(f"🌊 [流式进度] message_id={message_id}, chunks={chunks}, content_length={content_length}")
    
    @staticmethod
    def log_usage_recorded(user_id: int, chat_id: int, tokens: int):
        """记录使用情况统计"""
        print(f"📊 [使用统计] user_id={user_id}, chat_id={chat_id}, tokens={tokens}")
    
    @staticmethod
    def log_emergency_save(message_id: int, chat_id: int, reason: str):
        """记录紧急保存操作"""
        print(f"🚨 [紧急保存] message_id={message_id}, chat_id={chat_id}, reason={reason}")
    
    @staticmethod
    def log_api_error(function_name: str, user_id: int, chat_id: int, error: str):
        """记录API级别错误"""
        print(f"🚨 [API错误] function={function_name}, user_id={user_id}, chat_id={chat_id}, error={error}")


def ensure_message_logging(func):
    """
    装饰器：确保消息记录的完整性
    
    功能说明:
    - 在API异常时也要确保用户消息被记录
    - 提供详细的错误日志记录
    - 保证数据库事务的一致性
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # 提取消息相关参数
        message_in = None
        session = None
        user = None
        
        # 从参数中提取关键信息
        for arg in args:
            if hasattr(arg, 'chat_id') and hasattr(arg, 'content'):
                message_in = arg
            elif hasattr(arg, 'exec'):  # Session对象
                session = arg
            elif hasattr(arg, 'id'):  # User对象
                user = arg
        
        # 从kwargs中提取
        if not message_in:
            message_in = kwargs.get('message_in')
        if not session:
            session = kwargs.get('session')
        if not user:
            user = kwargs.get('user')
        
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            # 日志只记录异常类型，避免上游响应体、URL 或凭据进入普通日志。
            error_name = type(e).__name__
            MessageLogger.log_api_error(
                func.__name__,
                user.id if user else 0,
                message_in.chat_id if message_in else 0,
                error_name,
            )
            
            # 如果是消息创建相关的异常，确保用户消息已被记录
            if message_in and session and user and hasattr(message_in, 'chat_id'):
                try:
                    # 检查用户消息是否已经被保存
                    existing_messages = get_all_messages(message_in.chat_id, session)
                    user_messages = [msg for msg in existing_messages if msg.content == message_in.content and msg.role == MessageRole.USER]
                    
                    if not user_messages:
                        # 用户消息还未保存，立即保存
                        emergency_user_message = create_message(message_in, session)
                        MessageLogger.log_emergency_save(emergency_user_message.id, message_in.chat_id, "API异常时紧急保存用户消息")
                        
                        # 创建错误回复消息
                        error_reply = create_message(
                            MessageCreate(
                                chat_id=message_in.chat_id,
                                content=get_message("agent_response_failed"),
                                role=MessageRole.ASSISTANT,
                            ),
                            session,
                        )
                        MessageLogger.log_emergency_save(error_reply.id, message_in.chat_id, "API异常时创建错误回复")
                        
                except Exception as save_error:
                    MessageLogger.log_api_error(
                        "emergency_save",
                        user.id if user else 0,
                        message_in.chat_id if message_in else 0,
                        type(save_error).__name__,
                    )
            
            # 重新抛出原始异常
            raise e
    
    return wrapper


async def create_agent_response(messages: list[MessageOut], agent: Agent, user_id: int, chat_id: int, session=None) -> Tuple[str, Dict[str, int]]:
    """
    通过统一 Agno 适配层创建非流式响应。

    参数:
    - messages: 项目消息列表。
    - agent: 数据库 Agent 配置。
    - user_id: 用户 ID。
    - chat_id: 对话 ID。
    - session: 保留的兼容参数，Agno 不建立独立数据库会话。

    返回:
    - Tuple[str, Dict[str, int]]: 生成正文和 token 使用统计。
    """
    return await create_agno_response(messages, agent, user_id, chat_id)


async def create_agent_response_stream(messages: list[MessageOut], agent: Agent, user_id: int, chat_id: int, session=None):
    """
    通过统一 Agno 适配层创建流式响应。

    参数:
    - messages: 项目消息列表。
    - agent: 数据库 Agent 配置。
    - user_id: 用户 ID。
    - chat_id: 对话 ID。
    - session: 保留的兼容参数，Agno 不建立独立数据库会话。

    生成:
    - Tuple[str, Optional[Dict[str, int]]]: 正文块和最终 token 统计。
    """
    async for chunk_data in create_agno_response_stream(messages, agent, user_id, chat_id):
        yield chunk_data


async def test_agent_connection_unified(agent: Agent):
    """
    通过统一 Agno 适配层测试 Agent 连接。

    参数:
    - agent: 数据库 Agent 配置。

    返回:
    - dict: 连接状态、耗时和脱敏详情。
    """
    return await test_agno_connection(agent)


@chat_router.post("", response_model=ChatOut)
async def create_chat_api(chat_in: ChatCreate, session: SessionDep, user: UserDep, lang: LangDep) -> ChatOut:
    """
    创建新的聊天会话

    功能说明:
    - 验证 agent_id 的有效性
    - 创建聊天会话记录
    - 返回包含 agent 信息的聊天对象
    - 不自动创建任何消息，消息需要通过专门的消息接口创建

    参数:
    - chat_in: 聊天创建数据，包含标题、agent_id 等信息
    - session: 数据库会话
    - user: 当前用户
    - lang: 语言设置，默认中文

    返回:
    - ChatOut: 创建的聊天对象，包含 agent 信息

    异常:
    - 404: agent 不存在或已删除
    """
    membership_service = MembershipService(session)
    membership_status = membership_service.get_user_membership_status(user.id)

    # 验证 Agent 存在、未删除且满足当前会员等级。
    if chat_in.agent_id:
        agent = get_accessible_agent(
            session,
            chat_in.agent_id,
            membership_status.membership_type,
        )
        if not agent:
            error_msg = get_message("agent_not_found_or_inactive", lang)
            raise HTTPException(status_code=404, detail=error_msg)
    else:
        error_msg = get_message("agent_not_found", lang)
        raise HTTPException(status_code=404, detail=error_msg)

    # 创建聊天会话
    chat = create_chat(chat_in, session, user)

    # 记录新聊天的使用情况
    membership_service.record_usage(user.id, chat.id, message_count=0, token_count=0, is_new_chat=True)

    # 返回包含 agent 信息的聊天对象
    chat_out = ChatOut.model_validate(chat)
    if agent:
        chat_out.agent = AgentSchema.model_validate(agent)

    return chat_out


@chat_router.post("/message", response_model=list[MessageOut])
@ensure_message_logging
async def create_chat_message_api(
    message_in: MessageCreate,
    session: SessionDep,
    user: UserDep,
    lang: LangDep,
    stream: bool = False,
):
    """
    创建聊天消息 API 端点
    
    功能说明:
    - 接收用户消息并立即保存到数据库
    - 调用 AI Agent 生成回复
    - 确保用户问题和 AI 回复都被完整记录
    - 支持流式和非流式响应模式
    
    参数:
    - message_in: 用户消息数据
    - session: 数据库会话
    - user: 当前用户
    - lang: 语言设置
    - stream: 是否使用流式响应
    
    返回:
    - 流式模式: StreamingResponse
    - 非流式模式: 用户消息和AI回复的列表
    """
    user_id = user.id
    MessageLogger.log_message_start(user_id, message_in.chat_id, len(message_in.content), stream)

    # 验证用户是否有权限访问该聊天，并获取聊天关联的 agent
    chat = get_chat(message_in.chat_id, session, user)
    if not chat:
        error_msg = get_message("chat_access_denied", lang)
        MessageLogger.log_api_error("chat_access_check", user_id, message_in.chat_id, "聊天访问被拒绝")
        raise HTTPException(status_code=404, detail=error_msg)

    membership_service = MembershipService(session)
    membership_status = membership_service.get_user_membership_status(user_id)
    if not chat.agent_id:
        error_msg = get_message("agent_not_found", lang)
        raise HTTPException(status_code=404, detail=error_msg)
    agent = get_accessible_agent(
        session,
        chat.agent_id,
        membership_status.membership_type,
    )
    if not agent:
        error_msg = get_message("agent_not_found_or_inactive", lang)
        raise HTTPException(status_code=404, detail=error_msg)

    # 流式生成器会在请求 Session 关闭后继续执行，先冻结所需配置以避免 ORM 延迟加载。
    runtime_agent = snapshot_agent_config(agent)

    # 获取历史消息用于 token 预估
    messages = get_all_messages(message_in.chat_id, session)
    messages = [MessageOut.model_validate(m) for m in messages]

    # 预估本次对话的 token 消耗
    estimated_tokens = estimate_conversation_tokens(messages, message_in.content)
    
    # 会员限制检查（包含 token 预估）
    can_send, limit_message = membership_service.can_user_send_message(
        user_id, message_in.chat_id, lang, estimated_tokens
    )

    if not can_send:
        MessageLogger.log_api_error("membership_limit", user_id, message_in.chat_id, limit_message)
        raise HTTPException(status_code=429, detail=limit_message)

    # 立即创建并保存用户消息 - 确保用户问题始终被记录
    user_message = create_message(message_in, session)
    messages.append(user_message)
    MessageLogger.log_user_message_saved(user_message.id, message_in.chat_id)

    if not stream:
        # 非流式模式 - 一次性生成完整回复
        MessageLogger.log_ai_response_start(chat.agent_id, False)
        assistant_message = None
        try:
            llm_response_content, usage_info = await create_agent_response(
                messages, runtime_agent, user_id, chat.id, session
            )
            
            # 创建并保存AI回复消息，包含 token 统计信息
            assistant_message = create_message(
                MessageCreate(
                    chat_id=message_in.chat_id,
                    content=llm_response_content,
                    role=MessageRole.ASSISTANT,
                    token_usage=usage_info,  # 保存真实的 token 统计
                ),
                session,
            )

            # 使用真实的 token 统计，如果没有则使用 0
            total_tokens = usage_info.get("total_tokens", 0)
            
            membership_service.record_usage(user_id, message_in.chat_id, 1, total_tokens)
            
            MessageLogger.log_ai_response_success(assistant_message.id, len(llm_response_content), total_tokens)
            MessageLogger.log_usage_recorded(user_id, message_in.chat_id, total_tokens)

            return [user_message, assistant_message]
            
        except Exception as e:
            MessageLogger.log_ai_response_error(type(e).__name__, message_in.chat_id)
            # 即使AI回复失败，也要创建一个错误消息记录
            error_content = get_message("agent_response_failed", lang)
            assistant_message = create_message(
                MessageCreate(
                    chat_id=message_in.chat_id,
                    content=error_content,
                    role=MessageRole.ASSISTANT,
                ),
                session,
            )
            MessageLogger.log_emergency_save(assistant_message.id, message_in.chat_id, "AI回复失败时创建错误消息")
            
            # 记录基础使用情况（AI 回复失败时不计算 token）
            membership_service.record_usage(user_id, message_in.chat_id, 1, 0)
            MessageLogger.log_usage_recorded(user_id, message_in.chat_id, 0)
            
            return [user_message, assistant_message]
    else:

        async def stream_gen():
            """
            增强的流式响应生成器
            
            功能说明:
            - 支持增量消息保存，避免页面刷新时丢失内容
            - 定期保存部分内容到数据库
            - 流式响应完成后保存完整消息
            - 确保所有情况下都能记录用户问题和AI回复
            """
            MessageLogger.log_ai_response_start(chat.agent_id, True)
            content_acc = ""
            message_id = None
            chunk_count = 0
            save_interval = 50  # 每50个chunk保存一次
            
            try:
                # 首先创建一个空的助手消息作为占位符
                with next(get_session()) as temp_session:
                    assistant_message = create_message(
                        MessageCreate(chat_id=message_in.chat_id, content="", role=MessageRole.ASSISTANT),
                        temp_session,
                    )
                    message_id = assistant_message.id
                    temp_session.commit()
                    MessageLogger.log_user_message_saved(message_id, message_in.chat_id)
                
                # 用于收集 token 统计信息
                final_usage_info = None
                
                # 使用统一的流式响应接口
                async for chunk_data in create_agent_response_stream(messages, runtime_agent, user_id, chat.id, None):
                    chunk, usage_info = chunk_data
                    
                    # 如果有内容，累积并输出
                    if chunk:
                        content_acc += chunk
                        chunk_count += 1
                        yield chunk
                    
                    # 如果有 token 统计信息，保存它
                    if usage_info:
                        final_usage_info = usage_info
                    
                    # 定期保存部分内容（避免频繁数据库操作）
                    if chunk_count % save_interval == 0 and message_id:
                        try:
                            with next(get_session()) as update_session:
                                # 更新消息内容
                                update_message_content(message_id, content_acc, update_session)
                                update_session.commit()
                                MessageLogger.log_stream_progress(message_id, chunk_count, len(content_acc))
                        except Exception as e:
                            # 增量保存失败不影响流式响应
                            MessageLogger.log_api_error(
                                "stream_incremental_save",
                                user_id,
                                message_in.chat_id,
                                type(e).__name__,
                            )
                
                # 流式响应完成后，保存最终完整内容和 token 统计
                if message_id:
                    with next(get_session()) as final_session:
                        # 确保 token 统计信息被正确保存
                        update_message_content(message_id, content_acc, final_session, final_usage_info)
                        
                        # 使用真实的 token 统计，如果没有则使用 0
                        total_tokens = final_usage_info.get("total_tokens", 0) if final_usage_info else 0
                        
                        new_membership_service = MembershipService(final_session)
                        new_membership_service.record_usage(user_id, message_in.chat_id, 1, total_tokens)
                        
                        final_session.commit()
                        MessageLogger.log_ai_response_success(message_id, len(content_acc), total_tokens)
                        MessageLogger.log_usage_recorded(user_id, message_in.chat_id, total_tokens)
                        
                        # 输出一个特殊的标记，表示流式响应完成并包含 token 统计信息
                        # 前端可以通过这个标记来触发 token 统计的显示更新
                        if final_usage_info:
                            yield f"\n__TOKEN_USAGE__{final_usage_info['prompt_tokens']},{final_usage_info['completion_tokens']},{final_usage_info['total_tokens']}__END__"
                        
            except asyncio.CancelledError:
                # 浏览器主动停止生成时保存已收到正文，不附加错误或内部异常信息。
                if message_id:
                    with next(get_session()) as cancelled_session:
                        update_message_content(message_id, content_acc, cancelled_session)
                        MembershipService(cancelled_session).record_usage(
                            user_id,
                            message_in.chat_id,
                            1,
                            0,
                        )
                        cancelled_session.commit()
                        MessageLogger.log_emergency_save(
                            message_id,
                            message_in.chat_id,
                            "用户停止生成时保存部分正文",
                        )
                raise
            except Exception as e:
                MessageLogger.log_ai_response_error(type(e).__name__, message_in.chat_id)
                # 如果流式响应出错，至少保存已生成的内容和错误信息
                if message_id:
                    try:
                        with next(get_session()) as error_session:
                            if content_acc:
                                error_content = (
                                    content_acc
                                    + f"\n\n[{get_message('agent_response_interrupted', lang)}]"
                                )
                            else:
                                error_content = get_message("agent_response_failed", lang)
                            
                            update_message_content(message_id, error_content, error_session)
                            
                            # 记录基础使用情况（流式响应失败时不计算 token）
                            error_membership_service = MembershipService(error_session)
                            error_membership_service.record_usage(user_id, message_in.chat_id, 1, 0)
                            
                            error_session.commit()
                            MessageLogger.log_emergency_save(message_id, message_in.chat_id, "流式响应失败时保存错误信息")
                            MessageLogger.log_usage_recorded(user_id, message_in.chat_id, 0)
                    except Exception as save_error:
                        MessageLogger.log_api_error(
                            "stream_error_save",
                            user_id,
                            message_in.chat_id,
                            type(save_error).__name__,
                        )
                
                # 重新抛出原始异常
                raise e

        return StreamingResponse(stream_gen(), media_type="text/plain")


@chat_router.put("/{chat_id}", response_model=ChatOut)
def update_chat_api(
    chat_id: int,
    chat_in: ChatUpdate,
    session: SessionDep,
    user: UserDep,
    lang: LangDep,
) -> ChatOut:
    """
    更新聊天信息
    
    功能说明:
    - 支持更新标题、内容、关联的智能体等信息
    - 当更新 agent_id 时，会验证该智能体是否存在且可用
    
    参数:
    - chat_id: 聊天ID
    - chat_in: 更新数据
    - session: 数据库会话
    - user: 当前用户
    - lang: 语言设置
    
    返回:
    - ChatOut: 更新后的聊天对象
    
    异常:
    - 404: 聊天不存在或智能体不存在
    """
    # 如果更新包含 agent_id，验证其有效性
    if chat_in.agent_id is not None:
        membership_status = MembershipService(session).get_user_membership_status(user.id)
        agent = get_accessible_agent(
            session,
            chat_in.agent_id,
            membership_status.membership_type,
        )
        if not agent:
            error_msg = get_message("agent_not_found_or_inactive", lang)
            raise HTTPException(status_code=404, detail=error_msg)
    
    chat = update_chat(chat_id, chat_in, session, user)
    if not chat:
        error_msg = get_message("chat_not_found", lang)
        raise HTTPException(status_code=404, detail=error_msg)
    
    # 返回完整的 ChatOut 对象，包含 agent 信息
    chat_out = get_chat(chat_id, session, user)
    if not chat_out:
        error_msg = get_message("chat_not_found", lang)
        raise HTTPException(status_code=404, detail=error_msg)
    
    return chat_out


@chat_router.delete("/{chat_id}")
def delete_chat_api(chat_id: int, session: SessionDep, user: UserDep, lang: LangDep) -> dict:
    chat = soft_delete_chat(chat_id, session, user)
    if not chat:
        error_msg = get_message("chat_not_found", lang)
        raise HTTPException(status_code=404, detail=error_msg)
    return {"message": get_message("chat_deleted", lang)}


@chat_router.get("", response_model=list[ChatOut])
def get_all_chats_api(
    session: SessionDep, 
    user: UserDep, 
    lang: LangDep,
    limit: int = 20,
    offset: int = 0,
    include_messages: bool = False
) -> list[ChatOut]:
    """
    获取用户的对话列表
    
    功能说明:
    - 支持分页查询，默认每页20条记录
    - 按更新时间倒序排列
    - 只返回未删除的对话
    - 可选择是否包含消息数据，用于一次性加载完整对话内容
    
    参数:
    - limit: 每页记录数，默认20，最大100
    - offset: 偏移量，默认0
    - include_messages: 是否包含消息数据，默认False，设为True时一次性返回所有消息
    - session: 数据库会话
    - user: 当前用户
    - lang: 语言设置
    
    返回:
    - list[ChatOut]: 对话列表，包含agent信息，可选包含完整消息数据
    """
    # 限制每页最大记录数
    if limit > 100:
        limit = 100
    if limit < 1:
        limit = 20
    if offset < 0:
        offset = 0
        
    chats = get_all_chats(session, user, limit=limit, offset=offset, include_messages=include_messages)
    return chats


@chat_router.get("/{chat_id}", response_model=ChatOut)
def get_chat_api(chat_id: int, session: SessionDep, user: UserDep, lang: LangDep) -> ChatOut:
    chat = get_chat(chat_id, session, user)
    if not chat:
        error_msg = get_message("chat_not_found", lang)
        raise HTTPException(status_code=404, detail=error_msg)

    messages = get_all_messages(chat_id, session)
    chat_out = ChatOut.model_validate(chat)

    agent = get_agent_detail(session, chat.agent_id)
    if not agent:
        error_msg = get_message("agent_not_found", lang)
        raise HTTPException(status_code=404, detail=error_msg)

    chat_out.agent = AgentSchema.model_validate(agent)
    chat_out.messages = [MessageOut.model_validate(m) for m in messages]
    return chat_out


@chat_router.get("/agents/active", response_model=list[AgentSchema])
def get_active_agents_api(session: SessionDep, user: UserDep, lang: LangDep) -> list[AgentSchema]:
    """
    获取所有活跃的 Agent 供用户选择
    
    根据用户的会员等级过滤可用的 agent：
    - 免费会员：只能看到标记为 FREE 的 agent
    - 月度会员：可以看到 FREE 和 MONTHLY 的 agent
    - 年度会员：可以看到所有 agent（FREE、MONTHLY、YEARLY）
    """
    # 获取用户会员状态
    membership_service = MembershipService(session)
    membership_status = membership_service.get_user_membership_status(user.id)
    
    # 根据用户会员等级获取可用的 agent
    agents = get_active_agents(session, membership_status.membership_type)
    return [AgentSchema.model_validate(agent) for agent in agents]


@chat_router.post("/agents/{agent_id}/test")
async def test_agent_availability(agent_id: int, session: SessionDep, user: UserDep, lang: LangDep):
    """测试 Agent 可用性"""
    # 获取 Agent 详情
    membership_status = MembershipService(session).get_user_membership_status(user.id)
    agent = get_accessible_agent(session, agent_id, membership_status.membership_type)
    if not agent:
        error_msg = get_message("agent_not_found_or_inactive", lang)
        raise HTTPException(status_code=404, detail=error_msg)

    # 测试 Agent 连接
    try:
        result = await test_agent_connection_unified(agent)
        return {
            "status": "success" if result["success"] else "error",
            "message": result["message"],
            "response_time": result.get("response_time"),
            "details": result.get("details"),
        }
    except Exception:
        error_msg = get_message("agent_test_failed", lang)
        return {"status": "error", "message": error_msg, "details": None}
