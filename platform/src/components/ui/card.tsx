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
          "rounded-2xl border border-white/12 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-shell-panel)_94%,white)_0%,color-mix(in_srgb,var(--color-shell-panel)_84%,black)_100%)] p-6 text-[var(--color-shell-text-strong)] shadow-[0_24px_80px_-60px_var(--color-brand-300)] sm:p-7",
          "transition-[background-color,border-color,box-shadow,transform] duration-300 ease-snappy motion-reduce:transition-none motion-reduce:transform-none",
          interactive &&
            "cursor-pointer hover:border-white/[0.18] hover:bg-white/[0.035] hover:shadow-[0_28px_86px_-58px_var(--color-brand-300)] active:scale-[0.995]",
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
