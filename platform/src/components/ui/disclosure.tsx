"use client";

import { type HTMLAttributes, type ReactNode, forwardRef } from "react";
import { cn } from "../../lib/cn";

export interface DisclosureProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  summary: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export const Disclosure = forwardRef<HTMLDivElement, DisclosureProps>(
  ({ className, summary, open, onOpenChange, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20",
          className,
        )}
        {...props}
      >
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          className="focus-ring-brand flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors duration-150 ease-smooth hover:bg-white/[0.03]"
        >
          {summary}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            className={cn(
              "shrink-0 text-zinc-500 transition-transform duration-150 ease-smooth motion-reduce:transition-none",
              open && "rotate-180",
            )}
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
          <div className="border-t border-[var(--color-shell-border-strong)] px-4 py-4">
            {children}
          </div>
        )}
      </div>
    );
  },
);

Disclosure.displayName = "Disclosure";
