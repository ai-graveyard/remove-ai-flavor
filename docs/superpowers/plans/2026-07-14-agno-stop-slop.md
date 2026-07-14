# Agno stop-slop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Agno 和本地 stop-slop Skill 替换 Dify 与直接 OpenAI SDK 调用，同时保持现有前端、聊天记录、流式响应和访客额度行为。

**Architecture:** 在 FastAPI 内新增单一 Agno 适配层，由数据库 Agent 配置构造 `OpenAILike` 模型，并通过 `LocalSkills` 加载固定版本的 stop-slop。聊天与文本优化路由只依赖适配层；Dify 专用代码、类型和管理界面全部移除。

**Tech Stack:** Python 3.12、FastAPI、Agno、SQLModel、Pytest、Next.js 15、React 19、TypeScript、pnpm。

## Global Constraints

- 所有新增或修改的代码注释、docstring 和 JSDoc 使用中文。
- stop-slop 固定来源提交为 `8da1f030185bdfe8471220585162991eaeb970e9`，采用 MIT License。
- 不接入 HumanizerAI，不新增外部运行时密钥。
- 不启用 Agno 会话数据库，项目数据库仍是消息唯一事实来源。
- 不改变前端现有纯文本流协议和访客三次额度协议。
- 不创建 Git 提交，除非用户另行明确要求。

---

### Task 1: 引入 Agno 与固定版本 Skill

**Files:**
- Modify: `api/pyproject.toml`
- Modify: `api/uv.lock`
- Create: `api/app/skills/stop-slop/SKILL.md`
- Create: `api/app/skills/stop-slop/references/examples.md`
- Create: `api/app/skills/stop-slop/references/phrases.md`
- Create: `api/app/skills/stop-slop/references/structures.md`
- Create: `api/app/skills/stop-slop/LICENSE`
- Create: `api/app/skills/stop-slop/UPSTREAM.md`
- Create: `api/tests/test_agno_agent.py`

**Interfaces:**
- Consumes: Agno `Skills`、`LocalSkills`。
- Produces: 可由 `LocalSkills` 严格校验并发现名称为 `stop-slop` 的本地 Skill。

- [ ] **Step 1: 写 Skill 加载失败测试**

```python
def test_stop_slop_skill_is_loadable() -> None:
    """项目内 stop-slop Skill 应通过 Agno 严格校验。"""
    skills = build_stop_slop_skills()
    assert "stop-slop" in skills.skills
```

- [ ] **Step 2: 运行测试并确认缺少实现**

Run: `cd api && uv run pytest tests/test_agno_agent.py::test_stop_slop_skill_is_loadable -v`

Expected: FAIL，提示 `build_stop_slop_skills` 或 `agno` 不存在。

- [ ] **Step 3: 安装 Agno**

Run: `cd api && uv add agno`

Expected: `pyproject.toml` 和 `uv.lock` 更新，Agno 使用当前可解析的最新稳定版本。

- [ ] **Step 4: 从固定提交引入 Skill 文件**

使用 GitHub API读取固定提交中的 `SKILL.md`、三个 references 和 `LICENSE`，逐文件保存；`UPSTREAM.md` 记录仓库 URL、commit SHA、许可证和同步日期。

- [ ] **Step 5: 实现 Skill 路径与加载器**

```python
SKILLS_ROOT = Path(__file__).resolve().parents[1] / "skills"

def build_stop_slop_skills() -> Skills:
    """加载项目内固定版本的 stop-slop Skill。"""
    return Skills(loaders=[LocalSkills(str(SKILLS_ROOT / "stop-slop"))])
```

- [ ] **Step 6: 运行 Skill 测试**

Run: `cd api && uv run pytest tests/test_agno_agent.py::test_stop_slop_skill_is_loadable -v`

Expected: PASS。

### Task 2: 实现统一 Agno 适配层

**Files:**
- Create: `api/app/agents/agno.py`
- Modify: `api/tests/test_agno_agent.py`
- Delete: `api/app/agents/llm.py`

**Interfaces:**
- Produces: `create_agno_response(messages, agent) -> tuple[str, dict[str, int]]`
- Produces: `create_agno_response_stream(messages, agent) -> AsyncIterator[tuple[str, dict[str, int] | None]]`
- Produces: `test_agno_connection(agent) -> dict[str, Any]`
- Produces: `estimate_conversation_tokens(messages, new_message_content="") -> int`

