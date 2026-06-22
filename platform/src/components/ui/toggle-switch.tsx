"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export interface ToggleSwitchProps
  extends Omit<HTMLAttributes<HTMLInputElement>, "checked"> {
  checked?: boolean;
  label?: string;
  disabled?: boolean;
  variant?: "default" | "error";
  errorText?: string;
}

export const ToggleSwitch = forwardRef<HTMLInputElement, ToggleSwitchProps>(
  (
    {
      checked,
      label,
      disabled,
      variant = "default",
      errorText,
      id,
      ...props
    },
    ref,
  ) => {
    return (
      <div className="flex flex-col gap-2">
        <label
          htmlFor={id}
          className={cn(
            "inline-flex items-center gap-3 cursor-pointer",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              ref={ref}
              id={id}
              checked={checked}
              disabled={disabled}
              className="peer sr-only"
              {...props}
            />
            <div
              className={cn(
                "w-11 h-6 rounded-full transition-colors duration-200 ease-smooth",
                "bg-black/30 peer-checked:bg-brand-500",
                "border border-[var(--color-shell-border-strong)] peer-checked:border-brand-500",
                variant === "error" && "border-danger-400",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            />
            <div
              className={cn(
                "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-none transition-transform duration-200 ease-snappy",
                "peer-checked:translate-x-5",
                disabled && "opacity-50",
              )}
            />
          </div>
          {label && <span className="text-body text-[var(--color-shell-text-strong)]">{label}</span>}
        </label>
        {errorText && (
          <p className="text-caption text-danger-300 ml-14">{errorText}</p>
        )}
      </div>
    );
  },
);

ToggleSwitch.displayName = "ToggleSwitch";
