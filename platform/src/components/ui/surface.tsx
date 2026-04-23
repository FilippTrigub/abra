"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type SurfaceVariant = "default" | "muted" | "elevated";

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
}

const variantClasses: Record<SurfaceVariant, string> = {
  default: "bg-surface-default",
  muted: "bg-surface-muted",
  elevated: "bg-surface-default shadow-elevated",
};

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl p-6",
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
