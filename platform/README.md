# Claw Parade Platform

Local web dashboard for the Abra brand management system. This is a Next.js 16 application that provides an authenticated dashboard for managing deployment requests and user settings, plus a marketing landing page for Abra.

## What this is (right now)

| Surface | Status |
|---------|--------|
| Marketing landing page (`/`) | Live — static content, no backend connections |
| Authentication (`/sign-in`) | Firebase Auth (Google, GitHub) with server-side session cookies. |
| Dashboard (`/dashboard`) | Live — deployment console, stats cards, quick-access nav. Requires Firebase-backed auth. |
| Settings (`/dashboard/settings`) | Live — client-side form backed by server actions. Persisted to Firestore or memory fallback. |
| Deployment orchestration | AKS adapter by default. Set `ORCHESTRATION_BACKEND=mock` only for explicit local/test simulation. |

## Quick start

### Prerequisites

- Node.js 20+ (the repo ships with a `.nvmrc`-compatible version)
- pnpm 8+
- A Firebase project (or local Firebase emulator configuration)

### Install

```bash
cd platform
pnpm install
```

### Environment

Copy the example env file and fill in the Firebase values required for your environment:

```bash
cp .env.example .env.local
```

See [`.env.example`](./.env.example) for every available variable. The minimal set to get the dashboard working locally is the `NEXT_PUBLIC_FIREBASE_*` browser config plus the server-side `FIREBASE_*` service-account values.

### Run

```bash
pnpm dev
```

The dev server starts on `http://localhost:3000`.

### Build and start

```bash
pnpm build
pnpm start
```

### Lint and typecheck

```bash
pnpm typecheck   # TypeScript type-check (fast, local-only)
pnpm lint        # ESLint
pnpm test        # Runs both typecheck and lint together
```

## Architecture

### Routing groups

- `(auth)` — Authentication routes. Holds the sign-in screen, Firebase session bootstrap flow, and the legacy unsupported OAuth callback handler.
- `(dashboard)` — Authenticated dashboard layout with sidebar navigation, subscription gate, and user header.
- `(marketing)` — Public marketing landing page for Abra.

### Key libraries

| Library | Purpose |
|---------|---------|
| `firebase` + `firebase-admin` | Firebase Auth, Firestore access, and server-side session verification |
| `tailwindcss` v4 + `@tailwindcss/postcss` | Utility-first CSS |
| `clsx` + `tailwind-merge` | Conditional class merging (shadcn/ui pattern) |

### Data layer

- **Platform accounts** — Firestore document at `accounts/{authUserId}`. Bootstrapped on first sign-in.
- **Deployments** — Firestore-backed records with an in-memory fallback when Firestore is unavailable.
- **Settings** — Persisted in Firestore at `accounts/{authUserId}/settings/current`, with an in-memory fallback when Firestore is unavailable.
- **Orchestration** — Backend selection in `src/lib/orchestration/` via `ORCHESTRATION_BACKEND=aks|mock`. AKS is the default and uses the hosted env contract documented below.

### Styling

Custom design tokens live in `src/styles/` and are imported through `globals.css`:

- `primitives.css` — base semantic colors (brand, secondary, accent, surface, content, border, status)
- `tokens.css` — token scale (typography, spacing, radii, shadows)
- `shape-language.css` — custom pseudo-elements and decorative shapes

### Component library

UI components are in `src/components/ui/` and re-exported through `src/components/ui/index.ts`:

`Button`, `Link`, `Input`, `Label`, `Card`, `Panel`, `Badge`, `NavItem`, `Surface`, `Select`, `ToggleSwitch`, `EmptyState`, `ErrorState`

## Environment variables

See [`.env.example`](./.env.example) for the full list. All variables marked `NEXT_PUBLIC_` are bundled into the browser. The rest are server-only.

### AKS runtime contract

When the AKS adapter is used, the runtime image is resolved in this order:

1. `payload.image`
2. `AKS_RUNTIME_IMAGE`
3. `ABRA_RUNTIME_IMAGE` (compatibility fallback)

If none of those values is set, create requests fail with a clear missing-image error.

