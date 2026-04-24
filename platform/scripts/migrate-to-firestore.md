# Firebase Migration Data Migration Plan

## Overview

This document describes the data migration tooling and cutover strategy for migrating from Supabase (Postgres) to Firebase Auth + Firestore.

## Source Data

### Supabase Tables (to migrate)

| Table | Records | Key Fields |
|-------|---------|------------|
| `platform.platform_account` | Active accounts | `id`, `auth_user_id`, `display_name`, `avatar_url`, `email`, `subscription_*` |
| `platform.platform_settings` | Current settings snapshot | `account_id`, `values` |
| `platform.platform_deployment` | Active/recent deployments | `id`, `account_id`, `request_payload`, `status`, `error_message`, `result_url`, `created_at`, `updated_at` |

### Excluded Data

| Table/Entity | Reason |
|--------------|--------|
| `platform.platform_agent` | Not surfaced in v1 product |
| Historical/deprecated deployments | Only active/recent needed |
| `auth.users` metadata history | Auth migration handles identity |

## Target Firestore Structure

```
accounts/{uid}
├── authUserId: string
├── displayName: string (optional)
├── avatarUrl: string (optional)
├── email: string
├── subscriptionPlan: "free" | "pro" | "enterprise"
├── subscriptionStatus: "active" | "inactive" | "cancelled"
├── createdAt: Timestamp
└── updatedAt: Timestamp

accounts/{uid}/settings/current
├── values: { [key: string]: any }
├── createdAt: Timestamp
└── updatedAt: Timestamp

accounts/{uid}/deployments/{deploymentId}
├── accountScope: string (uid)
├── request: { name, environment, sourceRef, notes, mockOutcome }
├── orchestration: { requestId, operationId, adapter, pollAfterMs, lastKnownStatus, lastSyncedAt }
├── status: "queued" | "running" | "succeeded" | "failed"
├── errorMessage: string | null
├── resultUrl: string | null
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

## Identity Mapping Strategy

### Returning Users (Existing Supabase accounts)

1. User signs in with Firebase Auth (Google or GitHub)
2. System checks if Firebase `uid` has existing Firestore account at `accounts/{uid}`
3. If not found, check for legacy mapping by:
   - Matching `auth.users.email` to Firebase provider email
   - Falling back to explicit migration lookup table
4. If match found: migrate data, link to new Firebase identity
5. If no match: bootstrap fresh account (new user flow)

### New Users

1. Firebase Auth sign-in creates new `uid`
2. Bootstrap idempotent account at `accounts/{uid}`
3. Settings and deployments are empty until user interacts

## Migration Tooling

### Phase 1: Export (Supabase → JSON)

```bash
# Export accounts
psql $DATABASE_URL -t -c "
  COPY (
    SELECT json_agg(row_to_json(t))
    FROM platform.platform_account t
  ) TO STDOUT;
" > accounts.json

# Export settings
psql $DATABASE_URL -t -c "
  COPY (
    SELECT json_agg(row_to_json(t))
    FROM platform.platform_settings t
  ) TO STDOUT;
" > settings.json

# Export deployments
psql $DATABASE_URL -t -c "
  COPY (
    SELECT json_agg(row_to_json(t))
    FROM platform.platform_deployment t
  ) TO STDOUT;
" > deployments.json
```

### Phase 2: Transform (JSON → Firestore format)

Script: `scripts/migrate-to-firestore.ts`

```typescript
// Pseudocode
for (const account of accounts) {
  await firestore.doc(`accounts/${account.auth_user_id}`).set({
    authUserId: account.auth_user_id,
    displayName: account.display_name,
    avatarUrl: account.avatar_url,
    email: account.email,
    subscriptionPlan: account.subscription_plan || 'free',
    subscriptionStatus: account.subscription_status || 'active',
    createdAt: admin.firestore.Timestamp.fromDate(new Date(account.created_at)),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date(account.updated_at)),
  });
}

for (const settings of settings) {
  const uid = await getUidForAccountId(settings.account_id);
  await firestore.doc(`accounts/${uid}/settings/current`).set({
    values: settings.values,
    createdAt: admin.firestore.Timestamp.fromDate(new Date(settings.created_at)),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date(settings.updated_at)),
  }, { merge: true });
}

for (const deployment of deployments) {
  const uid = await getUidForAccountId(deployment.account_id);
  await firestore.doc(`accounts/${uid}/deployments/${deployment.id}`).set({
    accountScope: uid,
    request: deployment.request_payload.request,
    orchestration: deployment.request_payload.orchestration,
    status: deployment.status,
    errorMessage: deployment.error_message,
    resultUrl: deployment.result_url,
    createdAt: admin.firestore.Timestamp.fromDate(new Date(deployment.created_at)),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date(deployment.updated_at)),
  }, { merge: true });
}
```

### Phase 3: Verify (Firestore → Audit log)

```bash
# Run verification queries
node scripts/verify-migration.ts
```

## Cutover Checklist

### Pre-Cutover (Staging)
- [ ] Export and transform representative sample (10 accounts)
- [ ] Verify Firestore documents match expected schema
- [ ] Test auth flow with migrated user
- [ ] Verify settings load/save works
- [ ] Verify deployment feed shows migrated deployments
- [ ] Deploy to staging environment
- [ ] Smoke test with test user credentials

### Cutover (Production)
- [ ] Disable Supabase write access (read-only for audit)
- [ ] Run full migration export
- [ ] Transform and import to Firestore
- [ ] Verify import counts match export counts
- [ ] Deploy Firebase-configured platform build
- [ ] Enable Firebase Auth providers
- [ ] Monitor error rates for 15 minutes
- [ ] Enable Firestore Security Rules (strict mode)

### Rollback Triggers
- Auth failures > 5% of requests
- 500 errors on dashboard pages
- Missing/degraded deployment persistence
- Settings not loading/saving

### Rollback Procedure
1. Revert platform to Supabase-era build
2. Restore Supabase write access
3. Notify affected users if data loss occurred
4. Debug and re-run migration with fixes

## Limitations

1. **Historical deployments**: Only deployments from the last 90 days are migrated
2. **Agent configurations**: Not migrated (not surfaced in v1)
3. **Audit history**: Pre-migration audit data remains in Supabase (read-only)
4. **Provider linking**: Users with multiple providers may need to relink in Firebase console

## Testing the Migration

```bash
# 1. Start Firebase emulators
firebase emulators:start --only firestore,auth

# 2. Run migration with emulated Firestore
MIGRATION_TARGET=emulator node scripts/migrate-to-firestore.ts

# 3. Verify with test queries
firebase firestore:query --emulators localhost:8080 "accounts/test-uid/deployments"

# 4. Run app against emulator
NEXT_PUBLIC_FIREBASE_EMULATOR_HOST=localhost:8080 pnpm dev
```