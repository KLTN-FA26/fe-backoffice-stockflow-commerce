"use client";

import { useEffect, useRef } from "react";

import { useCategoryAttributes } from "../attribute-queries";
import { requiredAxisDrafts, suggestedAxes } from "../axis-suggestions";

import type { AxisDraft } from "../axes-draft";

/**
 * Form tạo: chọn danh mục → điền sẵn các trục danh mục đánh dấu bắt buộc (spec D9, BE
 * `CategoryAttributeService`: bộ thuộc tính chỉ để điền sẵn form, không bắt buộc với sản phẩm).
 * Chỉ điền khi người dùng chưa chọn trục nào, hoặc trục hiện có đúng là bản đã điền sẵn chưa đụng
 * tới (đổi danh mục thì thay theo danh mục mới) — không ghi đè lựa chọn của người dùng. Danh mục
 * không có gợi ý / tải lỗi → form như cũ.
 */
export function useCategoryAxisPrefill({
  categoryId,
  enabled,
  value,
  onChange,
}: {
  categoryId: string;
  /** Đã đọc được từ điển thuộc tính (cùng quyền `product-attributes:READ` với API gợi ý). */
  enabled: boolean;
  value: AxisDraft[];
  onChange: (next: AxisDraft[]) => void;
}) {
  const query = useCategoryAttributes(categoryId || undefined, enabled);
  const prefilled = useRef<{ categoryId: string; axes: AxisDraft[] } | null>(null);

  useEffect(() => {
    const rows = query.data;
    if (!categoryId || !rows || prefilled.current?.categoryId === categoryId) return;
    const untouched = value.length === 0 || value === prefilled.current?.axes;
    const next = requiredAxisDrafts(rows);
    prefilled.current = { categoryId, axes: next };
    if (untouched && (next.length > 0 || value.length > 0)) onChange(next);
  }, [categoryId, query.data, value, onChange]);

  return suggestedAxes(query.data ?? []);
}
