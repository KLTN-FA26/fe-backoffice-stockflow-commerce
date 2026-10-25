import Link from "next/link";
import { cn } from "cn";
import { ArrowUpRight, Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import type { ReactNode } from "react";

export type StatTone = "positive" | "info" | "warning" | "danger" | "special" | "neutral";
type DeltaDirection = "up" | "down" | "flat";

/** Thang `--dot-*` (tươi) chỉ cho icon — chữ / số vẫn màu ink (design-tokens: Chấm trạng thái). */
const TONE_ICON: Record<StatTone, string> = {
  positive: "text-dot-positive bg-dot-positive/10",
  info: "text-dot-info bg-dot-info/10",
  warning: "text-dot-warning bg-dot-warning/10",
  danger: "text-dot-danger bg-dot-danger/10",
  special: "text-dot-special bg-dot-special/10",
  neutral: "text-ink-tertiary bg-bg-muted",
};

const DELTA: Record<DeltaDirection, { color: string; Icon: typeof TrendingUp }> = {
  up: { color: "text-positive", Icon: TrendingUp },
  down: { color: "text-danger", Icon: TrendingDown },
  flat: { color: "text-ink-tertiary", Icon: Minus },
};

/**
 * Dải số liệu gọn kiểu Vercel: MỘT khung bo 8px + bóng nhẹ, các ô ngăn bằng vạch mảnh. Số cột qua
 * `columns` (vd `grid-cols-3 xl:grid-cols-6`). Ô là `StatCell`.
 *
 * Vạch là viền phải / dưới của từng ô; lưới lệch -1px để viền ở cột cuối / hàng cuối bị khung cắt đi.
 * Ô trống ở hàng cuối (số ô không chia hết số cột) chỉ là nền trắng — không lộ mảng xám như khi vẽ
 * vạch bằng `gap-px` trên nền khung.
 */
export function StatStrip({
  columns,
  className,
  children,
}: {
  columns: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-border-default bg-bg-surface overflow-hidden rounded-[var(--card-radius)] border shadow-[var(--card-shadow)]",
        className,
      )}
    >
      <div className={cn("-mr-px -mb-px grid", columns)}>{children}</div>
    </div>
  );
}

interface StatCellProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  /** Có → cả ô là link, hover hiện mũi tên ↗. */
  href?: string;
  /** `text` ngắn (vd "+35,8%") ở góc phải hàng nhãn; `hint` (vd "so với kỳ trước") là tooltip. */
  delta?: { text: string; direction: DeltaDirection; hint?: string };
  /** Số tiền → font mono; số đếm dùng font display. */
  mono?: boolean;
  /** Chú thích khi rê chuột (vd lý do không tải được). */
  title?: string;
}

/** Một ô trong `StatStrip`: nhãn một dòng trên cùng, hàng dưới là icon tone + số (cao ~66px). */
export function StatCell({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  href,
  delta,
  mono = false,
  title,
}: StatCellProps) {
  const DeltaIcon = delta ? DELTA[delta.direction].Icon : null;
  const body = (
    <>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="text-ink-secondary truncate text-xs font-medium">{label}</p>
        {delta && (
          <span
            title={delta.hint}
            className={cn(
              "flex shrink-0 items-center gap-0.5 text-[0.6875rem] font-medium tabular-nums",
              DELTA[delta.direction].color,
            )}
          >
            {DeltaIcon && <DeltaIcon className="size-3" aria-hidden />}
            {delta.text}
            {delta.hint && <span className="sr-only"> {delta.hint}</span>}
          </span>
        )}
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-2">
        {Icon && (
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-[var(--r-sm)]",
              TONE_ICON[tone],
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </span>
        )}
        <span
          className={cn(
            "text-ink-primary truncate text-xl leading-none font-semibold tracking-tight tabular-nums",
            mono ? "font-[family-name:var(--font-mono)]" : "font-[family-name:var(--font-display)]",
          )}
        >
          {value}
        </span>
        {href && (
          <ArrowUpRight
            className="text-ink-tertiary ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden
          />
        )}
      </div>
    </>
  );
  const cell = "border-(--table-line) block min-w-0 border-r border-b px-3.5 py-3";
  return href ? (
    <Link
      href={href}
      title={title ?? label}
      className={cn(
        cell,
        "group hover:bg-bg-subtle focus-visible:bg-bg-subtle transition-colors outline-none",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cell} title={title ?? label}>
      {body}
    </div>
  );
}
