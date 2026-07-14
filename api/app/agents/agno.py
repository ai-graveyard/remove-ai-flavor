import time
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, AsyncIterator, Dict, Optional, Tuple

from agno.agent import Agent as AgnoAgent
from agno.models.openai.like import OpenAILike
from agno.run.agent import RunContentEvent, RunOutput
from agno.skills import LocalSkills, Skills

from app.core.config import settings
from app.core.i18n import get_message
from app.core.logging import get_logger
from app.models.agent import Agent
from app.schemas.message import MessageOut, MessageRole

logger = get_logger(__name__)

REMOVE_AI_FLAVOR_INSTRUCTIONS = [
    "你是“去除 AI 味”文本改写 Agent。",
    "项目已在系统指令中加载 stop-slop Skill 的完整规则，必须严格执行。",
    "保留原文事实、观点、语言、Markdown、段落关系和必要术语，不得杜撰信息。",
    "根据原文语言输出；中文原文必须输出自然中文，英文原文必须输出自然英文。",
    "只输出改写后的正文，不要解释改动，不要输出评分、标题、前言或结束语。",
]


class AgnoAgentError(Exception):
    """Agno Agent 适配层异常基类。"""


class AgnoAgentConfigurationError(AgnoAgentError):
    """Agent 模型配置缺失或格式无效。"""


class AgnoEmptyResponseError(AgnoAgentError):
    """模型调用成功但没有生成可用正文。"""


@dataclass(frozen=True)
class AgentRuntimeConfig:
    """
    模型调用所需的脱离数据库会话的 Agent 配置快照。

    流式响应会在 FastAPI 请求生命周期结束后继续运行，因此不能直接持有可能
    已过期或脱离 Session 的 ORM `Agent` 实例。
    """

    id: Optional[int]
    api_url: str
    api_key: str
    model_conf: Optional[Dict[str, Any]]


def snapshot_agent_config(agent: Agent) -> AgentRuntimeConfig:
    """
    在数据库 Session 可用时冻结模型调用所需的 Agent 配置。

    参数:
    - agent: 已完成权限校验、仍绑定当前数据库 Session 的 Agent。

    返回:
    - AgentRuntimeConfig: 不会触发 ORM 延迟加载的独立配置快照。
    """
    return AgentRuntimeConfig(
        id=agent.id,
        api_url=agent.api_url,
        api_key=agent.api_key,
        model_conf=deepcopy(agent.model_conf),
    )


def get_stop_slop_skill_path() -> Path:
    """
    返回项目内 stop-slop Skill 的绝对路径。

    返回:
    - Path: 随 API 镜像发布的固定版本 Skill 目录。
    """
    return Path(__file__).resolve().parents[1] / "skills" / "stop-slop"


@lru_cache(maxsize=1)
def build_stop_slop_skills() -> Skills:
    """
    通过 Agno 严格加载项目内 stop-slop Skill。

    返回:
    - Skills: 仅包含 stop-slop 的 Agno Skill 集合。

    异常:
    - SkillValidationError: Skill 文件缺失或元数据不符合规范。
    """
    skill_path = get_stop_slop_skill_path()
    required_files = [
        skill_path / "SKILL.md",
        skill_path / "LICENSE",
        skill_path / "references" / "examples.md",
        skill_path / "references" / "phrases.md",
        skill_path / "references" / "structures.md",
    ]
    missing_files = [path.name for path in required_files if not path.is_file()]
    if missing_files:
        raise AgnoAgentConfigurationError(f"stop-slop Skill 文件缺失: {', '.join(missing_files)}")

    skills = Skills(loaders=[LocalSkills(str(skill_path), validate=True)])
    if skills.get_skill_names() != ["stop-slop"]:
        raise AgnoAgentConfigurationError("stop-slop Skill 加载失败")
    return skills


