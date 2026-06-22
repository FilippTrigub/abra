"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
  muted?: boolean;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, bordered, muted, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-sm p-4 text-[var(--color-shell-text-strong)]",
          "transition-all duration-150 ease-smooth",
          bordered && "border border-[var(--color-shell-border-strong)]",
          muted && "bg-black/20",
          !muted && !bordered && "border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] shadow-none",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Panel.displayName = "Panel";
