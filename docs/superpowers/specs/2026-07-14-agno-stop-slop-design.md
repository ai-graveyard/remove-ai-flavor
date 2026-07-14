# Agno 与 stop-slop 接入设计

## 目标

用内嵌于现有 FastAPI 服务的 Agno 运行时统一执行 Agent 请求，完整移除 Dify 专用代码，并让前端“去除 AI 味”功能通过 Agno 加载本地 `stop-slop` Skill 完成改写。

改造后继续保留：

- 数据库中的 Agent 模型配置与会员权限。
- 登录用户的聊天记录和流式输出。
- 未登录访客三次免费额度。
- 现有 OpenAI-compatible 模型服务。
- 前端 Agent 选择、停止生成和本地文本缓存。

## 非目标

- 不部署独立的 Agno AgentOS 服务。
- 不启用 Agno 自带的会话数据库。
- 不接入 HumanizerAI 等付费第三方改写 API。
- 不重做前端编辑器界面。
- 不新增文档上传或 `.docx` 处理能力；这里的“Word”指前端文本改写功能。

## 总体架构

新增统一的 `AgnoAgentService`。服务根据现有 `Agent` 记录创建 Agno `OpenAILike` 模型：

- `model_conf.model` 映射为模型 ID。
- `api_key` 原样传给模型客户端。
- `api_url` 去掉末尾 `/chat/completions` 后作为 `base_url`。
- 温度、最大输出 token、`top_p`、惩罚参数继续读取 `model_conf`。

Agno Agent 加载项目内 `api/app/skills/stop-slop/`。系统指令要求 Agent：

1. 加载并执行 `stop-slop` Skill。
2. 保留原文事实、观点、语言、Markdown 和段落关系。
3. 不杜撰信息，不解释处理过程。
4. 只输出改写后的正文。

项目数据库仍是会话和消息的唯一事实来源。Agno 每次运行接收项目已有消息，但不创建自己的持久化 Session，避免双份状态和迁移成本。

## Skill 供应链

`stop-slop` 来自 `hardikpandya/stop-slop`，采用 MIT License。项目固定引入提交：

`8da1f030185bdfe8471220585162991eaeb970e9`

纳入项目的文件包括：

- `SKILL.md`
- `references/examples.md`
- `references/phrases.md`
- `references/structures.md`
- `LICENSE`
- 一份记录来源仓库和固定提交的说明文件

运行时只读取本地文件，不自动拉取上游内容。这样构建可复现，也不会让生产服务执行未审查的新版本。

## 请求链路

### 登录用户

前端继续调用 `/chat/message?stream=true`。聊天路由保存用户消息后，将已有消息、Agent 配置、用户 ID 和聊天 ID 交给 `AgnoAgentService`。

Agno 以异步流式模式运行：

- 内容事件转换为现有纯文本响应块。
- 最终 `RunOutput.metrics` 转换为 `prompt_tokens`、`completion_tokens` 和 `total_tokens`。
- 现有聊天路由继续保存完整助手消息并记录会员用量。

因此前端的流式解析、停止生成和聊天缓存不需要更换协议。

### 未登录访客

前端继续调用 `/text-optimizer/guest-optimize`。文本优化路由不再自行拼接大段提示词，只将原文交给统一 Agno 服务，由系统指令和 Skill 决定改写规则。

访客额度继续采用预占、成功提交、失败归还：

- 模型成功后计入一次。
- Skill 加载失败、模型超时或模型服务错误均不消耗次数。
- 第四次请求仍返回 429。

## Dify 清理范围

后端删除：

- `api/app/agents/dify.py`
- `AgentSource.DIFY`
- Dify 专用 Pydantic Schema 与校验器
- 聊天路由和文本优化路由中的 Dify 分支
- Dify 专用 i18n 文案
- 配置注释中的 Dify 来源说明

前端删除：

- `AgentSource` 联合类型中的 `dify`
- 创建、编辑、搜索和删除弹窗中的 Dify 选项与显示分支
- 中英文翻译中的 Dify 来源项

已有 Dify Agent 配置不会被当作可用 LLM 配置，因为 Dify URL 与 OpenAI-compatible URL 不兼容。Alembic 数据迁移会把现有 Dify Agent 的来源改为 `custom` 并软删除，避免旧枚举值在代码移除后导致反序列化失败；URL、密钥和模型配置仍保留供管理员审计。PostgreSQL 原生枚举中的旧值暂不删除，避免重建枚举类型带来锁表风险，但代码和新数据均不再接受 Dify。

## 错误处理

`AgnoAgentService` 定义稳定的应用层异常：

- Skill 目录缺失或格式无效：启动或首次调用时快速失败，并记录 Skill 路径。
- Agent 缺少模型名、URL 或密钥：返回配置错误，不回显密钥。
- 上游 401、429、超时和连接失败：转换为项目现有的友好文案。
- 流式生成中断：保留现有聊天路由的紧急保存逻辑。
- 空响应：视为失败，不提交访客额度。

日志只记录 Agent ID、模型名、耗时和 token，不记录原文、生成正文或 API Key。

## 兼容策略

`AgentSource` 仍保留 `llm`、`fastgpt`、`coze` 和 `custom`，这些来源统一通过 Agno `OpenAILike` 执行。来源字段只用于后台展示和 URL 预设，不再决定运行时分支。

由于原模型配置使用 `max_tokens`，服务层负责将其映射给 Agno 模型；未配置的参数采用当前项目默认值。未知的 `model_conf` 字段不会直接透传，防止错误参数进入模型客户端。

## 测试

后端单元测试覆盖：

- Agent 配置到 `OpenAILike` 参数的映射。
- Skill 路径和 `stop-slop` 元数据加载。
- 非流式响应正文与 token 映射。
- 流式内容事件与最终 token 映射。
- 空响应和模型异常。
- 访客三次额度、失败归还和 Agent 选择。
- 聊天路由只调用 Agno 适配层，不再出现 Dify 分支。

前端验证覆盖：

- TypeScript 类型检查。
- 管理后台不再显示或提交 Dify。
- 编辑器仍可处理流式文本、取消请求和访客响应。

最终执行后端测试、前端测试、前端 lint 或构建检查，并搜索确认业务代码中不存在 Dify 引用。

## 发布与回滚

发布需要先安装新的 Python 依赖、执行 Alembic 数据迁移并重建 API 镜像。项目内 Skill 会随镜像一同发布，不需要额外环境变量。

回滚代码时，软删除的原 Dify Agent 数据仍在数据库中，但来源已标为 `custom`；管理员需要恢复来源后才能再次启用。本次不删除 Agent 记录，也不清除密钥。
