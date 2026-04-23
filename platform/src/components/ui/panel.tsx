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
          "rounded-xl p-4",
          "transition-all duration-150 ease-smooth",
          bordered && "border border-border-subtle",
          muted && "bg-surface-muted",
          !muted && !bordered && "bg-surface-default shadow-card",
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
