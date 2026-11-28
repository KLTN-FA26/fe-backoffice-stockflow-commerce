/** Một dòng menu sidebar (cao 36px, chữ 14px, icon 14px) — dùng chung cho menu và panel riêng của nhóm. */
export const NAV_ROW =
  "h-9 gap-2.5 rounded-[var(--r-md)] px-3 text-sm transition-colors duration-150 [&>svg]:size-3.5";
/** Class item menu: thường / đang mở (nền muted nhẹ như Vercel). */
export const ITEM_IDLE = "text-ink-primary hover:bg-bg-muted";
export const ITEM_ACTIVE =
  "bg-bg-muted text-ink-primary hover:bg-bg-muted data-active:bg-bg-muted data-active:text-ink-primary font-medium";

/** Số mục cần chú ý cạnh item / nhóm menu (vd tin chat chưa đọc). */
export function WarnBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="bg-positive text-ink-inverse flex size-[18px] shrink-0 items-center justify-center rounded-full text-[0.5625rem] leading-none font-bold">
      {count}
    </span>
  );
}
