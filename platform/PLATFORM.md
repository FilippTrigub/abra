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

- `(marketing)` — public landing page plus `/privacy` and `/legal`, no auth
- `(auth)` — sign-in page and OAuth callback
- `(dashboard)` — authenticated app: `/dashboard`, `/dashboard/settings`,
  `/dashboard/onboarding`, `/dashboard/deployments` (deployment history/logs)
- `api/auth`, `api/dashboard`, `api/orchestration` — route handlers backing
  session management and deployment status polling

## Directory structure

```
src/
  app/                  routes (see route groups above)
    (marketing)/privacy  privacy note adapted for Abra
    (marketing)/legal    legal statement / operator contact details
  components/ui/        hand-rolled primitives (Button, Card, Badge, Input, ...)
  lib/
    auth/               session + Firebase auth helpers
    firebase/           Admin SDK + client config
    agent-config/       Telegram bot identity (token/home channel/allowed
                        users) — the sole source for Telegram; gates deploy
                        via hasAgentConfig()
    brand-profile/      User-level onboarding brand context. Saves the user's
                        concise brand description and generated Markdown at
                        accounts/{userId}/brand-profile/current; orchestration
                        hydrates it into runtime BRAND.md for brand-manager.
    runtime-env/        user-managed skill/API env vars (encrypted at rest).
                        Telegram identity keys are reserved here and rejected
                        on save/import so they can't shadow agent-config.
                        Also reserved: AZURE_FOUNDRY_API_KEY (model provider
                        is platform-managed), all RunPod GPU inference keys
                        (ops/system concern, pending platform-side wiring),
                        and Telegram's thread/channel-name fields (configured
                        within Telegram itself). Reserved keys stay
                        injectable into the deployed container even though
                        they're not user-settable — see
                        RUNTIME_INJECTABLE_DEFINITIONS in definitions.ts
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

**Start/stop** — `dashboard/deployment-console.tsx` is the single source of
truth for runtime control: a lean status section with a compact action strip
that promotes Start/Stop and Settings together. The Start/Stop button toggles
by state and is disabled with a pending label while queued/running/deleting.
Start is disabled until `hasAgentConfig()` reports a saved Telegram bot config,
with a hint pointing to Settings — the dashboard no longer renders the Telegram
form inline. Stop requires an explicit two-stage confirm, shown inline in the
same action strip.

**Onboarding** — `/dashboard/onboarding` is the first-run setup surface. It is a
full-screen step-by-step client wizard backed by server actions. It captures one
brand description, required Telegram bot values, and optional Buffer API key. Brand
profile text is stored at `accounts/{authUserId}/brand-profile/current`; Telegram
continues to use `agent-config/current`; Buffer continues to use encrypted
`runtime-env/current`. The dashboard landing redirects to onboarding until both
brand profile and Telegram setup exist.

**Settings** — four sections, ordered by necessity (`(dashboard)/dashboard/settings/`):
`bot-setup-card.tsx` (Telegram, required to start — the only place the
`TelegramBotForm` is rendered), `publishing-card.tsx` (Buffer — the one optional key that's
functionally critical, since it's what turns an approved draft into a
scheduled post), `model-provider-card.tsx` (read-only status — the model
provider is entirely platform-managed, no user override exists), and
`optional-integrations-card.tsx` (every other provider group from the
registry, lazy-loaded via `next/dynamic` since it's the heaviest of the four,
collapsed `Disclosure`s with a one-line "what this unlocks"
summary, plus the field-entry/`.env` paste-and-preview import modes,
encrypted at rest — see `lib/runtime-env`). The registry
(`lib/runtime-env/definitions.ts`) is the source of truth for grouping,
necessity, and copy.

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
