"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type EmptyStateVariant = "default" | "teaser";

const DEFAULT_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M3 9.5 12 4l9 5.5M3 9.5V18a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9.5M3 9.5l5.5 4h7L21 9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: EmptyStateVariant;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon = DEFAULT_ICON, title, description, action, variant = "default", children, ...props }, ref) => {
    const isTeaser = variant === "teaser";

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center text-[var(--color-shell-text-strong)]",
          isTeaser ? "py-16 md:py-24" : "py-12",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "mb-4 flex items-center justify-center rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 text-zinc-400",
            isTeaser ? "h-20 w-20" : "h-16 w-16",
          )}
          aria-hidden
        >
          {icon}
        </div>
        <p className={cn(
          "font-semibold text-[var(--color-shell-text-strong)]",
          isTeaser ? "text-h4" : "text-h6",
        )}>
          {title}
        </p>
        {description && (
          <p className="mt-2 max-w-sm text-body text-zinc-400">
            {description}
          </p>
        )}
        {action && (
          <div className="mt-5">{action}</div>
        )}
        {children && (
          <div className="mt-5 w-full max-w-lg">{children}</div>
        )}
      </div>
    );
  },
);

EmptyState.displayName = "EmptyState";
