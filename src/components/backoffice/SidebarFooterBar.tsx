"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import { Ellipsis, KeyRound, LogOut, Moon, Settings, Sun, User } from "lucide-react";

import { APP_ROUTES } from "@/constants";
import { logoutApi } from "@/lib/auth/auth-api";
import { useAuthStore } from "@/lib/auth/auth-store";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { SidebarFooter, useSidebar } from "@/components/ui/sidebar";

import type { ReactNode } from "react";

const MENU =
  "border-border-default bg-bg-surface absolute bottom-full z-[801] mb-1 w-64 rounded-[var(--r-md)] border py-1 shadow-[var(--sh-lg)]";
const MENU_ITEM =
  "text-ink-secondary hover:bg-bg-muted hover:text-ink-primary h-auto w-full justify-start gap-2 rounded-none bg-transparent px-3 py-1.5 text-[0.8125rem] transition-colors";

/** Popup mở lên trên từ đáy sidebar; lớp phủ trong suốt để bấm ra ngoài thì đóng. */
function UpMenu({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { state } = useSidebar();
  return (
    <>
      <div className="fixed inset-0 z-[800]" onClick={onClose} />
      <div className={cn(MENU, state === "collapsed" ? "bottom-0 left-full mb-0 ml-2" : "left-0")}>
        {children}
      </div>
    </>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(-2)
    .map((word) => word[0])
    .join("");
}

/**
 * Tài khoản đang đăng nhập — bấm avatar hoặc nút 3 chấm bên phải đều mở cùng menu (hồ sơ, cài đặt,
 * chuyển sáng / tối, đăng xuất) lên trên.
 */
function UserMenu() {
  const router = useRouter();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentUser = useAuthStore((s) => s.user);
  const name = currentUser?.fullName ?? "Người dùng";
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

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
        aria-label="Mở menu tài khoản"
        aria-expanded={open}
        title={collapsed ? name : undefined}
        className={cn(
          "hover:bg-bg-muted h-auto bg-transparent transition-colors",
          collapsed
            ? "size-8 rounded-full p-0"
            : "min-w-0 flex-1 shrink justify-start gap-2 rounded-[var(--r-sm)] px-1 py-1",
        )}
      >
        <span className="bg-accent flex size-7 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold text-white">
          {initials(name)}
        </span>
        {/* Chỉ tên cạnh avatar (vai trò xem trong menu) — căn giữa theo chiều dọc với avatar */}
        {!collapsed && (
          <span className="text-ink-primary min-w-0 truncate text-[0.8125rem] leading-none font-medium">
            {name}
          </span>
        )}
      </Button>
      {!collapsed && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen((o) => !o)}
          aria-label="Tuỳ chọn tài khoản"
          aria-expanded={open}
          className="text-ink-secondary hover:bg-bg-muted hover:text-ink-primary size-8 shrink-0 rounded-[var(--r-md)] bg-transparent p-0"
        >
          <Ellipsis className="size-3.5" />
        </Button>
      )}
      {open && (
        <UpMenu onClose={() => setOpen(false)}>
          <div className="border-border-default border-b px-3 py-2">
            <div className="text-ink-primary text-[0.8125rem] font-semibold">{name}</div>
            <div className="text-ink-tertiary text-xs">
              {currentUser?.email ?? "Chưa có thông tin email"}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {currentUser?.roles.map((role) => (
                <span
                  key={role}
                  className="bg-bg-subtle text-ink-secondary rounded-full px-2 py-0.5 text-[0.625rem] font-medium"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            className={MENU_ITEM}
          >
            <User className="size-3.5" />
            Hồ sơ cá nhân
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            className={MENU_ITEM}
          >
            <Settings className="size-3.5" />
            Cài đặt
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleChangePassword}
            className={MENU_ITEM}
          >
            <KeyRound className="size-3.5" />
            Đổi mật khẩu
          </Button>
          <Button type="button" variant="ghost" onClick={toggleTheme} className={MENU_ITEM}>
            {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            {dark ? "Chuyển sang Light" : "Chuyển sang Dark"}
          </Button>
          <div className="border-border-default my-1 border-t" />
          <Button
            type="button"
            variant="ghost"
            onClick={handleLogout}
            className={cn(MENU_ITEM, "text-danger hover:text-danger")}
          >
            <LogOut className="size-3.5" />
            Đăng xuất
          </Button>
        </UpMenu>
      )}
    </div>
  );
}

/** Đáy sidebar cố định: tài khoản (avatar + tên + vai trò + nút 3 chấm). Ngoài vùng cuộn của menu. */
export function SidebarFooterBar() {
  const { state } = useSidebar();

  return (
    <SidebarFooter
      className={cn(
        "border-border-default shrink-0 border-t p-2",
        state === "collapsed" ? "flex-col items-center gap-1" : "flex-row items-center gap-1",
      )}
    >
      <UserMenu />
    </SidebarFooter>
  );
}
