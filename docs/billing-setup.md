To enable billing in the deployed platform, you need the existing platform env plus the new billing-specific server env vars.
Growth plan contract
Growth is the only paid tier currently supported:
- Price: 30 EUR/month, configured as a recurring Stripe Price.
- Included usage: 100 managed inbound messages per fixed UTC week.
- Quota authority: Abra's admission ledger, not Stripe metadata. Keep `platform/src/lib/billing/contracts.ts` and the Stripe product/price metadata aligned.
Required billing env vars
Stripe billing
Set these on the platform/server deployment:
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_GROWTH_PRICE_ID=price_...
What they do:
- STRIPE_SECRET_KEY — server-side Stripe API key.
- STRIPE_WEBHOOK_SECRET — signing secret for /api/billing/webhook.
- STRIPE_GROWTH_PRICE_ID — the recurring 30 EUR/month Stripe Price ID for the only paid tier: growth.
Do not set any NEXT_PUBLIC_STRIPE_* secret. The implementation intentionally keeps Stripe secret config server-only.
Required managed-runtime admission env vars
For managed deployed runtimes to enforce quota before processing inbound Hermes messages, set these on the platform/server deployment:
ABRA_MANAGED_ADMISSION_URL=https://your-platform-domain.com/api/billing/admission
ABRA_MANAGED_RUNTIME_CREDENTIAL_SECRET=<long-random-secret>
What they do:
- ABRA_MANAGED_ADMISSION_URL — platform endpoint injected into managed runtime pods.
- ABRA_MANAGED_RUNTIME_CREDENTIAL_SECRET — server-only secret used to derive per-account/per-deployment runtime credentials.
The platform injects these runtime env vars into managed pods automatically when configured:
ABRA_MANAGED_RUNTIME=1
ABRA_MANAGED_ADMISSION_URL=...
ABRA_MANAGED_ACCOUNT_ID=...
ABRA_MANAGED_DEPLOYMENT_ID=...
ABRA_MANAGED_RUNTIME_CREDENTIAL=...
Those are platform-owned and should not be user-managed.
Optional/admin reconciliation env var
For the internal reconciliation report endpoint:
ABRA_BILLING_RECONCILIATION_SECRET=<long-random-secret>
This protects:
GET /api/internal/billing/reconciliation
Authorization: Bearer <ABRA_BILLING_RECONCILIATION_SECRET>
Without it, the reconciliation endpoint returns unavailable/unauthorized and will not run.
Existing non-billing env still required
Billing depends on the platform being functional, so these still need to be set as before:
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
For managed AKS runtime deployment:
AKS_RUNTIME_IMAGE=
# plus one of:
KUBECONFIG_B64=
# or in-cluster/workload identity config:
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_FEDERATED_TOKEN_FILE=
And existing runtime model access as needed:
AZURE_FOUNDRY_API_KEY=
What still needs to be done operationally
1. Create Stripe products/prices
In Stripe:
1. Create a product for the Growth plan.
2. Create a recurring Price for 30 EUR/month.
3. Set metadata on the product/price for operator clarity:
   - plan=growth
   - included_messages=100
4. Put that Price ID in:
STRIPE_GROWTH_PRICE_ID=price_...
Only this one paid plan is supported right now.
2. Configure Stripe webhook
Create a Stripe webhook endpoint pointing to:
https://your-platform-domain.com/api/billing/webhook
At minimum, subscribe to:
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
Then set the endpoint signing secret:
STRIPE_WEBHOOK_SECRET=whsec_...
3. Enable Stripe Customer Portal
The app has a /api/billing/portal route for Growth users, but Stripe Customer Portal must be configured in the Stripe Dashboard for the environment you are using.
4. Deploy the platform with new env vars
Add the new env vars to your hosting provider/Vercel/container environment, then redeploy.
Minimum billing set:
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_GROWTH_PRICE_ID=
ABRA_MANAGED_ADMISSION_URL=
ABRA_MANAGED_RUNTIME_CREDENTIAL_SECRET=
Optional but recommended:
ABRA_BILLING_RECONCILIATION_SECRET=
5. Verify checkout and webhook flow
After deploy:
1. Sign in as a user.
2. Visit /dashboard/billing.
3. Click Upgrade.
4. Complete Stripe Checkout in test mode first.
5. Confirm webhook updates Firestore:
- accounts/{accountId}/billing/internal
- accounts/{accountId}/summaries/billing
- stripeWebhookEvents/{eventId}
6. Verify managed admission in runtime pods
For managed runtime pods, confirm the generated runtime secret includes:
ABRA_MANAGED_RUNTIME=1
ABRA_MANAGED_ADMISSION_URL=...
ABRA_MANAGED_ACCOUNT_ID=...
ABRA_MANAGED_DEPLOYMENT_ID=...
ABRA_MANAGED_RUNTIME_CREDENTIAL=...
If these are absent, managed message quota enforcement will not run inside Hermes.
7. Schedule reconciliation if desired
The internal reconciliation endpoint exists, but you still need to call it from your scheduler/cron/admin automation.
Example request:
curl -H "Authorization: Bearer $ABRA_BILLING_RECONCILIATION_SECRET" \
  https://your-platform-domain.com/api/internal/billing/reconciliation
You can wire this into a cron job, Vercel Cron, GitHub Actions, or any internal scheduler.
