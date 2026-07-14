from types import SimpleNamespace

import pytest
from agno.metrics import RunMetrics
from agno.run.agent import RunContentEvent, RunOutput

from app.agents import agno as agno_adapter
from app.agents.agno import (
    AgnoAgentConfigurationError,
    AgnoEmptyResponseError,
    build_agno_agent,
    build_model,
    build_stop_slop_skills,
    create_agno_response,
    create_agno_response_stream,
    get_stop_slop_skill_path,
    snapshot_agent_config,
)


@pytest.fixture
def anyio_backend() -> str:
    """异步测试统一使用项目现有的 asyncio 后端。"""
    return "asyncio"


def test_stop_slop_skill_path_contains_required_files() -> None:
    """项目内 stop-slop Skill 应包含主说明和全部参考资料。"""
    skill_path = get_stop_slop_skill_path()

    assert (skill_path / "SKILL.md").is_file()
    assert (skill_path / "LICENSE").is_file()
    assert (skill_path / "references" / "examples.md").is_file()
    assert (skill_path / "references" / "phrases.md").is_file()
    assert (skill_path / "references" / "structures.md").is_file()


def test_stop_slop_skill_passes_agno_validation() -> None:
    """stop-slop Skill 应通过 Agno 严格校验并可按名称发现。"""
    skills = build_stop_slop_skills()

    assert skills.get_skill_names() == ["stop-slop"]


def test_stop_slop_skill_missing_fails_fast(monkeypatch, tmp_path) -> None:
    """Skill 目录缺失时不得静默创建不带规则的 Agent。"""
    build_stop_slop_skills.cache_clear()
    monkeypatch.setattr(agno_adapter, "get_stop_slop_skill_path", lambda: tmp_path / "missing")

    with pytest.raises(AgnoAgentConfigurationError):
        build_stop_slop_skills()

    build_stop_slop_skills.cache_clear()


def test_build_agno_agent_injects_stop_slop_instructions() -> None:
    """stop-slop 主规则应直接进入系统指令，不能依赖模型主动调用工具。"""
    agent_config = SimpleNamespace(
        id=1,
        api_url="https://example.com/v1/chat/completions",
        api_key="secret",
        model_conf={"model": "demo-model"},
    )

    agent = build_agno_agent(agent_config)
    instructions = "\n".join(agent.instructions)

    assert "# Stop Slop" in instructions
    assert "Cut filler phrases" in instructions
    assert agent.skills is None


def test_build_model_maps_existing_agent_configuration() -> None:
    """现有 Agent 配置应安全映射到 OpenAILike 模型。"""
    agent = SimpleNamespace(
        api_url="https://example.com/v1/chat/completions",
        api_key="secret",
        model_conf={
            "model": "demo-model",
            "temperature": 0.2,
            "max_tokens": 800,
            "top_p": 0.9,
            "frequency_penalty": 0.1,
            "presence_penalty": 0.2,
            "unknown": "ignored",
        },
    )

    model = build_model(agent)

    assert model.id == "demo-model"
    assert str(model.base_url) == "https://example.com/v1"
    assert model.api_key == "secret"
    assert model.temperature == 0.2
    assert model.max_tokens == 800
    assert model.top_p == 0.9
    assert model.frequency_penalty == 0.1
    assert model.presence_penalty == 0.2
    assert model.collect_metrics_on_completion is False
    assert not hasattr(model, "unknown")


@pytest.mark.parametrize(
    ("api_url", "api_key", "model_conf"),
    [
        ("", "secret", {"model": "demo-model"}),
        ("https://example.com/v1/chat/completions", "", {"model": "demo-model"}),
    ],
)
def test_build_model_rejects_incomplete_configuration(api_url, api_key, model_conf) -> None:
    """缺失 URL 或密钥时应返回不泄露密钥的配置错误。"""
    agent = SimpleNamespace(api_url=api_url, api_key=api_key, model_conf=model_conf)

    with pytest.raises(AgnoAgentConfigurationError) as error:
        build_model(agent)

    assert "secret" not in str(error.value)


def test_build_model_uses_default_model_name() -> None:
    """未配置模型名时应兼容项目默认模型。"""
    agent = SimpleNamespace(
        api_url="https://example.com/v1/chat/completions",
        api_key="secret",
        model_conf={},
    )

    model = build_model(agent)

    assert model.id == agno_adapter.settings.AGENT_MODEL_NAME


