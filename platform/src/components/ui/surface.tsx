"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type SurfaceVariant = "default" | "muted" | "elevated";

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
}

const variantClasses: Record<SurfaceVariant, string> = {
  default: "border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)]",
  muted: "bg-black/20",
  elevated: "border border-white/[0.14] bg-[var(--color-shell-panel)]",
};

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-sm p-6 text-[var(--color-shell-text-strong)]",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Surface.displayName = "Surface";
