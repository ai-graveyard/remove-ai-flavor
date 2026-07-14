from app.crud.agent import resolve_default_agent_source
from app.models.agent import AgentSource


def test_default_agent_source_accepts_supported_value() -> None:
    """默认 Agent 初始化应接受仍受支持的来源。"""
    assert resolve_default_agent_source("llm") == AgentSource.LLM


def test_default_agent_source_skips_removed_dify_value() -> None:
    """遗留 Dify 环境变量不应让应用启动失败或创建错误 Agent。"""
    assert resolve_default_agent_source("dify") is None
