"use client";

import { type SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type SelectVariant = "default" | "error" | "warning" | "success";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  variant?: SelectVariant;
  errorText?: string;
  helperText?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      variant = "default",
      errorText,
      helperText,
      options,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const stateClass =
      variant === "error"
        ? "input-error border-danger-400 text-white"
        : variant === "warning"
          ? "input-warning border-warning-400 text-white"
          : variant === "success"
            ? "input-success border-success-400 text-white"
            : "border-[var(--color-shell-border-strong)] hover:border-white/20 focus:border-brand-300 focus-ring-brand";

    return (
      <div className="w-full">
        <select
          ref={ref}
          className={cn(
            "w-full px-3 py-2 text-body text-white appearance-none",
            "bg-black/20 border rounded-sm",
            "placeholder-zinc-500",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-150 ease-smooth",
            stateClass,
            className,
          )}
          disabled={disabled}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          {children}
        </select>
        {errorText && (
          <p className="mt-1.5 text-caption text-danger-300 flex items-center gap-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="7"
                cy="7"
                r="6"
                stroke="currentColor"
                strokeWidth="1.5"
              />
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
          <p className="mt-1.5 text-caption text-zinc-500">{helperText}</p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