- [ ] **Step 1: 写模型配置映射测试**

```python
def test_build_model_maps_existing_agent_configuration(monkeypatch) -> None:
    """现有 Agent 配置应安全映射到 OpenAILike。"""
    agent = SimpleNamespace(
        api_url="https://example.com/v1/chat/completions",
        api_key="secret",
        model_conf={"model": "demo", "temperature": 0.2, "max_tokens": 800},
    )
    model = build_model(agent)
    assert model.id == "demo"
    assert str(model.base_url) == "https://example.com/v1"
    assert model.api_key == "secret"
```

- [ ] **Step 2: 写非流式正文和 metrics 测试**

用假的 Agno Agent 返回 `RunOutput(content="自然文本", metrics=...)`，断言内容与三个 token 字段正确映射；空字符串必须抛出 `AgnoEmptyResponseError`。

- [ ] **Step 3: 写流式事件测试**

假的 `arun(..., stream=True, yield_run_output=True)` 依次产出两个内容事件和最终 `RunOutput`，断言生成器输出 `("自然", None)`、`("文本", None)` 和 `("", usage)`。

- [ ] **Step 4: 运行测试并确认失败**

Run: `cd api && uv run pytest tests/test_agno_agent.py -v`

Expected: FAIL，缺少 Agno 适配实现。

- [ ] **Step 5: 实现配置校验和模型构造**

只接收 `model`、`temperature`、`max_tokens`、`top_p`、`frequency_penalty`、`presence_penalty`；URL 仅移除末尾 `/chat/completions`，缺失 URL、密钥或模型名时抛出不包含密钥的配置异常。

- [ ] **Step 6: 实现专用去 AI 味 Agent**

```python
def build_agno_agent(agent_config: Agent) -> AgnoAgent:
    """创建加载 stop-slop 的无状态文本改写 Agent。"""
    return AgnoAgent(
        model=build_model(agent_config),
        skills=build_stop_slop_skills(),
        instructions=REMOVE_AI_FLAVOR_INSTRUCTIONS,
        markdown=False,
    )
```

- [ ] **Step 7: 实现异步非流式、流式和连接测试函数**

使用 `arun` 避免阻塞事件循环；流式调用设置 `yield_run_output=True` 获取最终 metrics。连接测试使用短输入，并沿用现有响应字典结构。

- [ ] **Step 8: 运行适配层测试**

Run: `cd api && uv run pytest tests/test_agno_agent.py -v`

Expected: PASS。

### Task 3: 路由统一切换到 Agno

**Files:**
- Modify: `api/app/routers/v1/chat.py`
- Modify: `api/app/routers/v1/text_optimizer.py`
- Modify: `api/tests/test_text_optimizer.py`
- Add or modify: `api/tests/test_chat.py`

**Interfaces:**
- Consumes: Task 2 的四个公开函数。
- Produces: 现有 `/chat/message`、`/chat/test-agent/{id}`、`/text-optimizer/optimize` 和 `/text-optimizer/guest-optimize` API 行为。

- [ ] **Step 1: 把文本优化测试改为 Mock `create_agno_response`**

```python
async def create_response(messages, agent):
    """模拟 Agno 非流式响应。"""
    assert messages[-1].content == "待优化文本"
    return "自然文本", {"total_tokens": 8}
```

删除 Dify 分支测试，新增“所有来源只调用统一 Agno 适配层”的测试。

- [ ] **Step 2: 写聊天统一适配测试**

断言 `create_agent_response` 不检查来源并调用 `create_agno_response`；流式版本逐块转发适配层结果。

- [ ] **Step 3: 运行路由测试并确认失败**

Run: `cd api && uv run pytest tests/test_text_optimizer.py tests/test_chat.py -v`

Expected: FAIL，路由仍导入 LLM/Dify 函数。

- [ ] **Step 4: 修改文本优化路由**

删除 `_build_optimization_messages` 中旧系统提示词，只创建包含原文的用户消息；`_optimize_with_agent` 直接 `await create_agno_response(...)`，不再使用线程池或来源分支。

- [ ] **Step 5: 修改聊天路由**

统一调用 Agno 非流式、流式和连接测试函数；保留现有消息保存、token 标记、会员限额和异常保存逻辑。

- [ ] **Step 6: 运行路由测试**

Run: `cd api && uv run pytest tests/test_text_optimizer.py tests/test_chat.py -v`

