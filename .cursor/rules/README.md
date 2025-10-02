# Cursor Rules 说明文档

本目录包含了项目的 Cursor AI 规则文件，用于指导 AI 助手更好地理解项目结构和开发规范。

## 规则文件列表

### 1. 项目概览

- **`project-overview.mdc`** (始终应用)
  - 项目整体架构和技术栈
  - 快速导航和常用命令
  - 开发工作流程
  - 核心功能模块

### 2. 后端开发

- **`backend-rules.mdc`**
  - FastAPI 路由和依赖注入
  - SQLModel 数据模型
  - Pydantic Schema 验证
  - CRUD 操作和服务层
  - 异常处理和日志

- **`database-models.mdc`**
  - SQLModel 数据模型设计
  - Alembic 数据库迁移
  - 外键关系和索引
  - 查询优化最佳实践

### 3. 前端开发

- **`frontend-rules.mdc`**
  - Next.js App Router
  - React 组件开发
  - TypeScript 规范
  - 状态管理和数据获取
  - 性能优化

- **`i18n-styling.mdc`**
  - next-intl 国际化
  - Tailwind CSS 使用
  - Shadcn UI 组件
  - 响应式设计和 Dark Mode
  - 移动端适配

### 4. AI 开发

- **`ai-agent-development.mdc`**
  - OpenAI API 集成
  - 流式响应实现
  - Prompt 管理
  - Token 管理
  - 错误处理

### 5. 通用规范

- **`api-route-language-rules.mdc`**
  - API 请求语言设置
  - 后端国际化处理
  - 前端 API 调用规范

- **`security-rules.mdc`**
  - 密码加密和 JWT
  - 输入验证和 SQL 注入防护
  - CORS 和速率限制
  - 敏感信息保护

- **`testing-rules.mdc`**
  - 后端测试 (pytest)
  - 前端测试 (Jest + React Testing Library)
  - Mock 和 Fixture

- **`deployment-devops.mdc`**
  - Docker Compose 部署
  - 数据库管理和备份
  - 监控和日志
  - CI/CD

## 规则类型说明

### 始终应用 (alwaysApply: true)

这些规则会在每次对话中自动加载: `project-overview.mdc` - 项目总览

### 可请求规则 (description)

这些规则可以通过描述被 AI 自动获取，也可以手动引用: 所有其他规则文件都可以根据上下文自动加载

### 文件类型规则 (globs)

根据文件类型自动应用的规则 (本项目暂未使用此类型)

## 如何使用

### 1. AI 自动识别

AI 会根据对话上下文自动加载相关规则。例如:

- 讨论 API 开发时会加载 `backend-rules.mdc`
- 讨论组件开发时会加载 `frontend-rules.mdc`
- 讨论数据库时会加载 `database-models.mdc`

### 2. 手动引用

你可以在对话中明确提到规则名称:

```markdown
请按照 backend-rules 中的规范创建一个新的 API 端点
```

### 3. 查看规则内容

可以直接打开 `.mdc` 文件查看详细规范。

## 规则文件格式

每个规则文件使用 Markdown 格式，包含:

```markdown
---
description: 规则描述 (可选)
alwaysApply: true/false (可选)
globs: *.py,*.ts (可选)
---

# 规则标题

规则内容...
```

### Frontmatter 说明

- `description`: 规则的描述，AI 可以根据描述自动获取规则
- `alwaysApply`: 是否在每次对话中自动应用
- `globs`: 文件匹配模式，根据文件类型自动应用

### 文件引用

在规则中可以引用项目文件:

```markdown
参考 [api/app/main.py](mdc:api/app/main.py)
```

## 维护指南

### 添加新规则

1. 在 `.cursor/rules/` 目录创建 `.mdc` 文件
2. 添加 frontmatter 元数据
3. 编写规则内容
4. 更新本 README 文档

### 修改现有规则

1. 直接编辑对应的 `.mdc` 文件
2. 确保修改后规则清晰准确
3. 同步更新相关文档

### 规则编写最佳实践

- **清晰明确**: 使用简洁的语言描述规范
- **提供示例**: 包含正确和错误的代码示例
- **引用文件**: 使用 `mdc:` 格式引用项目文件
- **结构化**: 使用标题、列表等组织内容
- **保持更新**: 随项目演进及时更新规则

## 常见问题

Q: 规则太多会影响性能吗?
A: 不会。只有相关的规则会被加载到上下文中。

Q: 如何确保 AI 使用了某个规则?
A: 可以在对话中明确提到规则名称，或者查看 AI 的响应是否符合规则要求。

Q: 可以临时禁用某个规则吗?
A: 可以在对话中说明 "不要应用 XX 规则" 或临时修改规则文件的 frontmatter。

Q: 规则冲突怎么办?
A: 应该避免规则冲突。如果发现冲突，需要修改规则文件解决冲突，或在对话中明确说明优先级。

## 相关资源

- [Cursor Rules 官方文档](https://docs.cursor.com/rules)
- [项目 README](../../README.md)
