from types import SimpleNamespace

import pytest

from app.routers.v1 import chat


@pytest.fixture
def anyio_backend() -> str:
    """异步测试统一使用项目现有的 asyncio 后端。"""
    return "asyncio"


@pytest.mark.anyio
async def test_chat_response_uses_unified_agno_adapter(monkeypatch) -> None:
    """聊天非流式响应不应再根据 Agent 来源选择客户端。"""
    calls = []

    async def create_response(messages, agent, user_id=None, chat_id=None):
        """记录聊天路由传给 Agno 的上下文参数。"""
        calls.append((messages, agent, user_id, chat_id))
        return "自然文本", {"total_tokens": 7}

    monkeypatch.setattr(chat, "create_agno_response", create_response)
    messages = [SimpleNamespace(role="user", content="待优化文本")]
    agent = SimpleNamespace(id=9, source="custom")

    result = await chat.create_agent_response(messages, agent, 3, 4, object())

    assert result == ("自然文本", {"total_tokens": 7})
    assert calls == [(messages, agent, 3, 4)]


@pytest.mark.anyio
async def test_chat_stream_uses_unified_agno_adapter(monkeypatch) -> None:
    """聊天流式响应应原样转发 Agno 的正文块和 token 统计。"""

    async def create_response_stream(messages, agent, user_id=None, chat_id=None):
        """模拟统一 Agno 流式响应。"""
        yield "自然", None
        yield "文本", None
        yield "", {"total_tokens": 7}

    monkeypatch.setattr(chat, "create_agno_response_stream", create_response_stream)
    chunks = [
        chunk
        async for chunk in chat.create_agent_response_stream(
            [SimpleNamespace(role="user", content="待优化文本")],
            SimpleNamespace(id=9, source="custom"),
            3,
            4,
            object(),
        )
    ]

    assert chunks == [
        ("自然", None),
        ("文本", None),
        ("", {"total_tokens": 7}),
    ]
