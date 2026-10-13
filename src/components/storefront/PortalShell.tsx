"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, FlaskConical, LogOut } from "lucide-react";
import { cn } from "cn";

import {
  APP_ROUTES,
  PORTAL_ROUTES,
  QUOTE_PERMISSIONS,
  SAMPLE_REQUEST_PERMISSIONS,
} from "@/constants";
import { logoutApi } from "@/lib/auth/auth-api";
import { useAuthStore } from "@/lib/auth/auth-store";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";
import type { PermissionCode } from "@/lib/auth/me-permissions";

interface PortalNavItem {
  label: string;
  href: string;
  icon: typeof FileText;
  permission: PermissionCode;
}

/** Menu portal khách B2B — ẩn mục thiếu quyền (UI-only, BE re-check từng API). */
const PORTAL_NAV: PortalNavItem[] = [
  {
    label: "Báo giá",
    href: PORTAL_ROUTES.quotes.list,
    icon: FileText,
    permission: QUOTE_PERMISSIONS.read,
  },
  {
    label: "Mẫu thử",
    href: PORTAL_ROUTES.samples.list,
    icon: FlaskConical,
    permission: SAMPLE_REQUEST_PERMISSIONS.read,
  },
];

/** Khung portal khách hàng (Mode B) — header mỏng, mobile-first, tách khỏi back-office. */
export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const can = usePermissionChecker();
  const items = PORTAL_NAV.filter((item) => can(item.permission));

  async function handleLogout() {
    try {
      await logoutApi();
    } finally {
      router.replace(APP_ROUTES.login);
      router.refresh();
    }
  }

  return (
    <div data-mode="storefront" className="bg-bg-base text-ink-primary flex min-h-screen flex-col">
      <header className="bg-bg-surface border-border-default sticky top-0 z-[100] border-b shadow-[var(--sh-md)]">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href={PORTAL_ROUTES.home} aria-label="Trang chủ portal khách hàng">
            <Logo height={28} />
          </Link>
          <nav
            aria-label="Portal khách hàng"
            className="order-3 flex w-full gap-1 sm:order-none sm:w-auto"
          >
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-brand inline-flex min-h-11 items-center gap-2 rounded-[var(--r-md)] px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none",
                    active
                      ? "bg-bg-muted text-ink-primary"
                      : "text-ink-secondary hover:bg-bg-muted",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-ink-secondary hidden max-w-[220px] truncate text-sm sm:inline">
              {user?.fullName ?? user?.email ?? user?.username}
            </span>
            <Button variant="outline" className="min-h-11" onClick={() => void handleLogout()}>
              <LogOut className="size-4" aria-hidden="true" /> Đăng xuất
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
