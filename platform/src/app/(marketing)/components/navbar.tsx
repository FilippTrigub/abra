import Link from "next/link";

export function Navbar() {
  return (
    <header className="border-b border-white/10 bg-[#05070b] text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex items-center gap-3 text-h6 font-semibold tracking-[0.12em] text-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-white/5 transition-colors duration-150 group-hover:bg-white/10">
            <svg
              className="h-4 w-4 text-[#7CFFB2]"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 4.5H9.5L13 8L9.5 11.5H3V4.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M5.5 8H10.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span>ABRA</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/12 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-200 transition-colors duration-150 hover:border-white/25 hover:bg-white/10 hover:text-white focus-ring-brand"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
