"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  tone?: ToastTone;
  message: string | null;
}

const toneClasses: Record<ToastTone, string> = {
  success:
    "border-success-400/40 bg-[color-mix(in_srgb,var(--color-success-900)_34%,var(--color-shell-panel))] text-success-50",
  error:
    "border-danger-400/40 bg-[color-mix(in_srgb,var(--color-danger-900)_32%,var(--color-shell-panel))] text-danger-50",
  warning:
    "border-warning-400/40 bg-[color-mix(in_srgb,var(--color-warning-900)_34%,var(--color-shell-panel))] text-warning-50",
  info:
    "border-info-400/40 bg-[color-mix(in_srgb,var(--color-info-900)_34%,var(--color-shell-panel))] text-info-50",
};

/**
 * Fixed-position status message — replaces inline `Panel` banners that
 * push layout around every time a save/delete flow reports a result.
 */
export const Toast = forwardRef<HTMLDivElement, ToastProps>(
  ({ className, tone = "info", message, ...props }, ref) => {
    if (!message) return null;

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(
          "fixed inset-x-4 bottom-6 z-[var(--z-tooltip)] mx-auto w-fit max-w-[calc(100%-2rem)] sm:max-w-md",
          "rounded-sm border px-4 py-3 text-body font-medium shadow-none",
          "animate-fade-up break-words text-left",
          toneClasses[tone],
          className,
        )}
        {...props}
      >
        {message}
      </div>
    );
  },
);

Toast.displayName = "Toast";
