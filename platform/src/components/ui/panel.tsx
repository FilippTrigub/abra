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
          "rounded-xl p-4 text-[var(--color-shell-text-strong)] sm:p-5",
          "transition-[background-color,border-color,box-shadow] duration-150 ease-smooth motion-reduce:transition-none",
          bordered && "border border-[var(--color-shell-border-strong)]",
          muted && "bg-black/20",
          !muted && !bordered && "border border-white/10 bg-white/[0.025] shadow-[0_14px_44px_-38px_var(--color-brand-300)]",
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
