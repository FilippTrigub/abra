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
    "bg-brand-500 text-white hover:bg-brand-600 active:scale-[0.98] focus-ring-brand",
  secondary:
    "bg-secondary-600 text-white hover:bg-secondary-700 active:scale-[0.98] focus-ring-secondary",
  ghost:
    "bg-transparent text-content-500 hover:bg-surface-100 hover:text-content-100 active:scale-[0.98] focus-ring-brand",
  danger:
    "bg-danger-500 text-white hover:bg-danger-600 active:scale-[0.98] focus-ring-danger",
  success:
    "bg-success-500 text-white hover:bg-success-600 active:scale-[0.98] focus-ring-success",
  warning:
    "bg-warning-500 text-white hover:bg-warning-600 active:scale-[0.98] focus-ring-brand",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-caption gap-1.5",
  md: "px-4 py-2 text-body gap-2",
  lg: "px-6 py-3 text-h6 gap-2",
};

const sizeRadius: Record<ButtonSize, string> = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
};

const sizeShadow: Record<ButtonSize, string> = {
  sm: "shadow-card",
  md: "shadow-panel",
  lg: "shadow-card",
};

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, href, children, ...rest }, ref) => {
    const baseClasses = cn(
      "inline-flex items-center justify-center font-semibold",
      "transition-all duration-150 ease-smooth",
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
