# Next.js Platform Design

## Goal

Add a new web platform inside this repo as a simple Next.js application that:
- presents the Abra landing page
- handles user authentication
- adds payments later without forcing a redesign
- acts as the deployment control layer for Abra agents

The platform is the user-facing control plane. A signed-in user can deploy and
configure their own Abra agent from the UI.

## Scope

The first version includes:
- a public marketing landing page
- auth flows and protected dashboard access
- self-serve agent deployment initiation
- agent configuration UI
- deployment status tracking and error reporting

The first version does not include:
- billing or subscription enforcement
- full team or org management
- SSH-style machine mutation
- direct infrastructure ownership in Terraform

## Placement

The new application should live at `platform/`.

This matches the repo's existing lowercase directory naming and keeps the web
control plane separate from `skills/`, `workflows/`, and `terraform/`.

## Architecture

The platform should use Next.js App Router and split the product into three
top-level route groups:
- `(marketing)` for the public landing page
- `(auth)` for sign in / sign up / password reset
- `(dashboard)` for the authenticated control plane

Recommended high-level layout:

```text
platform/
├── app/
│   ├── (marketing)/
│   ├── (auth)/
│   ├── (dashboard)/
│   └── api/
├── components/
├── features/
│   ├── auth/
│   ├── agents/
│   ├── deployments/
│   └── billing/
├── entities/
│   ├── user/
│   ├── agent/
│   └── deployment/
├── lib/
│   ├── db/
│   ├── auth/
│   ├── orchestration/
│   └── validation/
├── public/
└── package.json
```

`app/` should stay thin and route-focused. Business logic belongs in
`features/`, `entities/`, and `lib/`.

## Auth

The platform will use Supabase Auth from day one because deployment is
self-serve and the platform also needs a durable user record in the same
Postgres-backed system.

The auth layer should:
- use Supabase as the single auth provider
- allow only Google and GitHub OAuth flows
- protect all dashboard routes
- attach platform user identity to deployments and saved agent config
- support server-side authorization checks in every deployment mutation

The initial goal is not advanced identity management. The goal is safe,
predictable access control for one user deploying one or more agents through a
small, constrained sign-in surface.

The implementation should follow Supabase's Next.js SSR pattern:
- server-side user validation for protected routes
- cookie-based session handling for App Router
- no custom auth stack layered on top of Supabase

Email/password, magic links, and other providers should remain out of scope for
the first version.

## Payments

Payments are explicitly deferred, but the architecture should reserve a clear
boundary for them.

The `billing/` feature should exist as an empty or placeholder module so later
subscription billing integration can add:
- plan definitions
- subscription status
- gated deployment limits
- checkout and webhook handling

The first version should not mix billing logic into auth or deployment code.
However, subscription state should still exist in the platform data model now,
so later billing integration does not require reshaping the user/account model.

For the first release, assume all users have an active subscription.

## Deployment Control Layer

This is the most important part of the platform.

The deployment control layer replaces the role that the Blackbox GCP VM manager
previously served, but it should be container-oriented rather than VM-oriented.

Its responsibilities are:
- accept user deployment requests from the UI
- validate the requested agent configuration
- create and track deployment records
- call the backend orchestration service that talks to Azure
- surface current deployment status, logs, and failure reasons
- allow post-deploy configuration updates where safe

The platform should not embed infrastructure logic directly in page components.
Instead it should call a dedicated orchestration module or backend service.

## Control Plane Split

The system should be separated into two layers:

1. **Next.js platform**
   - landing page
   - auth
   - dashboard
   - deployment forms
   - status views
   - user-facing API surface

2. **Orchestration backend**
   - Azure deployment operations
   - reconciliation with real infrastructure state
   - secret/config injection
   - async job execution
   - status/log collection

For the first phase these may live in the same repo, but they should still be
treated as separate modules. The web app is the control-plane UI, not the place
where long-running deployment work executes.

## Self-Serve Deployment Model

Version one should support self-serve deploys from the dashboard.

Recommended flow:
1. user signs in
2. user opens the dashboard and starts a new deployment
3. user selects or confirms their Abra agent configuration
4. platform validates config and creates a deployment record
5. platform submits an async orchestration job
6. orchestration layer provisions or updates the Azure-backed agent runtime
7. platform shows deployment progress and final status
8. user can view and edit supported agent settings afterward

