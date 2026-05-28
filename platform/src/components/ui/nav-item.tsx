"use client";

import { type AnchorHTMLAttributes } from "react";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/cn";

export interface NavItemProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean;
}

export function NavItem({
  className,
  active,
  children,
  href,
  "aria-current": ariaCurrent,
  ...props
}: NavItemProps) {
  const pathname = usePathname();
  const isActive = active ?? (typeof href === "string" && pathname === href);

  return (
    <a
      className={cn(
        "nav-link",
        isActive && "active",
        className
      )}
      href={href}
      aria-current={isActive ? "page" : ariaCurrent}
      {...props}
    >
      {children}
    </a>
  );
}
