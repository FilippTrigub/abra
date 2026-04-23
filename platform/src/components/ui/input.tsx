"use client";

import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type InputVariant = "default" | "error" | "warning" | "success";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
  errorText?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant = "default",
      errorText,
      helperText,
      disabled,
      ...props
    },
    ref
  ) => {
    const stateClass =
      variant === "error"
        ? "input-error border-danger-400 text-danger-700 placeholder-content-400"
        : variant === "warning"
          ? "input-warning border-warning-400 text-warning-700 placeholder-content-400"
          : variant === "success"
            ? "input-success border-success-400 text-success-700 placeholder-content-400"
            : "border-border-default hover:border-border-subtle focus:border-brand-300 focus-ring-brand";

    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            "w-full px-3 py-2 text-body",
            "bg-surface-default border rounded-lg",
            "placeholder-content-400",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-150 ease-smooth",
            stateClass,
            className
          )}
          disabled={disabled}
          {...props}
        />
        {errorText && (
          <p className="mt-1.5 text-caption text-danger-600 flex items-center gap-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M7 4v3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="7" cy="10" r="0.75" fill="currentColor" />
            </svg>
            {errorText}
          </p>
        )}
        {helperText && !errorText && (
          <p className="mt-1.5 text-caption text-content-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
