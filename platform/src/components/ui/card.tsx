"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-sm border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] p-6 text-[var(--color-shell-text-strong)]",
          "shadow-none",
          "transition-all duration-200 ease-smooth",
          interactive &&
            "cursor-pointer hover:border-white/[0.14] hover:bg-white/[0.03] active:scale-[0.99]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
