"use client";

import { type ButtonHTMLAttributes, type AnchorHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  type?: "button" | "submit" | "reset";
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-brand-300/50 bg-brand-500 text-white hover:border-brand-200/70 hover:bg-brand-600 active:scale-[0.98] focus-ring-brand",
  secondary:
    "border border-secondary-300/50 bg-secondary-600 text-white hover:border-secondary-200/70 hover:bg-secondary-700 active:scale-[0.98] focus-ring-secondary",
  ghost:
    "border border-white/12 bg-white/[0.025] text-zinc-100 hover:border-white/25 hover:bg-white/[0.055] hover:text-white active:scale-[0.98] focus-ring-brand",
  danger:
    "border border-danger-300/50 bg-danger-500 text-white hover:border-danger-200/70 hover:bg-danger-600 active:scale-[0.98] focus-ring-danger",
  success:
    "border border-success-300/50 bg-success-500 text-white hover:border-success-200/70 hover:bg-success-600 active:scale-[0.98] focus-ring-success",
  warning:
    "border border-warning-300/50 bg-warning-500 text-white hover:border-warning-200/70 hover:bg-warning-600 active:scale-[0.98] focus-ring-brand",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-[11px] gap-1.5",
  md: "min-h-10 px-4 py-2 text-[12px] gap-2",
  lg: "min-h-11 px-5 py-2.5 text-[12px] sm:px-6 sm:text-[13px] gap-2",
};

const sizeRadius: Record<ButtonSize, string> = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-xl",
};

const sizeShadow: Record<ButtonSize, string> = {
  sm: "shadow-none",
  md: "shadow-none",
  lg: "shadow-none",
};

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, href, children, ...rest }, ref) => {
    const baseClasses = cn(
      "inline-flex items-center justify-center whitespace-nowrap font-mono font-semibold uppercase tracking-[0.13em]",
      "transition-[background-color,border-color,box-shadow,color,transform] duration-200 ease-snappy motion-reduce:transition-none motion-reduce:transform-none",
      variantClasses[variant],
      sizeClasses[size],
      sizeRadius[size],
      sizeShadow[size],
      className,
    );

    if (href) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={baseClasses}
          href={href}
          {...(rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {children}
        </a>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={cn(baseClasses, disabled && "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed")}
        disabled={disabled}
        {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
