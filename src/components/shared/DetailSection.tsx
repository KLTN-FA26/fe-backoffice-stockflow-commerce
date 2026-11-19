"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

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
 * Nút tiêu đề của mục: chữ như tiêu đề, không nền ở mọi trạng thái. Biến thể `ghost` tô `bg-muted` khi hover và khi
 * `aria-expanded` (dành cho nút mở menu) — ở đây mục mở là trạng thái thường, nên bỏ nền đó; vòng focus của nút giữ nguyên.
 */
export const DETAIL_SECTION_TOGGLE_CLASS =
  "text-ink-primary hover:text-accent aria-expanded:text-ink-primary aria-expanded:hover:text-accent h-auto flex-1 justify-start gap-2 bg-transparent p-0 text-left text-[0.9375rem] font-semibold hover:bg-transparent active:bg-transparent aria-expanded:bg-transparent dark:hover:bg-transparent dark:aria-expanded:bg-transparent";

/**
 * Mục thu gọn được của trang chi tiết; `actions` nằm trên dòng tiêu đề, chỉ hiện khi mục mở. Nút tiêu đề báo
 * `aria-expanded`, và mục mang tên của tiêu đề (vùng `region`) cho screen reader.
 */
export function DetailSection({
  title,
  icon: Icon,
  defaultOpen = true,
  forceOpen = false,
  actions,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  /** Giữ mục mở khi `true` (ví dụ một ô bên trong đang báo lỗi), dù người dùng đã đóng. */
  forceOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [toggled, setOpen] = useState(defaultOpen);
  const open = toggled || forceOpen;
  const titleId = useId();
  const panelId = useId();
  return (
    <section aria-labelledby={titleId} className={DETAIL_CARD_CLASS}>
      <div className="mb-3 flex items-center gap-2">
        <Button
          id={titleId}
          type="button"
          variant="ghost"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen(!open)}
          className={DETAIL_SECTION_TOGGLE_CLASS}
        >
          {Icon && <Icon className="text-accent size-3.5" />}
          {title}
          {open ? (
            <ChevronDown className="text-ink-tertiary size-3.5" />
          ) : (
            <ChevronRight className="text-ink-tertiary size-3.5" />
          )}
        </Button>
        {actions && open && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
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
