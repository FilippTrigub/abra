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
          "bg-surface-default rounded-2xl p-6",
          "shadow-card",
          "transition-all duration-200 ease-smooth",
          interactive &&
            "cursor-pointer hover:shadow-elevated hover:-translate-y-1 active:scale-[0.99] active:translate-y-0",
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