def test_snapshot_agent_config_remains_usable_after_source_is_detached() -> None:
    """运行时快照不应在数据库 Session 关闭后访问 ORM 属性。"""

    class DetachableAgent:
        """模拟 Session 关闭后属性不可再加载的 ORM Agent。"""

        def __init__(self) -> None:
            """初始化可正常读取的 Agent 配置。"""
            self.is_detached = False
            self.id = 7
            self.api_url = "https://example.com/v1/chat/completions"
            self.api_key = "secret"
            self.model_conf = {"model": "demo-model", "temperature": 0.2}

        def __getattribute__(self, name: str):
            """模拟 SQLAlchemy 访问已过期字段时抛出的异常。"""
            if name in {"id", "api_url", "api_key", "model_conf"} and object.__getattribute__(
                self, "is_detached"
            ):
                raise RuntimeError("detached ORM attribute")
            return object.__getattribute__(self, name)

    agent = DetachableAgent()
    runtime_config = snapshot_agent_config(agent)
    agent.is_detached = True

    assert runtime_config.id == 7
    assert runtime_config.api_url == "https://example.com/v1/chat/completions"
    assert runtime_config.api_key == "secret"
    assert runtime_config.model_conf == {"model": "demo-model", "temperature": 0.2}


@pytest.mark.anyio
async def test_create_agno_response_maps_content_and_metrics(monkeypatch) -> None:
    """非流式响应应返回正文和统一 token 统计。"""

    class FakeAgnoAgent:
        """模拟 Agno Agent 的非流式调用。"""

        async def arun(self, prompt, **kwargs):
            """返回固定正文和指标。"""
            assert prompt == "待优化文本"
            assert kwargs["user_id"] == "user-1"
            assert kwargs["session_id"] == "chat-2"
            return RunOutput(
                content="自然文本",
                metrics=RunMetrics(input_tokens=6, output_tokens=4, total_tokens=10),
            )

    monkeypatch.setattr(agno_adapter, "build_agno_agent", lambda agent: FakeAgnoAgent())
    messages = [SimpleNamespace(role="user", content="待优化文本")]

    content, usage = await create_agno_response(
        messages,
        SimpleNamespace(),
        user_id="user-1",
        chat_id=2,
    )

    assert content == "自然文本"
    assert usage == {
        "prompt_tokens": 6,
        "completion_tokens": 4,
        "total_tokens": 10,
    }


@pytest.mark.anyio
async def test_create_agno_response_rejects_empty_content(monkeypatch) -> None:
    """模型返回空正文时应视为失败。"""

    class FakeAgnoAgent:
        """模拟返回空正文的 Agno Agent。"""

        async def arun(self, prompt, **kwargs):
            """返回空白正文。"""
            return RunOutput(content="  ")

    monkeypatch.setattr(agno_adapter, "build_agno_agent", lambda agent: FakeAgnoAgent())

    with pytest.raises(AgnoEmptyResponseError):
        await create_agno_response(
            [SimpleNamespace(role="user", content="待优化文本")],
            SimpleNamespace(),
        )


@pytest.mark.anyio
async def test_create_agno_response_stream_yields_content_and_metrics(monkeypatch) -> None:
    """流式响应应依次返回正文块，并在结尾返回 token 统计。"""

    class FakeAgnoAgent:
        """模拟 Agno Agent 的流式事件。"""

        async def arun(self, prompt, **kwargs):
            """依次产出内容事件和最终运行结果。"""
            assert kwargs["stream"] is True
            assert kwargs["yield_run_output"] is True
            yield RunContentEvent(content="自然")
            yield RunContentEvent(content="文本")
            yield RunOutput(
                content="自然文本",
                metrics=RunMetrics(input_tokens=5, output_tokens=3, total_tokens=8),
            )

    monkeypatch.setattr(agno_adapter, "build_agno_agent", lambda agent: FakeAgnoAgent())
    chunks = [
        chunk
        async for chunk in create_agno_response_stream(
            [SimpleNamespace(role="user", content="待优化文本")],
            SimpleNamespace(),
        )
    ]

    assert chunks == [
        ("自然", None),
        ("文本", None),
        (
            "",
            {
                "prompt_tokens": 5,
                "completion_tokens": 3,
                "total_tokens": 8,
            },
        ),
    ]
