"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type BadgeVariant =
  | "default"
  | "brand"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-zinc-300",
  brand:
    "border-brand-400/40 bg-[color-mix(in_srgb,var(--color-brand-900)_30%,var(--color-shell-panel))] text-brand-200",
  secondary:
    "border-secondary-400/40 bg-[color-mix(in_srgb,var(--color-secondary-900)_30%,var(--color-shell-panel))] text-secondary-200",
  success:
    "border-success-400/40 bg-[color-mix(in_srgb,var(--color-success-900)_30%,var(--color-shell-panel))] text-success-200",
  warning:
    "border-warning-400/40 bg-[color-mix(in_srgb,var(--color-warning-900)_30%,var(--color-shell-panel))] text-warning-200",
  danger:
    "border-danger-400/40 bg-[color-mix(in_srgb,var(--color-danger-900)_28%,var(--color-shell-panel))] text-danger-200",
  info:
    "border-info-400/40 bg-[color-mix(in_srgb,var(--color-info-900)_30%,var(--color-shell-panel))] text-info-200",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1",
          "font-mono text-[11px] font-semibold uppercase tracking-[0.14em]",
          "transition-colors duration-150 ease-smooth",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";
