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
    <main className="flex min-h-screen items-center justify-center bg-shell-canvas px-4 py-12 text-shell-text-strong sm:py-20">
      <div className="w-full max-w-md border border-shell-border-strong bg-shell-panel p-6 sm:p-8">
        <div className="flex flex-col gap-6">
          {errorPromise && (
            <ErrorBanner searchParams={errorPromise} />
          )}

          <div className="border-b border-white/10 pb-6 text-center">
            <Badge
              variant="brand"
              className="mb-4 rounded-sm border border-white/12 bg-white/5 px-3 py-1 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-shell-signal sm:text-[13px]"
            >
              AI-powered brand management
            </Badge>

            <h1 className="text-[3rem] leading-[0.96] font-display font-extrabold tracking-[-0.05em] text-shell-text-strong sm:text-[3.4rem]">
              Sign In
            </h1>

            <p className="mt-4 text-[1.05rem] leading-7 text-zinc-200 sm:text-[1.15rem]">
              Continue with your account to access the platform.
            </p>
          </div>

          <SignInButtons />

          <div className="flex items-center justify-center gap-2 border-t border-white/10 pt-4 text-caption text-zinc-400">
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
