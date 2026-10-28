"use client";

import { useState } from "react";

import { PICK_LINE_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import { ShortPickDialog } from "./ShortPickDialog";

import type { ShortPickProps } from "./ShortPickDialog";

const L = PICK_LINE_LABELS;

/** Nút phụ "Báo thiếu hàng" trên thẻ xác nhận dòng — mở dialog cho đúng dòng đang làm. */
export function ShortPickAction(props: ShortPickProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-border-default w-full rounded-[var(--r-sm)]"
      >
        {L.shortAction}
      </Button>
      {open && <ShortPickDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
