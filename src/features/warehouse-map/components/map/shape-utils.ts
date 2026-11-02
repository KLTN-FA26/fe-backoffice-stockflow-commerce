"use client";

import { UI_LABELS } from "@/constants";
import { statusLabelVi } from "@/lib/status-map";

import type { KeyboardEvent, MouseEvent } from "react";

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
  // Bấm chuột không đặt focus (trình duyệt vẽ khung focus đen chớp quanh hình SVG) — phản hồi bằng
  // hover; Tab / Enter vẫn chọn được bằng bàn phím
  onMouseDown: (event: MouseEvent) => event.preventDefault(),
  onKeyDown: (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  },
  className:
    "group cursor-pointer outline-none select-none [-webkit-tap-highlight-color:transparent] [&:focus-visible>.focus-ring]:stroke-dot-info",
});

export const statusText = (status: string) => statusLabelVi(status, "location") ?? status;

/** Chữ nhỏ hơn mức này (m) thì không đọc được ở mức zoom vừa khung → ẩn nhãn, vẫn còn aria-label. */
const MIN_LABEL = 0.32;
/** Bề rộng trung bình một ký tự mono so với cỡ chữ. */
const CHAR_WIDTH = 0.62;

/**
 * Cỡ chữ mã vừa khít trong hộp: không vượt `LABEL_SIZE`, không tràn chiều ngắn / chiều dài; hộp đứng
 * (cao hơn rõ rệt) thì xoay chữ dọc theo chiều dài. Quá nhỏ → `null` (không vẽ nhãn).
 */
export function fitLabel(
  text: string,
  w: number,
  h: number,
): { size: number; vertical: boolean } | null {
  const vertical = h > w * 1.4;
  const long = vertical ? h : w;
  const short = vertical ? w : h;
  const size = Math.min(
    LABEL_SIZE,
    short * 0.62,
    (long * 0.9) / (Math.max(text.length, 1) * CHAR_WIDTH),
  );
  return size < MIN_LABEL ? null : { size, vertical };
}
