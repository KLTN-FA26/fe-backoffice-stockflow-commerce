/**
 * Kiểm tra một `Layout` đầy đủ theo BR-10/BR-11 (docs 09-shipping §6): trong lòng thùng, không
 * chồng nhau (kể cả khối gia cố), đáy được đỡ ≥ 98%, đúng kích thước theo hướng đặt, kiện không
 * cho xoay giữ nguyên hướng và tổng khối lượng không vượt tải trọng xe. Dùng cho trình soạn (PR F5)
 * và để xác nhận dữ liệu BE trả về hợp lệ hình học; BE vẫn là nơi kiểm tra có hiệu lực.
 */

import { extentOf, matchesOrientation } from "./dims";
import { validatePlacement } from "./manual-packing";

import type { PlacementRule } from "./manual-packing";
import type { Layout } from "../types";

export type LayoutRule =
  PlacementRule | "ORIENTATION_MISMATCH" | "ROTATION_NOT_ALLOWED" | "PAYLOAD_EXCEEDED";

export interface LayoutIssue {
  /** Chỉ số kiện trong `layout.boxes`; null cho lỗi cấp xe (quá tải). */
  index: number | null;
  ref: string | null;
  rule: LayoutRule;
}

export function checkLayout(layout: Layout): LayoutIssue[] {
  const extent = extentOf(layout.innerMm);
  const issues: LayoutIssue[] = [];
  layout.boxes.forEach((box, index) => {
    const others = [...layout.gussets, ...layout.boxes.filter((_, i) => i !== index)];
    for (const rule of validatePlacement(box, extent, others).violations) {
      issues.push({ index, ref: box.ref, rule });
    }
    if (!matchesOrientation(box))
      issues.push({ index, ref: box.ref, rule: "ORIENTATION_MISMATCH" });
    // BR-10: kiện không có cờ xoay giữ nguyên hướng đặt.
    if (!box.rotatable && box.orientation !== "LWH") {
      issues.push({ index, ref: box.ref, rule: "ROTATION_NOT_ALLOWED" });
    }
  });
  const weight = layout.boxes.reduce((sum, box) => sum + box.weightKg, 0);
  if (weight > layout.maxPayloadKg)
    issues.push({ index: null, ref: null, rule: "PAYLOAD_EXCEEDED" });
  return issues;
}