Expected: PASS。

### Task 4: 移除 Dify 后端模型并迁移旧数据

**Files:**
- Delete: `api/app/agents/dify.py`
- Modify: `api/app/models/agent.py`
- Modify: `api/app/schemas/agent.py`
- Modify: `api/app/core/config.py`
- Modify: `api/app/core/i18n.py`
- Modify: `api/app/crud/agent.py`
- Create: `api/alembic/versions/a9f3c2d1e4b5_retire_dify_agents.py`

**Interfaces:**
- Produces: Python API 不再接受 `dify`。
- Produces: 升级后旧 Dify 行转换为 `CUSTOM` 且软删除。

- [ ] **Step 1: 写枚举与 Schema 回归测试**

```python
def test_agent_source_rejects_dify() -> None:
    """新配置不应再接受 Dify 来源。"""
    assert "dify" not in {source.value for source in AgentSource}
    with pytest.raises(ValidationError):
        AgentCreate(name="x", source="dify", api_url="https://x", api_key="k")
```

- [ ] **Step 2: 删除 Dify 枚举、Schema、文案和代码文件**

同时把 `AGENT_SOURCE` 默认值限制为剩余来源；默认 Agent 仍采用 `llm`。

- [ ] **Step 3: 创建数据迁移**

升级 SQL：

```sql
UPDATE agent
SET source = 'CUSTOM',
    is_deleted = TRUE,
    deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP)
WHERE source = 'DIFY';
```

降级只把“已软删除且 source=CUSTOM”的行恢复为 DIFY 会误伤真实 custom 数据，因此 downgrade 保持数据不变并明确写入中文 docstring。

- [ ] **Step 4: 运行后端完整测试**

Run: `cd api && uv run pytest -v`

Expected: PASS。

### Task 5: 移除前端 Dify 入口

**Files:**
- Modify: `web/app/[locale]/types.ts`
- Modify: `web/components/admin/dialogs/create-agent-modal.tsx`
- Modify: `web/components/admin/components/agent-row.tsx`
- Modify: `web/components/admin/pages/agents-management-page.tsx`
- Modify: `web/components/admin/dialogs/delete-agent-modal.tsx`
- Modify: `web/app/messages/zh.json`
- Modify: `web/app/messages/en.json`

**Interfaces:**
- Produces: 管理后台只能提交 `llm | fastgpt | coze | custom`。
- 保持: `RemoveFlavorEditor` 的现有 API 和流式处理逻辑。

- [ ] **Step 1: 修改 TypeScript 联合类型**

```typescript
export type AgentSource = 'llm' | 'fastgpt' | 'coze' | 'custom'
```

- [ ] **Step 2: 删除创建、编辑、筛选、删除确认中的 Dify 分支**

同步更新函数参数类型、预设 URL 和中文 JSDoc，避免残留不可达分支。

- [ ] **Step 3: 删除中英文 Dify 翻译键**

只删除 Agent 来源项，不改动无关文案。

- [ ] **Step 4: 运行前端测试与类型检查**

Run: `cd web && pnpm test -- --run`

Expected: PASS。

Run: `cd web && pnpm exec tsc --noEmit`

Expected: PASS。

### Task 6: 全量验证与文档同步

**Files:**
- Modify if referenced: `README.md`
- Modify if referenced: `README_EN.md`
- Modify if referenced: deployment environment examples

**Interfaces:**
- Produces: 可构建、无 Dify 业务引用的最终工作区。

- [ ] **Step 1: 搜索残留引用**

Run: `rg -n "DIFY|Dify|dify" api/app web --glob '!**/node_modules/**'`

Expected: 无业务代码命中；Alembic 迁移和上游设计文档中的历史说明允许保留。

- [ ] **Step 2: 检查 Python 格式**

Run: `cd api && uv run black --check app tests`

Expected: PASS；若失败，先执行 `uv run black app tests` 再复查。

- [ ] **Step 3: 运行后端完整测试**

Run: `cd api && uv run pytest -v`

Expected: PASS。

- [ ] **Step 4: 运行前端测试、lint 和构建**

Run: `cd web && pnpm test -- --run && pnpm lint && pnpm build`

Expected: 全部 PASS。

- [ ] **Step 5: 检查 IDE 诊断与 Git diff**

只修复本次改动引入的问题；不清理用户原有未提交改动，不创建提交。
