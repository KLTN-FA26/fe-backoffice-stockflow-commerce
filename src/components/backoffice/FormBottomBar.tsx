import type { ReactNode } from "react";

/** Nút của thanh dưới form — cao / bo góc theo biến `--action-*` (`.surface-soft.surface-compact` đổi). */
export const FORM_BAR_ACTION_CLASS = {
  outline:
    "border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted h-(--action-h) rounded-(--action-radius) px-(--action-px) disabled:opacity-40",
  primary:
    "bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse inline-flex h-(--action-h) items-center gap-1.5 rounded-(--action-radius) px-(--action-px)",
} as const;

/**
 * Thanh dưới cố định của trang form (cùng dáng thanh dưới wizard sản phẩm): ghi chú ngắn bên trái, nút Huỷ / Lưu bên
 * phải. Đặt bên trong `<form>` để nút `type="submit"` gửi form; nội dung form chừa `pb-24` để không bị thanh che.
 */
export function FormBottomBar({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <div className="border-border-default bg-bg-surface/95 fixed right-0 bottom-0 left-0 z-40 border-t px-4 py-3 backdrop-blur lg:left-[240px]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-ink-tertiary min-w-0 text-xs">{note}</div>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
