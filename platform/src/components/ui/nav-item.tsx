import { type AnchorHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export interface NavItemProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean;
}

export function NavItem({ className, active, children, ...props }: NavItemProps) {
  return (
    <a
      className={cn(
        "nav-link",
        active && "active",
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
}
