from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db.base import get_session
from app.dependencies.db import get_redis
from app.models.agent import AgentSource
from app.routers.v1 import text_optimizer


class FakeRedis:
    """提供访客端点测试所需的内存 Redis 行为。"""

    def __init__(self) -> None:
        self.values: dict[str, dict[str, int]] = {}

    def eval(self, script: str, key_count: int, key: str, *args: int) -> int:
        """模拟额度预占、提交与归还 Lua 脚本。"""
        assert key_count == 1
        state = self.values.setdefault(key, {"committed": 0, "pending": 0})

        if len(args) == 2:
            limit, _ttl_seconds = args
            if state["committed"] + state["pending"] >= limit:
                return -1
            state["pending"] += 1
            return state["pending"]

        if "'committed', 1" in script and state["pending"] > 0:
            state["pending"] -= 1
            state["committed"] += 1
            return state["committed"]

        if state["pending"] > 0:
            state["pending"] -= 1
        return state["committed"]


def create_client(redis_client: FakeRedis) -> TestClient:
    """
    创建只挂载文本优化路由的测试客户端。

    参数:
    - redis_client: 每个测试独享的内存 Redis。

    返回:
    - TestClient: 已覆盖数据库和 Redis 依赖的客户端。
    """
    app = FastAPI()
    app.include_router(text_optimizer.text_optimizer_router, prefix="/api/v1")
    app.dependency_overrides[get_session] = lambda: object()
    app.dependency_overrides[get_redis] = lambda: redis_client
    return TestClient(app)


def test_guest_can_optimize_without_authorization(monkeypatch) -> None:
    """访客只携带访客 ID 即可调用优化接口。"""
    redis_client = FakeRedis()
    client = create_client(redis_client)
    agent = SimpleNamespace(id=1, source=AgentSource.LLM)
    captured_content = ""

    async def create_response(messages, agent, user_id=None, chat_id=None):
        """记录最终交给 Agno 的原始正文。"""
        nonlocal captured_content
        captured_content = messages[-1].content
        return "自然文本", {"total_tokens": 8}

    monkeypatch.setattr(text_optimizer, "get_active_agents", lambda session, membership: [agent])
    monkeypatch.setattr(text_optimizer, "create_agno_response", create_response)

    response = client.post(
        "/api/v1/text-optimizer/guest-optimize",
        headers={"X-Guest-ID": "11111111-1111-4111-8111-111111111111"},
        json={"text": "待优化文本", "agent_id": 1},
    )

    assert response.status_code == 200
    assert response.json() == {
        "optimized_text": "自然文本",
        "tokens_used": 8,
        "usage_count": 1,
        "usage_limit": 3,
    }
    assert captured_content == "待优化文本"


def test_guest_fourth_request_is_rejected(monkeypatch) -> None:
    """同一访客第四次请求返回 429 且不再调用模型。"""
    redis_client = FakeRedis()
    client = create_client(redis_client)
    agent = SimpleNamespace(id=1, source=AgentSource.LLM)
    calls = 0

    async def create_response(messages, agent, user_id=None, chat_id=None):
        """统计 Agno 调用次数并返回固定结果。"""
        nonlocal calls
        calls += 1
        return "自然文本", {"total_tokens": 8}

    monkeypatch.setattr(text_optimizer, "get_active_agents", lambda session, membership: [agent])
    monkeypatch.setattr(text_optimizer, "create_agno_response", create_response)
    headers = {"X-Guest-ID": "11111111-1111-4111-8111-111111111111"}

    for _ in range(3):
        assert (
            client.post(
                "/api/v1/text-optimizer/guest-optimize",
                headers=headers,
                json={"text": "待优化文本"},
            ).status_code
            == 200
        )

    response = client.post(
        "/api/v1/text-optimizer/guest-optimize",
        headers=headers,
        json={"text": "待优化文本"},
    )

    assert response.status_code == 429
    assert calls == 3


def test_guest_usage_is_released_when_model_fails(monkeypatch) -> None:
    """模型调用失败时归还本次预占额度。"""
    redis_client = FakeRedis()
    client = create_client(redis_client)
    agent = SimpleNamespace(id=1, source=AgentSource.LLM)
    monkeypatch.setattr(text_optimizer, "get_active_agents", lambda session, membership: [agent])

    async def raise_model_error(messages, agent, user_id=None, chat_id=None):
        """模拟 Agno 上游模型服务失败。"""
        raise RuntimeError("model unavailable")

    monkeypatch.setattr(text_optimizer, "create_agno_response", raise_model_error)
    response = client.post(
        "/api/v1/text-optimizer/guest-optimize",
        headers={"X-Guest-ID": "11111111-1111-4111-8111-111111111111"},
        json={"text": "待优化文本"},
    )

    assert response.status_code == 500
    assert redis_client.values["guest-optimize:11111111-1111-4111-8111-111111111111"] == {
        "committed": 0,
        "pending": 0,
    }


def test_guest_custom_agent_uses_unified_agno_adapter(monkeypatch) -> None:
    """不同来源的免费 Agent 都应通过统一 Agno 适配层处理。"""
    redis_client = FakeRedis()
    client = create_client(redis_client)
    agent = SimpleNamespace(id=2, source=AgentSource.CUSTOM)
    monkeypatch.setattr(text_optimizer, "get_active_agents", lambda session, membership: [agent])
    captured_user_id = None

    async def create_response(messages, agent, user_id=None, chat_id=None):
        """模拟统一 Agno 非流式响应。"""
        nonlocal captured_user_id
        captured_user_id = user_id
        return "Agno 自然文本", {"total_tokens": 5}

    monkeypatch.setattr(text_optimizer, "create_agno_response", create_response)
    response = client.post(
        "/api/v1/text-optimizer/guest-optimize",
        headers={"X-Guest-ID": "22222222-2222-4222-8222-222222222222"},
        json={"text": "待优化文本", "agent_id": 2},
    )

    assert response.status_code == 200
    assert response.json()["optimized_text"] == "Agno 自然文本"
    assert captured_user_id == "22222222-2222-4222-8222-222222222222"
