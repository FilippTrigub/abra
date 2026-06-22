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
    "border border-brand-400/40 bg-brand-500 text-white hover:bg-brand-600 active:scale-[0.97] focus-ring-brand",
  secondary:
    "border border-secondary-400/40 bg-secondary-600 text-white hover:bg-secondary-700 active:scale-[0.97] focus-ring-secondary",
  ghost:
    "border border-white/12 bg-transparent font-mono text-[12px] uppercase tracking-[0.14em] text-zinc-100 hover:border-white/25 hover:bg-white/[0.04] hover:text-white active:scale-[0.97] focus-ring-brand",
  danger:
    "border border-danger-400/40 bg-danger-500 text-white hover:bg-danger-600 active:scale-[0.97] focus-ring-danger",
  success:
    "border border-success-400/40 bg-success-500 text-white hover:bg-success-600 active:scale-[0.97] focus-ring-success",
  warning:
    "border border-warning-400/40 bg-warning-500 text-white hover:bg-warning-600 active:scale-[0.97] focus-ring-brand",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-caption gap-1.5",
  md: "min-h-11 px-4 py-2 text-body gap-2",
  lg: "min-h-12 px-6 py-3 text-h6 gap-2",
};

const sizeRadius: Record<ButtonSize, string> = {
  sm: "rounded-sm",
  md: "rounded-sm",
  lg: "rounded-sm",
};

const sizeShadow: Record<ButtonSize, string> = {
  sm: "shadow-none",
  md: "shadow-none",
  lg: "shadow-none",
};

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, href, children, ...rest }, ref) => {
    const baseClasses = cn(
      "inline-flex items-center justify-center font-semibold",
      "transition-all duration-200 ease-smooth",
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
