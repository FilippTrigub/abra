"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface-default/80 backdrop-blur-xl">
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
            className={cn(
              "hidden text-caption font-medium text-muted hover:text-strong sm:inline-flex",
              "transition-colors duration-150"
            )}
          >
            Sign In
          </Link>
          <Link href="/sign-in" className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-caption font-semibold shadow-card transition-all duration-150 ease-smooth bg-brand-500 text-white hover:bg-brand-600 active:scale-[0.98] focus-ring-brand md:px-5 md:py-2.5">
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}
