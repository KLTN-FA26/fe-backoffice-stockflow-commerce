"use client";

import { cn } from "cn";
import { KeyRound, LogOut, Settings, ShieldCheck, User } from "lucide-react";

import { ACCOUNT_MENU_LABELS as L } from "@/constants";
import { roleDisplayName } from "@/lib/references/role-options";

import { ThemeSwitch } from "./ThemeSwitch";

import type { LucideIcon } from "lucide-react";

/** Dòng menu kiểu Vercel: nhãn bên trái, icon bên phải. */
const ROW =
  "flex h-9 w-full items-center justify-between gap-3 rounded-[var(--r-sm)] px-2.5 text-left text-[0.8125rem]";
const ITEM = cn(
  ROW,
  "text-ink-secondary hover:bg-bg-muted hover:text-ink-primary focus-visible:bg-bg-muted focus-visible:text-ink-primary transition-colors outline-none",
);

export function initials(name: string) {
  return name
    .split(" ")
    .slice(-2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("vi");
}

/** Avatar tròn chữ tắt ở nút mở menu. */
export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-accent flex size-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-semibold text-white",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={ITEM}>
      {label}
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
    </button>
  );
}

interface AccountMenuPanelProps {
  name: string;
  email?: string;
  roles: readonly string[];
  onClose: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}

/**
 * Nội dung menu tài khoản kiểu Vercel: đầu menu là tên + email với nút cài đặt góc phải; hàng "Vai trò"
 * (tên tiếng Việt, nhiều vai trò nối bằng dấu phẩy); rồi các dòng "nhãn trái — icon phải", dòng Giao diện
 * mang công tắc 3 mức.
 */
export function AccountMenuPanel({
  name,
  email,
  roles,
  onClose,
  onChangePassword,
  onLogout,
}: AccountMenuPanelProps) {
  const roleNames = roles.map(roleDisplayName).join(", ");
  return (
    <>
      <div className="flex items-start gap-2 py-3 pr-2 pl-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-ink-primary truncate text-[0.8125rem] font-semibold">{name}</div>
          <div className="text-ink-tertiary truncate text-xs">{email ?? L.noEmail}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={L.settings}
          title={L.settings}
          className="text-ink-secondary hover:bg-bg-muted hover:text-ink-primary focus-visible:ring-border-strong flex size-7 shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2"
        >
          <Settings aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      {roles.length > 0 && (
        <dl className="border-border-default bg-bg-subtle flex items-center gap-3 border-t px-3.5 py-2 text-xs">
          <dt className="text-ink-tertiary flex shrink-0 items-center gap-1.5">
            <ShieldCheck aria-hidden="true" className="text-dot-info size-3.5" />
            {L.roles}
          </dt>
          <dd
            title={roleNames}
            className="text-ink-primary min-w-0 flex-1 truncate text-right font-medium"
          >
            {roleNames}
          </dd>
        </dl>
      )}
      <div className="border-border-default border-t p-1.5">
        <MenuItem icon={User} label={L.profile} onClick={onClose} />
        <MenuItem icon={KeyRound} label={L.changePassword} onClick={onChangePassword} />
        <div className={cn(ROW, "text-ink-secondary pr-1")}>
          <span>{L.theme}</span>
          <ThemeSwitch />
        </div>
        <MenuItem icon={LogOut} label={L.logout} onClick={onLogout} />
      </div>
    </>
  );
}
