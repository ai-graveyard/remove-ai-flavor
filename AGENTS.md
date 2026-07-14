# AGENTS.md

本文件适用于整个仓库，供编码代理和自动化贡献者使用。若子目录存在更具体的 `AGENTS.md`，以更具体的说明为准。

## 项目定位

Remove AI Flavor（RAIF）是文本去 AI 味应用。后端使用 FastAPI、SQLModel、PostgreSQL、Redis 和 Agno；前端使用 Next.js App Router、React、TypeScript、Tailwind CSS 和 next-intl。

## 关键目录

- `api/app/agents/agno.py`：唯一的模型运行时适配层。
- `api/app/skills/stop-slop/`：随服务发布的上游 Skill；保留许可证与来源信息。
- `api/app/routers/v1/`：`/api/v1` 路由。
- `api/app/services/`：会员、访客额度、邮件等业务逻辑。
- `api/alembic/versions/`：数据库迁移。
- `api/tests/`：后端测试。
- `web/app/[locale]/`：本地化页面。
- `web/app/messages/`：中英文翻译。
- `web/components/web/`：编辑器、布局和侧边栏。
- `web/components/admin/`：管理后台。
- `web/util/`：认证、访客和优化任务工具及测试。
- `deploy/`：Docker Compose、Nginx 和部署配置。
- `.github/workflows/deploy.yml`：通过 SSH 触发服务器端无交互部署。

## 常用命令

```bash
# 仓库根目录
make dev-api
make dev-web
make deploy-ci
pnpm lint:md

# 后端
cd api
uv sync
uv run alembic upgrade head
make test
make lint

# 前端
cd ../web
pnpm install
pnpm test
pnpm build
make i18n-check

# 部署
cd ..
make build-all
make start
make logs
```

前端开发端口是 `3009`，后端端口是 `8000`。OpenAPI 地址为 `/api/v1/docs`，健康检查为 `/health`。

## 修改规范

- 遵循现有分层：路由负责 HTTP 边界，服务处理业务规则，CRUD 负责数据访问。
- 所有模型请求复用 Agno 适配层；不要重新引入已删除的 `llm.py`、`dify.py` 或独立 SDK 调用路径。
- 不得绕过 stop-slop Skill、会员权限、Token 限额或访客额度检查。
- Python 函数、类、模型和 API 端点使用中文 docstring；TypeScript 组件、Hook 和关键函数使用中文 JSDoc。
- Python 使用 Black 与 isort 的 128 字符行宽；配置和 pre-commit 必须保持一致。
- 复杂业务逻辑添加必要的中文行内注释，并在行为变化时同步更新注释。
- 前端优先复用 Shadcn 组件、Tailwind 主题变量和现有工具函数。
- 用户可见文案同时更新 `web/app/messages/zh.json` 与 `web/app/messages/en.json`。
- 保持普通用户响应不包含 Agent API Key；日志不得记录密钥、用户原文或上游响应正文。

## 数据库与迁移

- SQLModel 变化必须附带 Alembic 迁移，并检查 `upgrade` 与 `downgrade`。
- 不要把应用启动时的 `SQLModel.metadata.create_all` 当作迁移替代品。
- 不随意修改已经发布的迁移；需要修正时新增迁移。
- Agent 权限遵循 `free < monthly < yearly`，新增查询必须继续执行等级过滤。

## 测试要求

- 修改后运行最小相关测试；跨模块或高风险修改运行完整 `uv run pytest`、`pnpm test` 和 `pnpm build`。
- Bug 修复优先先写或补充回归测试。
- 外部模型、邮件、Stripe 和 Redis 边界应使用 Mock 或测试替身，不在单元测试中访问真实服务。
- 访客额度需覆盖并发预占、成功提交、失败归还和上限拒绝。
- Agent 适配需覆盖配置校验、流式输出、空响应、Token 统计和密钥脱敏。

## 文档与安全

- 行为、配置、端口或命令变化时，同步更新根 README、对应子目录 README 和 `.env.example`。
- 修改自动部署时同步检查 Workflow、根 Makefile 和部署指南。
- 历史计划、设计记录和 stop-slop 上游参考资料不是常规产品文档，不做无关重写。
- 不提交 `.env`、凭据、数据库数据、日志转储或个人信息。
- 生产示例必须关闭 `AUTH_IS_DEBUG` 与 `API_RELOAD`，并提醒使用强密钥、HTTPS 和网络隔离。

## 提交边界

- 保留用户已有的未提交修改；不要重置或覆盖无关文件。
- 每次提交只包含当前任务相关变更，不做顺手重构。
- 未经明确要求不要创建提交、推送分支或创建 Pull Request。
