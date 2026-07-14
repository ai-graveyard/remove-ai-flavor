from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.models.agent import AgentSource
from app.schemas.agent import AgentCreate, AgentPublic
from app.schemas.membership import MembershipType


def test_agent_source_rejects_dify() -> None:
    """新 Agent 配置不应再接受已经移除的 Dify 来源。"""
    assert "dify" not in {source.value for source in AgentSource}

    with pytest.raises(ValidationError):
        AgentCreate(
            name="旧 Dify",
            source="dify",
            api_url="https://api.dify.ai/v1/chat-messages",
            api_key="secret",
        )


def test_public_agent_schema_never_exposes_api_key() -> None:
    """普通用户可见的 Agent 响应不得包含上游 API Key。"""
    now = datetime.now(timezone.utc)
    agent = SimpleNamespace(
        id=1,
        name="公开 Agent",
        source=AgentSource.LLM,
        api_url="https://example.com/v1/chat/completions",
        model_conf={"model": "demo"},
        is_think=False,
        is_stream=True,
        required_membership_type=MembershipType.FREE,
        is_deleted=False,
        created_at=now,
        updated_at=now,
        api_key="secret",
    )

    payload = AgentPublic.model_validate(agent).model_dump()

    assert "api_key" not in payload
