# Platform

Next.js (App Router) dashboard for Abra. Lets a user sign in, deploy and manage
the single Abra/Hermes runtime for their account, and configure the Telegram
bot connection and skill API keys it runs with.

For product context and brand voice, see `../PRODUCT.md`. For the full cloud
topology (Vercel, Firebase, AKS, env var reference, debugging quick-reference),
see `../CLOUD.md`. This file covers the platform app itself: structure, key
flows, and local development.

## Tech stack

- Next.js App Router, React 19, TypeScript
- Tailwind v4 (CSS-first `@theme` config in `src/styles/tokens.css`)
- Firebase Auth + Firestore (via `firebase-admin` on the server)
- Vitest + Testing Library for unit/component tests, Playwright for e2e
- No component library (shadcn/Radix/etc.) — `src/components/ui` is a small
  hand-rolled primitive set

## Route groups

- `(marketing)` — public landing page, no auth
- `(auth)` — sign-in page and OAuth callback
- `(dashboard)` — authenticated app: `/dashboard`, `/dashboard/settings`,
  `/dashboard/deployments` (deployment history/logs)
- `api/auth`, `api/dashboard`, `api/orchestration` — route handlers backing
  session management and deployment status polling

## Directory structure

```
src/
  app/                  routes (see route groups above)
  components/ui/        hand-rolled primitives (Button, Card, Badge, Input, ...)
  lib/
    auth/               session + Firebase auth helpers
    firebase/           Admin SDK + client config
    agent-config/       Telegram bot token/channel (legacy single-doc config)
    runtime-env/        user-managed skill/API env vars (encrypted at rest)
    orchestration/      deployment adapters (AKS in prod, mock in local dev)
    deployments.ts      deployment record CRUD + dispatch
    platform-account.ts account bootstrap, subscription info
  styles/               tokens.css (design tokens), primitives.css (base CSS)
  __tests__/            Vitest unit/component tests
  __e2e__/              Playwright specs (seed a real Firebase Auth user via
                         Admin SDK + session cookie — see any spec's
                         `beforeAll` for the pattern)
```

## Design system

The dashboard and marketing site share one dark, monospace "operator
console" visual language built on the `--color-shell-*` tokens in
`tokens.css` (aliased as `shell-canvas`/`shell-panel`/`shell-border-strong`/
`shell-text-strong`/`shell-signal`). `components/ui` primitives implement
this as their **default** styling — pages should not need to re-declare
shell colors locally. `brand-500` (coral) is the one warm accent, used for
primary CTAs; `shell-signal` (mint) is used for eyebrow labels and active-nav
state.

## Key flows

**Auth** — Firebase Auth (Google/GitHub) on `/sign-in`, exchanged for a
server session cookie (`__session`) via `api/auth/session`. `requireAuth()`
(`lib/auth`) gates the `(dashboard)` route group.

**Deploy/delete** — `dashboard/deployment-console.tsx` is the single source
of truth for instance control. Deploying is gated on having a saved Telegram
bot config (shared `TelegramBotForm` component, also rendered standalone on
the Settings page). Deleting requires an explicit two-stage confirm. The
dashboard hero above it is a status/CTA summary computed server-side from
`hasAgentConfig()`/`canDeploy()` (`dashboard/deployment-rules.ts`) — it calls
`router.refresh()` after actions and status-changing polls so it doesn't go
stale relative to the client-driven console below it.

**Settings** — two functional cards: Telegram bot connection (same shared
form as the dashboard) and Runtime environment (user-managed skill/API keys,
field entry or `.env` paste-and-preview import, encrypted at rest — see
`lib/runtime-env`).

## Local development

```bash
pnpm install
pnpm dev
```

Required env vars (`.env.local`): `FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `NEXT_PUBLIC_FIREBASE_*`.
Set `ORCHESTRATION_BACKEND=mock` to simulate deployments without touching
real AKS — the mock adapter advances status on each poll without calling
Azure. There is no local auth bypass; signing in goes through real Firebase
Auth against whichever project the credentials point at. To inspect
authenticated pages without a real OAuth login, mint a session cookie
directly with the Firebase Admin SDK (custom token → ID token exchange →
`createSessionCookie`) the same way the Playwright specs in `__e2e__` do, set
it as the `__session` cookie, and remember to delete the test user/Firestore
doc afterward if you're doing this against the real project.

## Testing

```bash
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint
pnpm test:unit       # vitest run
pnpm test            # typecheck + vitest run
pnpm test:emulator   # vitest run against the Firebase emulator (auth, firestore)
pnpm test:e2e        # playwright — needs real Firebase creds; aks-deployment.spec.ts
                      # targets a real deployed URL and real AKS, not local dev
```
