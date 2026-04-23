"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type EmptyStateVariant = "default" | "teaser";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: EmptyStateVariant;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon = "📭", title, description, action, variant = "default", children, ...props }, ref) => {
    const isTeaser = variant === "teaser";

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center",
          isTeaser ? "py-16 md:py-24" : "py-12",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl",
            isTeaser
              ? "bg-gradient-blob text-3xl shadow-card"
              : "bg-surface-muted text-2xl",
          )}
          aria-hidden
        >
          {icon}
        </div>
        <p className={cn(
          "font-semibold text-content-100",
          isTeaser ? "text-h4" : "text-h6",
        )}>
          {title}
        </p>
        {description && (
          <p className="mt-2 max-w-sm text-body text-content-500">
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
