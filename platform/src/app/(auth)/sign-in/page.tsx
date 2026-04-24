import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";

import { SignInButtons } from "./sign-in-buttons";

export const dynamic = "force-dynamic";

export default function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const errorPromise = searchParams;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:py-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-brand-100/50 blur-3xl" />
        <div className="absolute -top-16 -right-16 h-[500px] w-[500px] rounded-full bg-secondary-100/40 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-accent-50/30 blur-3xl" />
        <div className="absolute inset-0 bg-pattern-dots" style={{ opacity: 0.12 }} />
      </div>

        <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6">
        {errorPromise && (
          <ErrorBanner searchParams={errorPromise} />
        )}
        <div className="flex flex-col items-center gap-2 text-center">
          <Badge variant="brand" className="mb-2">
            AI-powered brand management
          </Badge>
          <h1 className="text-h2 font-display font-bold tracking-tight text-strong">
            Sign In
          </h1>
          <p className="text-body text-muted">
            Continue with your account to access the platform.
          </p>
        </div>

        <SignInButtons />

        <div className="flex items-center gap-2 pt-2 text-caption text-faint">
          <svg className="h-4 w-4" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" className="fill-brand-500" />
            <path
              d="M9 14l3.5 3.5L19 11"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Powered by Abra</span>
        </div>
      </div>
    </main>
  );
}

async function ErrorBanner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (!error) {
    return null;
  }

  const description =
    error === "missing_oauth_code"
      ? "The OAuth provider did not return an authorization code. Please try signing in again."
      : error === "oauth_callback_not_supported"
        ? "This callback can no longer finish sign-in on the server. Return to the sign-in page and try again."
        : error === "oauth_callback_failed"
          ? "The OAuth provider returned an error before sign-in could finish. Please try again."
          : "We could not complete the OAuth sign-in flow. Please try again.";

  return (
    <ErrorState
      className="w-full"
      title="Sign-in failed"
      description={description}
      retryLabel="Try again"
    />
  );
}
