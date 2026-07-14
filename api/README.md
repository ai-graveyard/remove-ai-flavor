# Remove AI Flavor API

The API is a FastAPI service for authentication, text optimization, chat history, membership limits, payments, and administration. Model execution is centralized in an Agno adapter backed by an OpenAI-compatible endpoint and the bundled `stop-slop` Skill.

## Requirements

- Python `>=3.12,<3.14`
- uv
- PostgreSQL
- Redis

## Setup

From the `api` directory:

```bash
uv sync
cp .env.example .env
```

Start local PostgreSQL and Redis when needed:

```bash
bash scripts/run_postgres.sh
bash scripts/run_redis.sh
```

Apply migrations and start the API:

```bash
uv run alembic upgrade head
uv run python -m app.main
```

- API: <http://localhost:8000>
- OpenAPI: <http://localhost:8000/api/v1/docs>
- ReDoc: <http://localhost:8000/api/v1/redoc>
- Health: <http://localhost:8000/health>

The application creates missing tables and seeds the default Agent and membership plans during startup. Alembic remains required for existing-database schema changes.

## Configuration

Copy `.env.example` and replace all sample credentials. Important groups are:

- `AUTH_*`: JWT lifetime, signing secret, and local debug-code login.
- `POSTGRES_*`: database connection and pool settings.
- `REDIS_*`: cache connection and guest usage storage.
- `MAIL_*` / `RESEND_*`: email verification delivery.
- `AGENT_*`: default Agent source label, API endpoint, model, and temperature.
- `STRIPE_*`: checkout and webhook credentials.
- `MEMBERSHIP_*`: default plans and usage limits.

Minimal AI configuration:

```dotenv
AGENT_SOURCE=llm
AGENT_API_KEY=sk-...
AGENT_BASE_URL=https://api.openai.com/v1/chat/completions
AGENT_MODEL_NAME=gpt-4.1-mini
AGENT_MODEL_TEMPERATURE=0.7
```

`AGENT_SOURCE` is metadata for display and URL presets. All source values execute through `app/agents/agno.py`. The API URL may be a base URL or a full Chat Completions URL.

## Runtime design

### Agent execution

- `app/agents/agno.py` validates Agent configuration and creates an Agno `OpenAILike` model.
- `app/skills/stop-slop/` is loaded and validated at runtime.
- Skill instructions and references are injected directly so OpenAI-compatible providers do not need tool-call support.
- Only the latest user text is rewritten; the optimization itself is stateless.
- Streaming chat captures partial output and final token usage.

### Access control

- Guest optimization accepts a browser-generated UUID in `X-Guest-ID`.
- Guests receive three successful uses per 30-day Redis window and can only use free Agents.
- Logged-in users can access Agents at or below their membership tier.
- Public Agent schemas exclude API keys.
- Membership services enforce daily messages, daily tokens, and conversation-turn limits.

### Storage

- PostgreSQL stores users, memberships, Agents, chats, messages, usage, and orders.
- Redis stores verification data and guest optimization counters.
- Guest counter updates use Lua scripts to make reserve, commit, and release operations atomic.

## Main endpoints

All versioned routes use the `/api/v1` prefix.

- `POST /text-optimizer/guest-optimize`: guest optimization; requires `X-Guest-ID`.
- `POST /text-optimizer/optimize`: authenticated non-streaming optimization.
- `POST /chat`: create an authenticated chat.
- `POST /chat/message?stream=true`: generate and persist a streaming response.
- `GET /chat/agents/active`: list Agents available to the current membership.
- `/auth`, `/user`, `/membership`, `/orders`, and `/admin`: account and administration APIs.

Use OpenAPI as the source of truth for request and response schemas.

## Project layout

```text
api/
├── alembic/                # Alembic environment and revisions
├── app/
│   ├── agents/             # Agno model adapter
│   ├── core/               # Configuration, logging, i18n, exceptions
│   ├── crud/               # Database access
│   ├── db/                 # Engine, sessions, startup seeds
│   ├── dependencies/       # FastAPI dependencies
│   ├── models/             # SQLModel tables
│   ├── routers/v1/         # Versioned routes
│   ├── schemas/            # Pydantic schemas
│   ├── services/           # Membership, guest usage, email
│   ├── skills/stop-slop/   # Bundled writing Skill
│   └── templates/          # Email templates
├── scripts/                # Local dependency helpers
├── tests/                  # pytest suite
└── pyproject.toml
```

## Development

Run tests and formatting checks:

```bash
make test
make lint
```

Format imports and Python code:

```bash
make format
```

Create and apply a migration:

```bash
uv run alembic revision --autogenerate -m "describe the change"
uv run alembic upgrade head
```

Migration revisions must be reviewed before commit. Do not edit an already-deployed revision unless the change is explicitly a repair for an unreleased migration.

## Stripe testing

Forward local webhooks:

```bash
stripe login
stripe listen --forward-to localhost:8000/api/v1/orders/stripe/webhook
```

Use Stripe's official [test card documentation](https://docs.stripe.com/testing#use-test-cards). Never use live credentials in local development.

## Docker

```bash
docker build -t remove-ai-flavor-api:local .
docker run --rm -p 8000:8000 --env-file .env remove-ai-flavor-api:local
```

For the complete stack, use [`../deploy/README.md`](../deploy/README.md).
