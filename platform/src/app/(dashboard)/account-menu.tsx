"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/auth/actions";

interface AccountMenuProps {
  displayName: string;
}

const menuItemClassName =
  "focus-ring-brand flex w-full items-center px-4 py-2.5 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-300 transition-colors duration-150 ease-smooth hover:bg-white/[0.03] hover:text-white";

export function AccountMenu({ displayName }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleMouseDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
        className="focus-ring-brand flex items-center gap-2 rounded-sm px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/54 transition-colors duration-150 ease-smooth hover:bg-white/[0.03] hover:text-white"
      >
        <span title={displayName} className="max-w-[7rem] truncate sm:max-w-[10rem] lg:max-w-none">
          {displayName}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 transition-transform duration-150 ease-smooth motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M3 5l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+var(--s-2))] z-[var(--z-dropdown)] w-48 rounded-sm border border-[var(--color-shell-border-strong)] bg-[color-mix(in_srgb,var(--color-shell-panel)_86%,black)] py-1 shadow-none"
        >
          <a
            href="/dashboard/deployments"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={menuItemClassName}
          >
            Usage
          </a>
          <a
            href="/dashboard/onboarding?restart=1"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={menuItemClassName}
          >
            Restart onboarding
          </a>
          <div className="my-1 border-t border-[var(--color-shell-border-strong)]" />
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={menuItemClassName}
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
