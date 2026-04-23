"use client";

import { type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type TextareaVariant = "default" | "error" | "warning" | "success";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: TextareaVariant;
  errorText?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant = "default", errorText, helperText, disabled, ...props }, ref) => {
    const stateClass =
      variant === "error"
        ? "input-error border-danger-400 text-danger-700"
        : variant === "warning"
          ? "input-warning border-warning-400 text-warning-700"
          : variant === "success"
            ? "input-success border-success-400 text-success-700"
            : "border-border-default hover:border-border-subtle focus:border-brand-300 focus-ring-brand";

    return (
      <div className="w-full">
        <textarea
          ref={ref}
          className={cn(
            "w-full rounded-2xl border bg-surface-default px-4 py-3 text-body text-content-100",
            "placeholder-content-400 disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-150 ease-smooth",
            stateClass,
            className,
          )}
          disabled={disabled}
          {...props}
        />
        {errorText ? (
          <p className="mt-1.5 flex items-center gap-1 text-caption text-danger-600">{errorText}</p>
        ) : helperText ? (
          <p className="mt-1.5 text-caption text-content-500">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
