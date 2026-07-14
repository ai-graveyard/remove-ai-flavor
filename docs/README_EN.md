# Documentation Index

Maintained project documentation lives in the repository root and each subproject:

- [Project overview and quick start](../README_EN.md)
- [中文文档](../README.md)
- [Backend guide](../api/README.md)
- [Frontend guide](../web/README.md)
- [Deployment and GitHub Actions](../deploy/README.md)
- [Contributing guide](../.github/CONTRIBUTING_EN.md)
- [Coding-agent instructions](../AGENTS.md)
- [Cursor project rules](../.cursor/rules/README.md)

## Historical design records

`superpowers/specs/` and `superpowers/plans/` preserve implementation designs and plans for traceability. They are not the source of truth for current commands, configuration, or API behavior. Use the code, environment templates, and maintained documents above instead.

## Vendored Skill documentation

`api/app/skills/stop-slop/` is a pinned upstream copy distributed with the API:

- [Skill rules](../api/app/skills/stop-slop/SKILL.md)
- [Provenance and pinned revision](../api/app/skills/stop-slop/UPSTREAM.md)
- [License](../api/app/skills/stop-slop/LICENSE)

Do not rewrite its rules, references, provenance, or license unless the task explicitly synchronizes the upstream project.

## Maintenance

- Update the relevant README when behavior, ports, environment variables, or commands change.
- Keep Chinese and English UI translations synchronized.
- Document an Alembic migration with every database model change.
- Add new documents to this index and use relative links.
- Run `pnpm lint:md` from the repository root before submitting changes.
