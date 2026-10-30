"use client";

import { UI_LABELS } from "@/constants";
import { statusLabelVi } from "@/lib/status-map";

import type { KeyboardEvent } from "react";

export const P = UI_LABELS.warehouseMap.panel;
/** Nét vẽ theo mét — bản đồ dùng `viewBox` đơn vị mét (docs 06 §5: `MapUnit.M`). */
export const LINE = { thin: 0.06, base: 0.12, bold: 0.22, wall: 0.3 } as const;
export const LABEL_SIZE = 0.8;

export interface Selectable {
  selected: boolean;
  onSelect: () => void;
}

/** Hình chọn được bằng chuột lẫn bàn phím (Enter / Space) — Mode A ưu tiên không cần chuột. */
export const selectProps = (label: string, onSelect: () => void, selected: boolean) => ({
  role: "button" as const,
  tabIndex: 0,
  "aria-label": label,
  "aria-pressed": selected,
  onClick: onSelect,
  onKeyDown: (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  },
  className: "cursor-pointer outline-none [&:focus-visible>.focus-ring]:stroke-dot-info",
});

export const statusText = (status: string) => statusLabelVi(status, "location") ?? status;