Self-serve does not mean synchronous in-request infrastructure work. Deployment
must be modeled as a job with durable state.

## Agent Runtime Assumptions

The target runtime differs from the older GCP VM model.

The new platform should assume:
- agents run in containers, not mutable VMs
- persistent user data should live in mounted volumes or cloud storage
- agent configuration should be injected via env, secret references, or config
  artifacts
- updates should prefer redeploy / restart / reconcile instead of SSH mutation

This keeps the Azure design aligned with the existing Terraform direction around
Container Apps, Key Vault, and Blob-backed storage.

## Data Model

The platform needs a minimal persistence layer for control-plane state.

Core entities:
- `User`
  - id
  - supabaseAuthUserId
  - primaryEmail
  - authProvider (`google` or `github`)
  - subscriptionStatus (`active` for v1)
  - subscriptionPlan
  - subscriptionCurrentPeriodEnd
  - createdAt
  - updatedAt
- `Agent`
  - id
  - userId
  - displayName
  - deploymentTarget
  - currentStatus
  - configSnapshot
  - createdAt
  - updatedAt
- `Deployment`
  - id
  - agentId
  - userId
  - requestedAction (`create`, `update`, `restart`, `destroy`)
  - status (`queued`, `running`, `succeeded`, `failed`)
  - requestedConfig
  - resultSummary
  - errorMessage
  - createdAt
  - updatedAt

This model is intentionally small. It gives the platform enough structure to
show real deployment state without over-designing billing or team features.

The `User` model should be treated as the platform account record, while
Supabase `auth.users` remains the authentication source of truth.

## Dashboard Scope

The first dashboard should include:
- overview page with deployment status cards
- agent list page
- new deployment flow
- agent detail page with config summary and deployment history
- settings page for user-level Abra configuration inputs

The dashboard does not need complex analytics in the first release.

## Landing Page Scope

The landing page should explain:
- what Abra is
- how the hosted agent experience works
- why a user would sign up
- the simple path from sign-up to deployed agent

It should be a normal product landing page, not docs-heavy infrastructure copy.

## Recommended Technical Direction

For the first implementation:
- use Next.js App Router
- use Supabase Postgres for platform state
- use Supabase Auth for sign-in and session management
- allow only Google and GitHub login providers
- keep mutations server-side
- expose orchestration through a service layer with async jobs
- keep payments behind a future `billing/` boundary

The first implementation should still persist subscription-related fields even
though billing flows are deferred. All seeded or newly created users should be
treated as `active` subscribers until real billing is integrated.

The deployment control layer should be built so that the infrastructure backend
can evolve independently from the web UI.

## Relationship to Terraform

Terraform remains the infrastructure provisioning layer, not the runtime control
plane.

Terraform should provision the shared Azure foundation and any baseline runtime
resources needed by the platform. The new Next.js platform should then act as
the user-facing orchestration layer on top of that foundation.

This means the planned web platform is comparable to the old GCP system only in
the role of control plane, not in its low-level implementation details.

## Delivery Phases

### Phase 1 — Foundation
- create `platform/` Next.js app
- add landing page
- add Supabase auth with Google and GitHub only
- add basic dashboard shell
- add `User` account persistence backed by Supabase Postgres

### Phase 2 — Control Plane MVP
- add `User`, `Agent`, and `Deployment` models
- add deployment creation flow
- add deployment status UI
- add orchestration service boundary

### Phase 3 — Agent Configuration
- add editable agent config forms
- store config snapshots
- support safe update and restart flows

### Phase 4 — Billing
- add plan model
- add subscription gating
- integrate checkout and webhook flows

## Open Questions for Implementation Planning

The next implementation plan should resolve:
- whether orchestration runs inside the Next.js app or as a sibling service
- which Azure runtime primitive is the actual deployment target for each user
- how persistent per-user agent storage is mounted or referenced
- what exact settings a user may configure from the dashboard
- what the initial subscription plan vocabulary should be, even if every user is
  marked `active` in v1

## Success Criteria

This design is successful when:
- the repo gains a clear `platform/` sub-application
- users can sign in and access a protected dashboard
- sign-in is limited to Google and GitHub through Supabase Auth
- users can self-serve deployment of an Abra agent from the UI
- deployments are modeled as async jobs with visible status
- platform users have subscription state stored in the account model
- the architecture leaves room for later Stripe billing without rewriting the
  control plane
