"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export interface ErrorStateProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
}

const DEFAULT_TITLE = "Something went wrong";
const DEFAULT_DESCRIPTION =
  "The platform encountered an unexpected error. Please try again.";

export const ErrorState = forwardRef<HTMLDivElement, ErrorStateProps>(
  ({ className, title, description, retryLabel = "Try again", onRetry, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center rounded-sm border p-8 text-center",
          "border-[color-mix(in_srgb,var(--color-danger-400)_40%,var(--color-shell-border-strong))]",
          "bg-[color-mix(in_srgb,var(--color-danger-900)_26%,var(--color-shell-panel))]",
          className,
        )}
        role="alert"
        {...props}
      >
        <div
          aria-hidden
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-sm border border-danger-400/40 bg-black/20"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-danger-300">
            <path
              d="M12 3.5 21 19.5H3L12 3.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M12 10v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="16.6" r="0.9" fill="currentColor" />
          </svg>
        </div>
        <p className="text-h6 font-semibold text-[var(--color-shell-text-strong)]">
          {title ?? DEFAULT_TITLE}
        </p>
        <p className="mt-2 max-w-sm text-body text-danger-50/80">
          {description ?? DEFAULT_DESCRIPTION}
        </p>
        {retryLabel && (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              "mt-5 inline-flex min-h-11 items-center justify-center rounded-sm bg-danger-500 px-4 py-2 text-body font-semibold text-white shadow-none transition-all duration-150 ease-smooth hover:bg-danger-600",
              !onRetry && "cursor-default opacity-50",
            )}
            disabled={!onRetry}
          >
            {retryLabel}
          </button>
        )}
        {children && (
          <div className="mt-5 w-full max-w-lg">{children}</div>
        )}
      </div>
    );
  },
);

ErrorState.displayName = "ErrorState";
