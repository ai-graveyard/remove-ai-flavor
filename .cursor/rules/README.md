# Cursor 项目规则

本目录为 Cursor 提供按场景加载的项目规则。仓库级、工具无关的代理说明位于根目录 [`AGENTS.md`](../../AGENTS.md)。

## 规则清单

- `project-structure.mdc`：项目定位、技术栈和目录结构，始终加载。
- `quick-reference.mdc`：关键文件和常用命令，始终加载。
- `quick-comments-guide.mdc`：中文 docstring、JSDoc 和行内注释要求。
- `backend-rules.mdc`：FastAPI、SQLModel、Schema、CRUD 和服务层规范。
- `database-models.mdc`：模型设计、索引、关系和 Alembic 迁移。
- `frontend-rules.mdc`：Next.js、React 和 TypeScript 规范。
- `i18n-styling.mdc`：next-intl、Tailwind CSS、Shadcn UI 和响应式界面。
- `ai-agent-development.mdc`：Agno、OpenAI-compatible 模型和 stop-slop Skill。
- `testing-rules.mdc`：pytest 与 Vitest 测试要求。
- `api-route-language-rules.mdc`：请求语言和后端国际化。
- `security-rules.mdc`：认证、输入验证、密钥和敏感数据保护。
- `deployment-devops.mdc`：Docker Compose、迁移、日志和生产安全。
- `markdown-rules.mdc`：Markdown 格式和维护要求。

## 加载方式

带有 `alwaysApply: true` 的规则会始终加载。其他规则通过 `description` 或 `globs` 在相关任务中加载，也可以在对话中显式引用文件名。

规则使用 Markdown 与 YAML frontmatter：

```markdown
---
description: 规则用途
globs: "**/*.py"
alwaysApply: false
---

# 规则标题

具体要求。
```

## 维护原则

- 规则应引用仓库中真实存在的文件、依赖、端口和命令。
- 项目结构、运行时或工具链变化时，同步更新 `AGENTS.md`、本 README 和相关规则。
- 优先写可执行的约束，删除与当前代码无关的通用模板。
- 不在规则中放入密钥、真实用户数据或生产环境信息。
- 新增规则前先确认现有规则不能承载该主题，避免重复和冲突。

## 相关文档

- [项目 README](../../README.md)
- [编码代理说明](../../AGENTS.md)
- [贡献指南](../../.github/CONTRIBUTING.md)
- [Cursor Rules 文档](https://docs.cursor.com/context/rules)
