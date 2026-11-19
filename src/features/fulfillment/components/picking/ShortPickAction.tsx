"use client";

import { useState } from "react";

import { PICK_LINE_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import { ShortPickDialog } from "./ShortPickDialog";

import type { ShortPickProps } from "./ShortPickDialog";

const L = PICK_LINE_LABELS;

/**
 * Nút "Báo thiếu hàng" — mở dialog cho đúng dòng. Trên thẻ xác nhận dòng thì rộng hết cột; `compact` là nút nhỏ cuối
 * dòng của bảng (thùng đã về khu chờ xuất bị báo thiếu, docs 20 §4.9 bước 4).
 */
export function ShortPickAction({
  compact = false,
  ...props
}: ShortPickProps & { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={compact ? "xs" : "sm"}
        onClick={() => setOpen(true)}
        className={
          compact
            ? "border-border-default rounded-[var(--r-sm)]"
            : "border-border-default w-full rounded-[var(--r-sm)]"
        }
      >
        {L.shortAction}
      </Button>
      {open && <ShortPickDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
