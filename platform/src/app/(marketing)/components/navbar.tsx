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
              <line x1="2.5" y1="6.5" x2="2.5" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="5" y1="5" x2="5" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="7.5" y1="3.5" x2="7.5" y2="12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="10" y1="5.5" x2="10" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12.5" y1="7" x2="12.5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="14.3" cy="8" r="0.7" fill="currentColor" />
            </svg>
          </span>
          <span>ABRA</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="https://github.com/FilippTrigub/abra"
            className="hidden text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-300 transition-colors duration-150 hover:text-white focus-ring-brand sm:inline-flex"
          >
            Repo
          </Link>
          <Link
            href="#workflow"
            className="hidden text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-300 transition-colors duration-150 hover:text-white focus-ring-brand sm:inline-flex"
          >
            Workflow
          </Link>
          <Link
            href="#run-mode"
            className="hidden text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-300 transition-colors duration-150 hover:text-white focus-ring-brand sm:inline-flex"
          >
            Run mode
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/12 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-100 transition-colors duration-150 hover:border-white/25 hover:bg-white/10 hover:text-white focus-ring-brand sm:text-[13px]"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
