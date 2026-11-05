import { cn } from "cn";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import type { ReactNode } from "react";

type NoticeTone = "info" | "warning" | "positive" | "danger";

const ICON = {
  info: Info,
  warning: AlertTriangle,
  positive: CheckCircle2,
  danger: XCircle,
} as const;
const ICON_CLASS = {
  info: "text-info",
  warning: "text-warning",
  positive: "text-positive",
  danger: "text-danger",
} as const;
const BOX_CLASS = {
  info: "border-info/30 bg-info/5",
  warning: "border-warning/30 bg-warning/5",
  positive: "border-positive/30 bg-positive/5",
  danger: "border-danger/30 bg-danger/5",
} as const;

/**
 * Thông báo nội dòng: màu tone chỉ ở icon + viền / nền nhạt, chữ dùng ink để đạt tương phản
 * ≥ 4.5:1 (design-tokens §a11y — vàng / xanh lá trên nền trắng không đủ cho chữ nhỏ).
 */
export function Notice({
  tone,
  children,
  className,
  live = false,
}: {
  tone: NoticeTone;
  children: ReactNode;
  className?: string;
  /** Lỗi / cảnh báo xuất hiện sau thao tác → đọc ngay cho screen reader. */
  live?: boolean;
}) {
  const Icon = ICON[tone];
  return (
    <div
      role={live ? (tone === "danger" || tone === "warning" ? "alert" : "status") : undefined}
      className={cn(
        "text-ink-primary flex gap-2 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]",
        BOX_CLASS[tone],
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", ICON_CLASS[tone])} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
