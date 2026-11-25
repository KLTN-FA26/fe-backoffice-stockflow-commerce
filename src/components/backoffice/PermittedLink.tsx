"use client";

import Link from "next/link";

import { useCan } from "@/lib/auth/components/Can";

import type { MouseEvent, ReactNode } from "react";
import type { PermissionCode } from "@/lib/auth";

/**
 * Link to a back-office page, rendered only when the viewer may open that page (its `VIEW_PAGE` code). Without it the
 * label is plain text (`fallback` overrides, `null` hides it), so nobody follows a link into a 403 page (AUTH-8).
 * UI-only: Backend phải re-check — the target page and its API check the permission again.
 */
export function PermittedLink({
  permission,
  href,
  className,
  plainClassName,
  fallback,
  onClick,
  children,
}: {
  permission: PermissionCode;
  href: string;
  className?: string;
  plainClassName?: string;
  fallback?: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}) {
  const allowed = useCan(permission);
  if (!allowed)
    return fallback === undefined ? (
      <span className={plainClassName}>{children}</span>
    ) : (
      <>{fallback}</>
    );
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
