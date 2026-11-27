"use client";

import { useId } from "react";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Khung thẻ dùng chung của trang chi tiết (cột trái lẫn cột phải): viền, nền surface, bóng nhẹ. */
export const DETAIL_CARD_CLASS =
  "border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)";

/** Lưới hai cột của trang chi tiết: các mục ở trái, thẻ trạng thái / hành động 320px ở phải. */
export const DETAIL_GRID_CLASS = "grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]";

const DETAIL_ACTION_BASE =
  "h-(--action-h) w-full rounded-(--action-radius) border px-3 text-[0.8125rem] font-medium";

/**
 * Nút xếp dọc, rộng hết thẻ trạng thái / hành động ở cột phải (cùng thông số thẻ hành động trang chi tiết sản phẩm).
 * `primary` dùng với variant `default` (variant `outline` có `dark:bg-input/30` đè nền brand ở dark mode); `danger` dùng
 * với variant `ghost` để giữ chữ đỏ khi hover.
 */
export const DETAIL_ACTION_CLASS = {
  outline: `border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted ${DETAIL_ACTION_BASE}`,
  primary: `border-border-default bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse ${DETAIL_ACTION_BASE}`,
  danger: `border-danger text-danger hover:text-danger hover:bg-danger/10 dark:hover:bg-danger/10 bg-transparent ${DETAIL_ACTION_BASE}`,
} as const;

/** Tiêu đề thẻ ở cột phải (không thu gọn), cùng cỡ tiêu đề mục `DetailSection`. */
export function DetailCardTitle({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
      {Icon && <Icon className="text-accent size-3.5" />}
      {children}
    </h2>
  );
}

/**
 * Mục của trang chi tiết: tiêu đề (icon + chữ) và `actions` trên cùng một dòng, nội dung luôn hiện —
 * không còn thu gọn / mở rộng (dữ liệu chi tiết cần thấy ngay, không phải bấm mở). Mục mang tên của
 * tiêu đề (`aria-labelledby`) cho screen reader. `bare`: không khung thẻ (viền, nền, bóng, padding) —
 * dùng khi nội dung đã tự có khung (bảng) hoặc nằm trong khung chung của trang.
 *
 * `defaultOpen` / `forceOpen` giữ trong kiểu để chỗ gọi cũ không phải sửa; mục luôn mở.
 */
export function DetailSection({
  title,
  icon: Icon,
  actions,
  bare = false,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** Bỏ qua — mục luôn mở. */
  defaultOpen?: boolean;
  /** Bỏ qua — mục luôn mở. */
  forceOpen?: boolean;
  actions?: ReactNode;
  bare?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={bare ? undefined : DETAIL_CARD_CLASS}>
      <div className="mb-3 flex min-h-8 items-center gap-2">
        <h2
          id={titleId}
          className="text-ink-primary flex flex-1 items-center gap-2 text-[0.9375rem] font-semibold"
        >
          {Icon && <Icon className="text-accent size-3.5" aria-hidden />}
          {title}
        </h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-ink-tertiary w-[140px] shrink-0 text-xs font-medium">{label}</span>
      <span className="text-ink-primary text-[0.8125rem]">{children}</span>
    </div>
  );
}
