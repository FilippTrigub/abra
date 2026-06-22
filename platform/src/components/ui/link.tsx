"use client";

import { type AnchorHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type LinkVariant = "brand" | "secondary" | "muted" | "danger";

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: LinkVariant;
  underline?: "hover" | "always" | "none";
}

const variantClasses: Record<LinkVariant, string> = {
  brand: "text-brand-400 hover:text-brand-300",
  secondary: "text-secondary-400 hover:text-secondary-300",
  muted: "text-zinc-400 hover:text-white",
  danger: "text-danger-400 hover:text-danger-300",
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  (
    {
      className,
      variant = "brand",
      underline = "hover",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <a
        ref={ref}
        className={cn(
          "inline-flex items-center font-medium",
          "transition-colors duration-150 ease-smooth",
          "focus-ring-brand",
          variantClasses[variant],
          underline === "hover" && "hover:underline underline-offset-4",
          underline === "none" && "no-underline",
          underline === "always" && "underline underline-offset-4",
          className
        )}
        {...props}
      >
        {children}
      </a>
    );
  }
);

Link.displayName = "Link";
