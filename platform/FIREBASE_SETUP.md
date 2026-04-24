# Firebase Setup Guide

This guide covers setting up Firebase for the Claw Parade platform migration from Supabase to Firebase Auth + Firestore.

## Prerequisites

- A Google account (for Firebase console access)
- GitHub OAuth app credentials (optional, for GitHub sign-in)

---

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Create a project** (or **Add project**)
3. Enter project name: `claw-parade` (or your preferred name)
4. Disable Google Analytics (optional, for simpler setup)
5. Click **Create project**

Wait for project provisioning to complete.

---

## Step 2: Enable Authentication

1. In Firebase console, go to **Build → Authentication**
2. Click **Get started**
3. Go to **Sign-in method** tab
4. Enable **Google**:
   - Click Google in the provider list
   - Toggle to enable
   - Select your support email
   - Click **Save**
5. (Optional) Enable **GitHub**:
   - Click GitHub in the provider list
   - Toggle to enable
   - You'll need to create a GitHub OAuth app (see Step 2a below)
   - Click **Save**

### Step 2a: GitHub OAuth App (Optional)

If enabling GitHub sign-in:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: Claw Parade (or your app name)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `https://YOUR_PROJECT.firebaseapp.com/__/auth/handler`
4. Click **Register application**
5. Copy the **Client ID**
6. Generate a **Client secret**
7. In Firebase console, paste these into the GitHub provider settings
8. Click **Save**

---

## Step 3: Set Up Firestore Database

1. In Firebase console, go to **Build → Firestore Database**
2. Click **Create database**
3. Select location near your users (e.g., `us-central1`)
4. Start in **Production mode** (or Test mode for development)
5. Click **Create**

Wait for database creation.

---

## Step 4: Get Service Account Credentials

1. In Firebase console, go to **Project settings** (gear icon 🔧)
2. Go to **Service accounts** tab
3. Click **Generate new private key**
4. Confirm (click **Generate key**)
5. The JSON file downloads - keep this secure

You'll need the values from this JSON file for environment variables:

| JSON Field | Env Variable |
|-----------|--------------|
| `project_id` | `FIREBASE_PROJECT_ID` |
| `client_email` | `FIREBASE_CLIENT_EMAIL` |
| `private_key` | `FIREBASE_PRIVATE_KEY` (multiline) |

---

## Step 5: Configure Environment Variables

Create or update `platform/.env.local`:

```bash
# Firebase Project
FIREBASE_PROJECT_ID=your-project-id

# Firebase Auth (client-side - from Firebase console → Project settings → General → "Add app")
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BM... (from Cloud Messaging settings)

# Firebase Admin (server-side - from service account JSON)
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional: Emulator configuration (for local dev)
# FIREBASE_EMULATOR_HOST=localhost:8080
```

### Getting Client-Side Config

1. In Firebase console, go to **Project settings**
2. Scroll to **Your apps** → Web app (</>)
3. Register app (name: "Claw Parade Platform")
4. Copy the `firebaseConfig` object
5. Use those values for the `NEXT_PUBLIC_*` variables

---

## Step 6: Deploy Security Rules

The platform includes Firestore security rules in `platform/firestore.rules`.

To deploy to Firebase:

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools

# Login
firebase login

# Link to project (if not already)
cd platform
firebase use --add

# Deploy rules only (safe - doesn't touch data)
firebase deploy --only firestore:rules
```

Or, to deploy everything:

```bash
firebase deploy
```

---

## Step 7: Local Development with Emulators

For local development without connecting to production Firebase:

### Install Emulators

```bash
cd platform
firebase init emulators
```

Select:
- **Firestore emulator**: Port 8080
- **Auth emulator**: Port 9099
- **Emulator suite**: Latest version
- **Configuration**: Defaults are fine

### Run Emulators

```bash
firebase emulators:start
```

### Connect Platform to Emulators

Set environment variables:

```bash
FIREBASE_EMULATOR_HOST=localhost:8080
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true
```

Or update `.env.local`:

```bash
FIREBASE_EMULATOR_HOST=localhost:8080
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true
```

### Seed Test Data (Optional)

```bash
# In a separate terminal, after emulators are running
firebase firestore:seed
```

---

## Step 8: Verify Setup

### Quick Verification

1. Start the platform:
   ```bash
   cd platform
   pnpm dev
   ```

2. Open http://localhost:3000
3. Click **Continue with Google**
4. Complete sign-in with your Google account
5. Should redirect to dashboard - if it works, Firebase is configured!

### Test Deployment Flow

1. Go to http://localhost:3000/dashboard
2. Fill deployment form:
   - Name: `test-deploy`
   - Environment: `preview`
   - Source Ref: `main`
   - Mock Outcome: `succeeded`
3. Submit - deployment should appear in feed
4. Status should eventually show `succeeded`

### Check Firestore Data

In Firebase console → Firestore Database:
- You should see collection `accounts` with user documents
- Each account should have `settings/current` and `deployments` subcollections

---

## Rollback (If Needed)

If you need to revert to Supabase:

1. Remove Firebase env vars from `.env.local`
2. Restore Supabase environment variables:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
3. Platform code is already compatible - it checks for Firebase first, falls back gracefully

---

## Troubleshooting

### "Auth/network-error" on sign-in

- Check that `NEXT_PUBLIC_FIREBASE_API_KEY` is correct
- Verify the authorized domains in Firebase console → Authentication → Settings

### "Permission denied" errors

- Check Firestore security rules deployed
- Verify you're signed in as the account owner

### Emulator connection errors

- Verify `FIREBASE_EMULATOR_HOST` is set
- Check emulators are running: `firebase emulators:start`

### "Invalid session cookie" errors

- This is normal during development - clear cookies and sign in again
- Or restart emulators if using them

---

## Next Steps

After Firebase is set up:

1. ✅ Run the platform and verify sign-in works
2. ✅ Create a test deployment
3. ✅ Check Firestore console for data
4. Deploy to production when ready:
   ```bash
   firebase deploy
   ```

---

## File Reference

- Security rules: `platform/firestore.rules`
- Migration plan: `.sisyphus/plans/firebase-migration-platform.md`
- Migration tooling: `platform/scripts/migrate-to-firestore.md`