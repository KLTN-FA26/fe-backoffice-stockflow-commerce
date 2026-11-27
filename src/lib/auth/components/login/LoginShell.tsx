"use client";

import { cn } from "cn";
import { ArrowLeft, Moon, ShieldCheck, Sun } from "lucide-react";
import Link from "next/link";

import { APP_ROUTES, BRAND } from "@/constants";
import { LOGIN_UI } from "@/constants/labels-login";

import { DotBackdrop, GLASS_PANEL_CLASS } from "@/components/shared/DotBackdrop";
import { Logo } from "@/components/shared/Logo";
import { useTheme } from "@/components/theme-provider";

import type { ReactNode } from "react";

interface LoginShellProps {
  isMock: boolean;
  children: ReactNode;
}

const PILL_CLASS =
  "border-bg-surface/60 bg-bg-surface/70 text-ink-secondary hover:text-ink-primary focus-visible:ring-border-strong flex items-center rounded-full border backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:outline-none";

/** Nút đổi sáng/tối — cùng `useTheme` với footer sidebar, lưu vào `useAppStore.theme`. */
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? LOGIN_UI.themeToLight : LOGIN_UI.themeToDark}
      title={isDark ? LOGIN_UI.themeToLight : LOGIN_UI.themeToDark}
      className={`${PILL_CLASS} size-8 justify-center`}
    >
      {isDark ? (
        <Sun className="size-3.5" aria-hidden="true" />
      ) : (
        <Moon className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Trang đăng nhập: nền chấm + đốm màu mờ, form nằm giữa trong khung kính
 * (nền surface trong suốt + `backdrop-blur`) để đốm màu phía sau nhoè qua.
 */
export function LoginShell({ isMock, children }: LoginShellProps) {
  return (
    <div className="bg-bg-base relative isolate flex min-h-screen flex-col overflow-hidden">
      <DotBackdrop />

      <header className="absolute top-0 right-0 z-10 flex items-center gap-3 px-5 py-4 sm:px-8">
        {isMock && (
          <span className="border-warning/30 bg-bg-surface/80 text-warning-ink rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
            {LOGIN_UI.demoBadge}
          </span>
        )}
        <Link href={APP_ROUTES.home} className={`${PILL_CLASS} h-8 gap-1.5 px-3 text-sm`}>
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {LOGIN_UI.backHome}
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pt-16 pb-10 sm:py-10 [@media(max-height:680px)]:py-4">
        <div
          className={cn(
            GLASS_PANEL_CLASS,
            "w-full max-w-[420px] p-6 sm:p-8 [@media(max-height:680px)]:p-6",
          )}
        >
          <Link
            href={APP_ROUTES.home}
            aria-label={LOGIN_UI.homeAria}
            className="focus-visible:ring-border-strong mb-6 flex w-fit items-center gap-2.5 rounded-[var(--r-sm)] focus-visible:ring-2 focus-visible:outline-none"
          >
            <Logo variant="mark" height={30} decorative />
            <span className="text-ink-primary text-base font-semibold whitespace-nowrap">
              {BRAND.wordmark.primary}
              {BRAND.wordmark.accent}
              <span className="text-ink-secondary ml-1 font-normal">{BRAND.wordmark.suffix}</span>
            </span>
          </Link>

          {children}

          <div className="border-border-default/70 text-ink-tertiary mt-6 flex items-center justify-between gap-3 border-t pt-4 text-xs">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="text-positive size-3.5 shrink-0" aria-hidden="true" />
              {LOGIN_UI.footerNotice}
            </span>
            <span className="shrink-0">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
