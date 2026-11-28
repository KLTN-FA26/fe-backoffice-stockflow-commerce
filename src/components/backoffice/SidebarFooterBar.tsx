"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import { Ellipsis } from "lucide-react";

import { ACCOUNT_MENU_LABELS as L, APP_ROUTES } from "@/constants";
import { logoutApi } from "@/lib/auth/auth-api";
import { useAuthStore } from "@/lib/auth/auth-store";

import { Button } from "@/components/ui/button";
import { SidebarFooter, useSidebar } from "@/components/ui/sidebar";

import { AccountMenuPanel, UserAvatar } from "./AccountMenuPanel";

import type { ReactNode } from "react";

const MENU =
  "border-border-default bg-bg-surface absolute bottom-full z-[801] mb-2 w-64 overflow-hidden rounded-[var(--r-md)] border shadow-[var(--sh-lg)]";

/** Nút tròn có viền ở đáy sidebar (3 chấm, chuông) — cùng một kiểu. */
export const FOOTER_ROUND_BUTTON =
  "border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary aria-expanded:bg-bg-muted aria-expanded:text-ink-primary size-7 shrink-0 rounded-full border p-0";

/** Popup mở lên trên từ đáy sidebar; lớp phủ trong suốt để bấm ra ngoài thì đóng, Esc cũng đóng. */
function UpMenu({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { state } = useSidebar();

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[800]" onClick={onClose} />
      <div className={cn(MENU, state === "collapsed" ? "bottom-0 left-full mb-0 ml-2" : "left-0")}>
        {children}
      </div>
    </>
  );
}

/**
 * Tài khoản đang đăng nhập — bấm avatar hoặc nút 3 chấm bên phải đều mở cùng menu (hồ sơ, cài đặt,
 * giao diện hệ thống / sáng / tối, đăng xuất) lên trên.
 */
function UserMenu() {
  const router = useRouter();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentUser = useAuthStore((s) => s.user);
  const name = currentUser?.fullName ?? L.fallbackName;
  const [open, setOpen] = useState(false);

  function handleChangePassword() {
    setOpen(false);
    router.push(APP_ROUTES.changePassword);
  }

  async function handleLogout() {
    setOpen(false);
    try {
      await logoutApi();
    } finally {
      router.replace(APP_ROUTES.login);
      router.refresh();
    }
  }

  return (
    <div className={cn("relative", !collapsed && "flex min-w-0 flex-1 items-center gap-1")}>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        aria-label={L.open}
        aria-expanded={open}
        title={collapsed ? name : undefined}
        className={cn(
          "hover:bg-bg-muted h-auto bg-transparent transition-colors",
          collapsed
            ? "size-7 rounded-full p-0"
            : "min-w-0 flex-1 shrink justify-start gap-2 rounded-[var(--r-sm)] px-1 py-0.5",
        )}
      >
        <UserAvatar name={name} />
        {/* Chỉ tên cạnh avatar (vai trò xem trong menu) — căn giữa theo chiều dọc với avatar */}
        {!collapsed && (
          <span className="text-ink-primary min-w-0 truncate text-xs leading-none font-medium">
            {name}
          </span>
        )}
      </Button>
      {!collapsed && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen((o) => !o)}
          aria-label={L.options}
          aria-expanded={open}
          className={FOOTER_ROUND_BUTTON}
        >
          <Ellipsis className="size-3.5" />
        </Button>
      )}
      {open && (
        <UpMenu onClose={() => setOpen(false)}>
          <AccountMenuPanel
            name={name}
            email={currentUser?.email}
            roles={currentUser?.roles ?? []}
            onClose={() => setOpen(false)}
            onChangePassword={handleChangePassword}
            onLogout={handleLogout}
          />
        </UpMenu>
      )}
    </div>
  );
}

/**
 * Đáy sidebar cố định: tài khoản (avatar + tên + vai trò + nút 3 chấm) và `extra` (chuông thông báo)
 * cạnh nó. Ngoài vùng cuộn của menu.
 */
export function SidebarFooterBar({ extra }: { extra?: ReactNode } = {}) {
  const { state } = useSidebar();

  return (
    <SidebarFooter
      className={cn(
        "border-border-default shrink-0 border-t px-2 py-1.5",
        state === "collapsed" ? "flex-col items-center gap-1" : "flex-row items-center gap-1",
      )}
    >
      <UserMenu />
      {extra}
    </SidebarFooter>
  );
}
