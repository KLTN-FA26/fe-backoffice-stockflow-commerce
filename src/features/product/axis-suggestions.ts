/**
 * Trục gợi ý của danh mục cho form tạo sản phẩm — PURE. BE `CategoryAttributeService`: bộ thuộc tính
 * của danh mục chỉ để điền sẵn form, KHÔNG bắt buộc với sản phẩm (spec D9) — người dùng gỡ được.
 */
import { canBeVariantAxis } from "./attribute-schemas";

import type { CategoryAttribute } from "./attribute-schemas";
import type { AxisDraft } from "./axes-draft";

/**
 * Dòng làm trục được: vai trò mặc định VARIANT_AXIS, thuộc tính còn dùng (thuộc tính ngưng dùng
 * không thêm mới làm trục được — BE `replaceAxes`), kiểu SELECT / COLOR; theo thứ tự của danh mục.
 */
export function suggestedAxes(rows: readonly CategoryAttribute[]): CategoryAttribute[] {
  return rows
    .filter(
      (row) =>
        row.defaultRole === "VARIANT_AXIS" && row.attributeActive && canBeVariantAxis(row.dataType),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Trục điền sẵn khi chọn danh mục: các trục gợi ý đánh dấu bắt buộc, chưa chọn giá trị. */
export function requiredAxisDrafts(rows: readonly CategoryAttribute[]): AxisDraft[] {
  return suggestedAxes(rows)
    .filter((row) => row.required)
    .map((row) => ({ attributeId: row.attributeId, optionValueIds: [] }));
}
