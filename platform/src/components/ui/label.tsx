"use client";

import { type LabelHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  muted?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, muted, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "block text-body font-medium mb-1.5 text-[var(--color-shell-text-strong)]",
          muted && "text-zinc-500",
          required && "after:content-['*'] after:ml-0.5 after:text-danger-400",
          className
        )}
        {...props}
      >
        {children}
      </label>
    );
  }
);

Label.displayName = "Label";