def _get_stop_slop_instructions(skills: Skills) -> str:
    """
    读取已验证 Skill 的主规则与参考资料，供系统指令直接使用。

    直接注入规则可兼容不支持工具调用的 OpenAI-compatible 服务，也避免模型
    跳过 `get_skill_instructions` 后生成未按 Skill 处理的正文。

    参数:
    - skills: 通过严格校验的 stop-slop Skill 集合。

    返回:
    - str: stop-slop 主规则和全部参考资料。
    """
    skill = skills.get_skill("stop-slop")
    if skill is None:
        raise AgnoAgentConfigurationError("stop-slop Skill 不存在")

    reference_path = get_stop_slop_skill_path() / "references"
    references = [
        (reference_path / filename).read_text(encoding="utf-8") for filename in ("phrases.md", "structures.md", "examples.md")
    ]
    return "\n\n".join([skill.instructions, *references])


def _normalize_base_url(api_url: str) -> str:
    """
    将 Chat Completions 完整地址转换为 OpenAI-compatible 基础地址。

    参数:
    - api_url: 后台 Agent 中保存的 API 地址。

    返回:
    - str: 去除 `/chat/completions` 后的基础地址。
    """
    normalized_url = api_url.strip().rstrip("/")
    suffix = "/chat/completions"
    if normalized_url.endswith(suffix):
        normalized_url = normalized_url[: -len(suffix)]
    return normalized_url


def build_model(agent_config: Agent) -> OpenAILike:
    """
    根据项目 Agent 配置创建 Agno OpenAILike 模型。

    只映射项目明确支持的模型参数，未知字段不会透传给模型客户端。

    参数:
    - agent_config: 数据库中的 Agent 配置。

    返回:
    - OpenAILike: 可供 Agno Agent 使用的模型实例。

    异常:
    - AgnoAgentConfigurationError: API 地址、密钥或默认模型缺失。
    """
    api_url = str(getattr(agent_config, "api_url", "") or "").strip()
    api_key = str(getattr(agent_config, "api_key", "") or "").strip()
    model_conf = getattr(agent_config, "model_conf", None) or {}
    model_id = str(model_conf.get("model") or settings.AGENT_MODEL_NAME or "").strip()

    if not api_url:
        raise AgnoAgentConfigurationError("Agent API 地址不能为空")
    if not api_key:
        raise AgnoAgentConfigurationError("Agent API 密钥不能为空")
    if not model_id:
        raise AgnoAgentConfigurationError("Agent 模型名称不能为空")

    return OpenAILike(
        id=model_id,
        api_key=api_key,
        base_url=_normalize_base_url(api_url),
        temperature=model_conf.get("temperature", settings.AGENT_MODEL_TEMPERATURE),
        max_tokens=model_conf.get("max_tokens", 2000),
        top_p=model_conf.get("top_p", 1.0),
        frequency_penalty=model_conf.get("frequency_penalty", 0.0),
        presence_penalty=model_conf.get("presence_penalty", 0.0),
        timeout=60.0,
        max_retries=1,
        # OpenAI 标准流的 usage 位于 choices 为空的末尾分块，必须逐块采集。
        collect_metrics_on_completion=False,
    )


def build_agno_agent(agent_config: Agent) -> AgnoAgent:
    """
    创建加载 stop-slop Skill 的无状态文本改写 Agent。

    参数:
    - agent_config: 数据库中的模型与调用参数。

    返回:
    - AgnoAgent: 不启用 Agno 数据库会话的请求级 Agent。
    """
    skills = build_stop_slop_skills()
    instructions = [
        *REMOVE_AI_FLAVOR_INSTRUCTIONS,
        _get_stop_slop_instructions(skills),
    ]
    return AgnoAgent(
        name=f"remove-ai-flavor-{getattr(agent_config, 'id', 'default')}",
        model=build_model(agent_config),
        # 规则由 Agno Skills 校验并提取后直接注入；不向兼容端点发送工具定义。
        instructions=instructions,
        markdown=False,
        tool_call_limit=3,
        telemetry=False,
    )


