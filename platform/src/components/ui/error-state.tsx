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
          "flex flex-col items-center justify-center rounded-2xl border border-danger-200 bg-danger-50/60 p-8 text-center",
          className,
        )}
        role="alert"
        {...props}
      >
        <div
          aria-hidden
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-danger-100 text-2xl"
        >
          ⚠️
        </div>
        <p className="text-h6 font-semibold text-content-100">
          {title ?? DEFAULT_TITLE}
        </p>
        <p className="mt-2 max-w-sm text-body text-content-600">
          {description ?? DEFAULT_DESCRIPTION}
        </p>
        {retryLabel && (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              "mt-5 inline-flex items-center justify-center rounded-xl bg-danger-500 px-4 py-2 text-body font-semibold text-white shadow-card transition-all duration-150 ease-smooth hover:bg-danger-600",
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
