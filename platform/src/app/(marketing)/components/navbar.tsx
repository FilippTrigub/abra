import Link from "next/link";

export function Navbar() {
  return (
    <header className="border-b border-border-subtle bg-surface-default">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-h5 font-bold text-strong"
        >
          <svg
            className="h-7 w-7"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="14"
              cy="14"
              r="13"
              className="fill-brand-500"
            />
            <path
              d="M9 14l3.5 3.5L19 11"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="tracking-tight">Abra</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2 text-caption font-semibold text-muted transition-colors duration-150 hover:text-strong focus-ring-brand"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
