"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Khung thẻ dùng chung của trang chi tiết sản phẩm (cột trái lẫn cột phải). */
export const PRODUCT_CARD_CLASS =
  "border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]";

/** Mục thu gọn được của trang chi tiết; `actions` nằm trên dòng tiêu đề, chỉ hiện khi mục mở. */
export function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  actions,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={PRODUCT_CARD_CLASS}>
      <div className="mb-3 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen((o) => !o)}
          className="text-ink-primary hover:text-accent h-auto flex-1 justify-start gap-2 bg-transparent p-0 text-left text-[0.9375rem] font-semibold hover:bg-transparent"
        >
          {Icon && <Icon className="text-accent size-4" />}
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
