# 文档索引

[English](./README_EN.md)

项目的维护文档以根目录和各子项目 README 为主：

- [项目概览与快速开始](../README.md)
- [English README](../README_EN.md)
- [后端开发说明](../api/README.md)
- [前端开发说明](../web/README.md)
- [部署与 GitHub Actions](../deploy/README.md)
- [贡献指南](../.github/CONTRIBUTING.md)
- [编码代理说明](../AGENTS.md)
- [Cursor 项目规则](../.cursor/rules/README.md)

## 历史设计记录

`superpowers/specs/` 与 `superpowers/plans/` 保存功能设计和实施计划，用于追溯当时的决策，不作为当前命令、配置或 API 的事实来源。当前行为应以代码、环境模板和上述维护文档为准。

## 第三方 Skill 文档

`api/app/skills/stop-slop/` 是随 API 发布的上游固定副本：

- [Skill 规则](../api/app/skills/stop-slop/SKILL.md)
- [来源与固定版本](../api/app/skills/stop-slop/UPSTREAM.md)
- [许可证](../api/app/skills/stop-slop/LICENSE)

除明确的上游同步任务外，不要改写其规则、参考资料、来源或许可证。

## 维护要求

- 行为、端口、环境变量或命令变化时，更新对应 README。
- 用户界面文案变化时，同步维护中英文翻译。
- 数据库模型变化时，同时提供 Alembic 迁移说明。
- 新文档应加入本索引，并使用相对链接。
- 提交前在仓库根目录运行 `pnpm lint:md`。
