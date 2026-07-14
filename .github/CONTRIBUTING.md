# 贡献指南

感谢你参与 Remove AI Flavor（RAIF）。项目接受 Bug 修复、功能改进、测试、文档和翻译贡献。

提交贡献即表示你同意遵守[行为准则](./CODE_OF_CONDUCT.md)，并确认提交内容可按项目的 [Apache License 2.0](../LICENSE) 发布。

[English](./CONTRIBUTING_EN.md)

## 开始之前

1. 搜索已有 Issue 和 Pull Request，避免重复工作。
2. 较大的功能、数据模型变更或接口破坏性修改，请先创建 Issue 说明需求和方案。
3. 从最新的 `main` 创建独立分支，不要在一个 PR 中混入无关重构。
4. 阅读根目录 [`AGENTS.md`](../AGENTS.md) 了解项目命令、注释和测试要求。

## 本地开发

环境要求：

- Python `>=3.12,<3.14` 与 uv
- Node.js `>=20` 与 pnpm `>=9`
- PostgreSQL 与 Redis

初始化：

```bash
git clone https://github.com/open-v2ai/remove-ai-flavor.git
cd remove-ai-flavor

cp api/.env.example api/.env
cp web/.env.example web/.env

bash api/scripts/run_postgres.sh
bash api/scripts/run_redis.sh

cd api
uv sync
uv run alembic upgrade head

cd ../web
pnpm install
```

分别运行：

```bash
make dev-api
make dev-web
```

Web 默认使用 <http://localhost:3009>，API 使用 <http://localhost:8000>。

## 修改要求

- Python 公共函数、类、模型和 API 端点应包含清晰的中文文档字符串。
- React 组件、Hook 和关键工具函数应包含中文 JSDoc；复杂业务逻辑应有必要的中文行内注释。
- 用户可见文案必须同时更新 `web/app/messages/zh.json` 和 `web/app/messages/en.json`。
- 数据库模型变化必须包含经过审查的 Alembic 迁移。
- Agent 调用必须复用 `api/app/agents/agno.py`，不得绕过 stop-slop Skill、权限检查或日志脱敏。
- 不要提交 `.env`、API Key、数据库密码、JWT 密钥、Stripe 密钥或用户数据。
- 不要修改 `api/app/skills/stop-slop/` 的上游来源、许可证或规则，除非该 PR 明确用于同步上游。

## 测试

根据修改范围运行：

```bash
# 后端
cd api
make test
make lint

# 前端
cd ../web
pnpm test
pnpm build
make i18n-check

# Markdown（仓库根目录，无需安装根目录 Node.js 依赖）
cd ..
make lint-md
```

修复 Bug 时应优先添加能复现问题的测试。涉及访客额度、会员权限、迁移和 Agent 适配的修改必须覆盖成功与失败路径。

## Commit 与 Pull Request

Commit 信息应简短说明修改目的，例如：

```text
fix: preserve guest usage after refresh
docs: update local development guide
```

Pull Request 请包含：

- 修改原因与实现摘要。
- 关联的 Issue。
- 已运行的测试和结果。
- UI 修改的截图或录屏。
- 数据库迁移、配置项或部署步骤的说明。
- 已知限制和后续工作。

保持 PR 可审查：删除调试日志、临时文件和无关格式化改动，并确保文档与行为同步。

## Bug 报告

请提供：

- 清晰的标题和影响范围。
- 复现步骤、预期结果和实际结果。
- 浏览器、操作系统、部署方式与相关版本。
- 已脱敏的前端控制台或服务日志。
- 必要的截图、录屏或最小复现。

请勿在 Issue 中发布密钥、访问令牌、完整 `.env`、用户文本或其他隐私数据。
