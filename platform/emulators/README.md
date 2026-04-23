# Firebase Emulator — Local Development

## Prerequisites

Install the Firebase CLI globally (or use npx to skip installation):

```bash
npm install -g firebase-tools
```

## Starting the Emulator

```bash
cd platform
FIREBASE_EMULATOR_HOST=localhost firebase emulators:start --only auth,firestore
```

This starts:
- **Auth emulator** on `http://localhost:9099`
- **Firestore emulator** on `http://localhost:8080`

## Using the Emulator with the App

Set `FIREBASE_EMULATOR_HOST` in `.env.local` (or `.env.development`) to redirect client and admin SDKs:

```env
FIREBASE_EMULATOR_HOST=localhost
```

The client SDK (`src/lib/firebase/client.ts`) auto-connects Auth to the emulator.
The admin SDK (`src/lib/firebase/admin.ts`) auto-configures Firestore to point at the emulator.

## Running Tests Against the Emulator

```bash
# Run unit tests inside the emulator lifecycle
pnpm test:emulator
```

This runs `firebase emulators:exec` which starts the emulator, runs the test command, and shuts down when done.

## Applying Security Rules

Rules in `firestore.rules` are applied automatically when the emulator starts. To force-reload:

```bash
firebase emulators:exec --only firestore --import ./emulators/data --export-on-exit "./emulators/data" 'echo Rules loaded'
```

### Import / Export Test Data

```bash
# Start emulator, import existing data, export when exiting
firebase emulators:exec --only auth,firestore --import ./emulators/data --export-on-exit "./emulators/data" 'pnpm test:unit'
```

## Seeding Test Data

### Via REST API

```bash
curl -X POST "http://localhost:8080/emulators/v1/projects/<PROJECT_ID>/databases/(default)/documents/deployments" \
  -H "Content-Type: application/json" \
  -d '{"accountScope":{"filterType":"ACCOUNT"},"status":"pending","createdAt":{"_seconds":0,"_nanoseconds":0}}'
```

### Via Firestore Client

```ts
import { getFirestore } from "firebase/firestore";
import { connectFirestoreEmulator } from "firebase/firestore";

const db = getFirestore();
connectFirestoreEmulator(db, "localhost", 8080);

await db.collection("deployments").add({
  accountScope: { filterType: "ACCOUNT" },
  status: "pending",
  createdAt: new Date(),
});
```

## Known Limitations

### Auth Emulator

- **Does NOT support Google, GitHub, or other OAuth providers.**
- Use email/password authentication or custom tokens for local testing.
- Password reset emails are logged to the console — they are not sent.
- Custom token sign-in:

```ts
import { getAuth } from "firebase/auth";
import { connectAuthEmulator } from "firebase/auth";

const auth = getAuth();
connectAuthEmulator(auth, "http://localhost:9099");

// Sign in with a custom token (issued by your own backend or generated for testing)
import { signInWithCustomToken } from "firebase/auth";
await signInWithCustomToken(auth, "<custom-token>");
```

### Other Notes

- Emulator state is **in-memory by default**. Use `--import`/`--export` flags to persist across sessions.
- Firestore emulator does not support all query types (e.g., certain array operations). Check [Firebase docs](https://firebase.google.com/docs/firestore/safe-emulator#limitations).
- Security rules are enforced in the emulator, so you can test them before deploying to production.

## Troubleshooting

### Port conflicts

If port 9099 or 8080 is already in use, specify custom ports:

```bash
firebase emulators:start --only auth,firestore --host localhost --port 9099
```

Check running ports:

```bash
lsof -i :8080
lsof -i :9099
```

### Emulator not responding

Verify the emulator is running:

```bash
curl http://localhost:8080/emulators/v1/status
```

Expected response: `{"state":"RUNNING"}`

### Rules not reloading

Emulator does not auto-reload rules on file change. Restart the emulator or use:

```bash
firebase emulators:exec --only firestore --import ./emulators/data --export-on-exit "./emulators/data" 'pnpm test:unit'
```
