# Remove AI Flavor Web

The web application is built with Next.js App Router, React, TypeScript, Tailwind CSS, Shadcn UI, and next-intl. It provides the side-by-side optimizer, guest workflow, authenticated history, membership UI, and admin console.

## Requirements

- Node.js `>=20`
- pnpm `>=9`
- A running Remove AI Flavor API

## Setup

From the `web` directory:

```bash
pnpm install
cp .env.example .env
```

Use the local API and web URLs:

```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3009
```

Start the development server:

```bash
pnpm dev
```

Open <http://localhost:3009>. The admin console is available at <http://localhost:3009/admin> for administrator accounts.

## User flows

- Visitors can enter the optimizer directly and use ten free optimizations.
- A browser-generated UUID is sent as `X-Guest-ID`; remaining uses are mirrored in local storage for UI display.
- Local drafts preserve source and optimized text across refreshes.
- Starting a new task clears the current draft after confirmation when content exists.
- Signing in with an email code enables persisted chats, streaming responses, and membership-aware Agent selection.
- Stopping generation aborts the current browser request while the API keeps already-received output.

## Project layout

```text
web/
├── app/
│   ├── [locale]/          # Localized pages
│   ├── messages/          # Chinese and English translations
│   └── globals.css        # Tailwind theme and global styles
├── components/
│   ├── admin/             # Administration UI
│   ├── common/            # Shared components
│   ├── ui/                # Shadcn primitives
│   └── web/               # Editor, layout, sidebar, and dialogs
├── hooks/                 # Shared React hooks
├── i18n/                  # next-intl routing
├── util/                  # API, auth, guest, login, and task helpers
└── public/                # Static assets
```

## Commands

```bash
pnpm dev      # Turbopack development server on port 3009
pnpm test     # Run Vitest once
pnpm build    # Production build and TypeScript validation
pnpm start    # Start an existing production build
pnpm lint     # Run the configured Next.js lint command
make i18n-check # Check missing and unused translation keys
```

Tests are colocated with the units they cover, using `*.test.ts` or `*.test.tsx`.

## Development conventions

- Keep components and hooks typed; avoid `any` unless an external boundary requires it.
- Add Chinese JSDoc comments for public components, hooks, and non-trivial utilities.
- Use existing Shadcn primitives and Tailwind tokens before adding custom CSS.
- Update both `app/messages/zh.json` and `app/messages/en.json` for user-facing copy.
- Keep browser-only APIs behind client components or runtime guards.
- Never expose Agent API keys or other server secrets through public types.
- Extend focused utility tests for guest usage, login redirects, and optimization task storage.

## Production build

```bash
pnpm build
pnpm start
```

The Docker image uses Next.js standalone output:

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://example.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://example.com \
  --build-arg NEXT_PUBLIC_DOCS_URL=https://example.com/api/v1/docs \
  -t remove-ai-flavor-web:local .
```

Production browser requests use the current origin and are proxied by Nginx. See [`../deploy/README.md`](../deploy/README.md) for the complete stack.