def _get_latest_user_content(messages: list[MessageOut]) -> str:
    """
    从项目消息列表中提取最后一条用户正文。

    每次文本改写保持无状态，历史结果不会影响当前原文。

    参数:
    - messages: 当前对话的消息列表。

    返回:
    - str: 去除首尾空白后的用户正文。

    异常:
    - ValueError: 没有可处理的用户消息。
    """
    for message in reversed(messages):
        role = getattr(message, "role", None)
        role_value = getattr(role, "value", role)
        if role_value == MessageRole.USER.value:
            content = str(getattr(message, "content", "") or "").strip()
            if content:
                return content
    raise ValueError(get_message("user_message_not_found"))


def _map_usage(run_output: RunOutput) -> Dict[str, int]:
    """
    将 Agno RunMetrics 转换为项目统一 token 字段。

    参数:
    - run_output: Agno 最终运行结果。

    返回:
    - Dict[str, int]: prompt、completion 和 total token 统计。
    """
    metrics = run_output.metrics
    if not metrics:
        return {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    return {
        "prompt_tokens": int(metrics.input_tokens or 0),
        "completion_tokens": int(metrics.output_tokens or 0),
        "total_tokens": int(metrics.total_tokens or 0),
    }


def _get_runtime_model_id(agno_agent: AgnoAgent, run_output: RunOutput) -> Optional[str]:
    """
    获取日志所需的模型名称，不读取或输出任何密钥。

    参数:
    - agno_agent: 当前请求使用的 Agno Agent。
    - run_output: Agno 最终运行结果。

    返回:
    - Optional[str]: 运行结果或 Agent 模型中的模型 ID。
    """
    runtime_model = getattr(agno_agent, "model", None)
    return getattr(run_output, "model", None) or getattr(runtime_model, "id", None)


async def create_agno_response(
    messages: list[MessageOut],
    agent_config: Agent,
    user_id: Optional[int | str] = None,
    chat_id: Optional[int] = None,
) -> Tuple[str, Dict[str, int]]:
    """
    使用 Agno 完成一次非流式文本改写。

    参数:
    - messages: 项目消息列表，只处理最后一条用户正文。
    - agent_config: 数据库 Agent 配置。
    - user_id: 登录用户或访客的稳定标识。
    - chat_id: 项目聊天 ID。

    返回:
    - Tuple[str, Dict[str, int]]: 改写正文和 token 统计。

    异常:
    - AgnoEmptyResponseError: 模型没有返回正文。
    """
    prompt = _get_latest_user_content(messages)
    agno_agent = build_agno_agent(agent_config)
    run_output = await agno_agent.arun(
        prompt,
        user_id=str(user_id) if user_id is not None else None,
        session_id=f"chat-{chat_id}" if chat_id is not None else None,
    )
    content = str(run_output.content or "").strip()
    if not content:
        raise AgnoEmptyResponseError("Agno Agent 响应为空")

    usage = _map_usage(run_output)
    logger.info(
        "Agno Agent 调用完成: agent_id=%s, model=%s, total_tokens=%s",
        getattr(agent_config, "id", None),
        _get_runtime_model_id(agno_agent, run_output),
        usage["total_tokens"],
    )
    return content, usage


async def create_agno_response_stream(
    messages: list[MessageOut],
    agent_config: Agent,
    user_id: Optional[int | str] = None,
    chat_id: Optional[int] = None,
) -> AsyncIterator[Tuple[str, Optional[Dict[str, int]]]]:
    """
    使用 Agno 以流式方式完成文本改写。

    参数:
    - messages: 项目消息列表，只处理最后一条用户正文。
    - agent_config: 数据库 Agent 配置。
    - user_id: 登录用户或访客的稳定标识。
    - chat_id: 项目聊天 ID。

    生成:
    - Tuple[str, Optional[Dict[str, int]]]: 正文块；最终额外生成 token 统计。

    异常:
    - AgnoEmptyResponseError: 整个流没有生成正文。
    """
    prompt = _get_latest_user_content(messages)
    agno_agent = build_agno_agent(agent_config)
    final_output: Optional[RunOutput] = None
    content_emitted = False

    async for event in agno_agent.arun(
        prompt,
        stream=True,
        yield_run_output=True,
        user_id=str(user_id) if user_id is not None else None,
        session_id=f"chat-{chat_id}" if chat_id is not None else None,
    ):
        if isinstance(event, RunOutput):
            final_output = event
        elif isinstance(event, RunContentEvent) and event.content:
            content = str(event.content)
            if content:
                content_emitted = True
                yield content, None

    if final_output and not content_emitted:
        final_content = str(final_output.content or "")
        if final_content:
            content_emitted = True
            yield final_content, None

    if not content_emitted:
        raise AgnoEmptyResponseError("Agno Agent 流式响应为空")

    if final_output:
        usage = _map_usage(final_output)
        logger.info(
            "Agno Agent 流式调用完成: agent_id=%s, model=%s, total_tokens=%s",
            getattr(agent_config, "id", None),
            _get_runtime_model_id(agno_agent, final_output),
            usage["total_tokens"],
        )
        yield "", usage


async def test_agno_connection(agent_config: Agent) -> Dict[str, Any]:
    """
    测试后台 Agent 配置能否通过 Agno 正常调用。

    参数:
    - agent_config: 待测试的数据库 Agent 配置。

    返回:
    - Dict[str, Any]: 与现有后台接口兼容的连接测试结果。
    """
    start_time = time.time()
    try:
        now = datetime.now(timezone.utc)
        content, usage = await create_agno_response(
            [
                MessageOut(
                    id=0,
                    chat_id=0,
                    role=MessageRole.USER,
                    content="请把“这是一个测试”改写得更自然。",
                    is_deleted=False,
                    created_at=now,
                    updated_at=now,
                )
            ],
            agent_config,
        )
        response_time = round((time.time() - start_time) * 1000, 2)
        return {
            "success": True,
            "message": get_message("agent_connection_normal"),
            "response_time": response_time,
            "details": {
                "model": (agent_config.model_conf or {}).get("model", settings.AGENT_MODEL_NAME),
                "response_content": content[:100] + ("..." if len(content) > 100 else ""),
                "usage": usage,
            },
        }
    except Exception as error:
        response_time = round((time.time() - start_time) * 1000, 2)
        error_message = str(error)
        lowered_error = error_message.lower()
        if "401" in error_message or "unauthorized" in lowered_error:
            friendly_message = get_message("api_key_invalid")
        elif "404" in error_message or "not found" in lowered_error:
            friendly_message = get_message("api_endpoint_not_found")
        elif "timeout" in lowered_error:
            friendly_message = get_message("request_timeout")
        elif "rate limit" in lowered_error or "429" in error_message:
            friendly_message = get_message("api_rate_limit")
        else:
            friendly_message = get_message("connection_failed")
        return {
            "success": False,
            "message": friendly_message,
            "response_time": response_time,
            "details": {
                "error_type": type(error).__name__,
                "model": (agent_config.model_conf or {}).get("model", settings.AGENT_MODEL_NAME),
            },
        }


def estimate_tokens(text: str) -> int:
    """
    粗略估算中英文混合文本的 token 数量。

    参数:
    - text: 待估算文本。

    返回:
    - int: 至少为 1 的估算 token 数量；空文本返回 0。
    """
    if not text:
        return 0
    chinese_chars = sum(1 for char in text if "\u4e00" <= char <= "\u9fff")
    other_chars = len(text) - chinese_chars
    return max(1, int(chinese_chars * 1.5 + other_chars * 0.25))


def estimate_conversation_tokens(messages: list[MessageOut], new_message_content: str = "") -> int:
    """
    估算请求正文、格式开销和回复预留空间的总 token。

    参数:
    - messages: 已有项目消息列表。
    - new_message_content: 即将发送的新正文。

    返回:
    - int: 用于会员限额预检查的估算值。
    """
    total_tokens = sum(estimate_tokens(message.content) + 10 for message in messages)
    if new_message_content:
        total_tokens += estimate_tokens(new_message_content) + 10
    return total_tokens + 550