### AKS backend contract

Hosted AKS mode requires the documented production env set, including the AKS runtime image plus Kubernetes auth through in-cluster auth, `KUBECONFIG`, or `KUBECONFIG_B64`. AKS remains the default backend when `ORCHESTRATION_BACKEND` is unset. Set `ORCHESTRATION_BACKEND=mock` only when intentionally running the simulator.

### Firebase data model

The app expects Firebase Auth for sign-in and Firestore for persistence. If Firestore is unavailable, the dashboard degrades gracefully to the in-memory fallbacks used by the deployment and settings layers.

## What is NOT implemented (yet)

- **Real agent orchestration** — AKS is the normal adapter, but the product still needs fuller runtime configuration hydration beyond the minimal generated `openclaw.json`.
- **Dashboard scope** — the current product surface is intentionally focused on `/dashboard` and `/dashboard/settings`. Deployment management lives inside the main dashboard feed rather than separate sub-pages.
- **Subscription / billing** — always returns `active` / `free`. No Stripe or payment provider integration.
- **Production hosting docs** — no deployment guide. This is a local development dashboard.

## File structure

```
platform/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── auth/callback/route.ts        # OAuth session exchange
│   │   │   └── sign-in/page.tsx              # Sign-in page (Google, GitHub)
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                    # Auth check, sidebar, badge
│   │   │   └── dashboard/
│   │   │       ├── actions.ts                # Deployment request action
│   │   │       ├── deployment-console.tsx    # Interactive deployment form
│   │   │       ├── page.tsx                  # Dashboard landing
│   │   │       └── settings/page.tsx         # User settings form
│   │   ├── (marketing)/
│   │   │   ├── layout.tsx                    # Navbar wrapper
│   │   │   ├── page.tsx                      # Abra landing page
│   │   │   └── components/navbar.tsx         # Marketing navbar
│   │   ├── api/
│   │   │   ├── dashboard/
│   │   │   │   ├── account-info/route.ts      # Account info endpoint
│   │   │   │   ├── deployments/[deploymentId]/status/route.ts  # Status sync
│   │   │   │   └── settings/route.ts         # Settings CRUD endpoint
│   │   │   └── orchestration/
│   │   │       ├── operations/[operationId]/route.ts  # Operation status
│   │   │       └── operations/route.ts       # Operation dispatch
│   │   ├── favicon.ico
│   │   ├── globals.css                       # Global styles + token imports
│   │   └── layout.tsx                        # Root layout, fonts, metadata
│   ├── components/ui/                        # Shared UI primitives
│   │   ├── badge.tsx, button.tsx, card.tsx,
│   │   ├── empty-state.tsx, error-state.tsx,
│   │   ├── index.ts, input.tsx, label.tsx,
│   │   ├── link.tsx, nav-item.tsx, panel.tsx,
│   │   ├── select.tsx, surface.tsx,
│   │   └── toggle-switch.tsx
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── actions.ts                    # Server auth actions
│   │   │   ├── index.ts                      # (placeholder re-export)
│   │   │   └── firebase-auth.ts              # Firebase-backed getUser helper
│   │   ├── cn.ts                             # cn() class merger
│   │   ├── db/index.ts                       # DB helper (placeholder)
│   │   ├── deployments.ts                    # Deployment CRUD + mock adapter glue
│   │   ├── orchestration/
│   │   │   ├── index.ts, mock-adapter.ts,
│   │   │   ├── mock-store.ts, server.ts,
│   │   │   └── types.ts                      # Mock orchestration adapter
│   │   ├── platform-account.ts               # Account bootstrap + subscription stubs
│   │   ├── settings/
│   │   │   ├── actions.ts, definitions.ts,
│   │   │   ├── schema.ts, service.ts         # Settings schema, actions, definitions
│   │   └── validation/index.ts               # Validation helpers
│   ├── styles/
│   │   ├── index.ts, primitives.css,
│   │   └── shape-language.css, tokens.css    # Design tokens + shape language
│   ├── proxy.ts                              # ISR-style auth redirect middleware
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```
