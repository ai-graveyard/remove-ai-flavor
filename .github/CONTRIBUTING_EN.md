# Contributing

Thank you for contributing to Remove AI Flavor (RAIF). Bug fixes, product improvements, tests, documentation, and translations are welcome.

By contributing, you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT_EN.md) and license your contribution under the project's [Apache License 2.0](../LICENSE).

[中文](./CONTRIBUTING.md)

## Before starting

1. Search existing issues and pull requests to avoid duplicate work.
2. Open an issue before implementing a large feature, data-model change, or breaking API change.
3. Create a focused branch from the latest `main`; do not mix unrelated refactors into the same pull request.
4. Read [`AGENTS.md`](../AGENTS.md) for repository commands, comment conventions, and test expectations.

## Local development

Requirements:

- Python `>=3.12,<3.14` and uv
- Node.js `>=20` and pnpm `>=9`
- PostgreSQL and Redis

Setup:

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

Run the services in separate terminals:

```bash
make dev-api
make dev-web
```

The web app defaults to <http://localhost:3009> and the API to <http://localhost:8000>.

## Change requirements

- Public Python functions, classes, models, and API endpoints should have clear Chinese docstrings.
- React components, hooks, and important utilities should have Chinese JSDoc; add Chinese inline comments for non-obvious business logic.
- Update both `web/app/messages/zh.json` and `web/app/messages/en.json` for user-facing copy.
- Include a reviewed Alembic migration with every database model change.
- Reuse `api/app/agents/agno.py` for model execution; do not bypass the stop-slop Skill, access checks, or log redaction.
- Never commit `.env` files, API keys, database passwords, JWT secrets, Stripe credentials, or user data.
- Do not modify the provenance, license, or rules under `api/app/skills/stop-slop/` unless the pull request explicitly synchronizes upstream.

## Tests

Run the checks relevant to your change:

```bash
# Backend
cd api
make test
make lint

# Frontend
cd ../web
pnpm test
pnpm build
make i18n-check

# Markdown (repository root)
cd ..
pnpm lint:md
```

Bug fixes should include a regression test when practical. Changes to guest usage, membership access, migrations, and the Agent adapter must test both success and failure paths.

## Commits and pull requests

Use concise commit messages that describe the purpose:

```text
fix: preserve guest usage after refresh
docs: update local development guide
```

Pull requests should include:

- Why the change is needed and what it does.
- A linked issue.
- Tests run and their results.
- Screenshots or recordings for UI changes.
- Migration, configuration, or deployment notes.
- Known limitations and follow-up work.

Keep the diff reviewable: remove debug output, temporary files, and unrelated formatting, and update documentation with behavior changes.

## Bug reports

Include:

- A clear title and impact.
- Reproduction steps, expected behavior, and actual behavior.
- Browser, operating system, deployment method, and relevant versions.
- Redacted browser-console or service logs.
- Screenshots, recordings, or a minimal reproduction when useful.

Never post credentials, access tokens, complete `.env` files, user text, or other private data in an issue.
