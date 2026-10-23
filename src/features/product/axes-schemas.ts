/**
 * Trục biến thể và thuộc tính mô tả của một sản phẩm (BE PR #114, #115, #116):
 *  - `GET /products/{id}/attributes`, `PUT /products/{id}/axes`, `PUT /products/{id}/descriptive-attributes`
 *  - `POST /products/{id}/variants/generation`, `CreateProductRequest.axes`.
 * Quy tắc từ BE (`ProductAttributeSet`, `VariantMatrix`, `SkuCodeRule`) — xem comment từng schema.
 */

import { z } from "zod";

import { SKU_MAX_LENGTH } from "@/lib/validation/sku";

import { ATTRIBUTE_DATA_TYPES } from "./attribute-schemas";

import type { AttributeDataType } from "./attribute-schemas";

/** BE serialise BigDecimal thành số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

/** BE `ProductAttributesResponse.Option` — một giá trị khả dụng của trục. */
export const beAxisOptionSchema = z.object({
  valueId: z.string(),
  code: z.string(),
  label: z.string(),
  hexColor: z.string().nullish(),
  valueNumber: beDecimal.nullish(),
  /** Giá trị đã bị vô hiệu trong từ điển: biến thể mới không được dùng. */
  active: z.boolean(),
  /** Có biến thể của sản phẩm đang mang giá trị này → không gỡ được khỏi trục (ATTRIBUTE_IN_USE). */
  usedByVariant: z.boolean(),
});

/** BE `ProductAttributesResponse.Axis`. */
export const beAxisSchema = z.object({
  attributeId: z.string(),
  code: z.string(),
  name: z.string(),
  dataType: z.enum(ATTRIBUTE_DATA_TYPES),
  sortOrder: z.number().int(),
  options: z.array(beAxisOptionSchema),
});

/** BE `ProductAttributesResponse.Descriptive` — giá trị nằm ở `values` (từ điển) hoặc text / number / bool. */
export const beDescriptiveSchema = z.object({
  attributeId: z.string(),
  code: z.string(),
  name: z.string(),
  dataType: z.enum(ATTRIBUTE_DATA_TYPES),
  unit: z.string().nullish(),
  sortOrder: z.number().int(),
  values: z.array(
    z.object({ valueId: z.string(), code: z.string(), label: z.string(), active: z.boolean() }),
  ),
  text: z.string().nullish(),
  number: beDecimal.nullish(),
  bool: z.boolean().nullish(),
});

/** BE `ProductAttributesResponse`. */
export const beProductAttributesSchema = z.object({
  productId: z.string(),
  axes: z.array(beAxisSchema),
  descriptives: z.array(beDescriptiveSchema),
});

export type ProductAxisOption = z.infer<typeof beAxisOptionSchema>;
export type ProductAxis = z.infer<typeof beAxisSchema>;
export type ProductDescriptive = z.infer<typeof beDescriptiveSchema>;
export type ProductAttributes = z.infer<typeof beProductAttributesSchema>;

/* ── Input: trục ─────────────────────────────────────────────────────── */

/** `ReplaceAxesRequest.Axis` / `CreateProductRequest.axes[]`: `sortOrder` trống = vị trí trong danh sách. */
export const axisInputSchema = z.object({
  attributeId: z.string().min(1, "Chọn thuộc tính"),
  sortOrder: z.number().int().optional(),
  // BE `@NotEmpty`: một trục cần ít nhất một giá trị.
  optionValueIds: z
    .array(z.string().min(1))
    .min(1, "Mỗi trục cần ít nhất một giá trị")
    .refine((ids) => new Set(ids).size === ids.length, "Một giá trị chỉ được chọn một lần"),
});
export type AxisInput = z.infer<typeof axisInputSchema>;

/** Cả danh sách trục thay thế toàn bộ (BE `PUT /axes`). */
export const replaceAxesSchema = z
  .object({ axes: z.array(axisInputSchema) })
  // BE `ProductAttributeSet.replaceAxes`: "Attribute appears twice among the axes".
  .refine((v) => new Set(v.axes.map((a) => a.attributeId)).size === v.axes.length, {
    path: ["axes"],
    message: "Mỗi thuộc tính chỉ làm trục một lần",
  });

/* ── Input: thuộc tính mô tả ─────────────────────────────────────────── */

export const DESCRIPTIVE_TEXT_MAX = 2000;

/** `ReplaceDescriptiveAttributesRequest.Entry` — chỉ một nhóm trường theo loại thuộc tính. */
export const descriptiveEntrySchema = z.object({
  attributeId: z.string().min(1),
  sortOrder: z.number().int().optional(),
  valueIds: z.array(z.string().min(1)).optional(),
  text: z.string().max(DESCRIPTIVE_TEXT_MAX).optional(),
  number: z.number().optional(),
  bool: z.boolean().optional(),
});
export type DescriptiveEntry = z.infer<typeof descriptiveEntrySchema>;

export const replaceDescriptivesSchema = z
  .object({ attributes: z.array(descriptiveEntrySchema) })
  // BE `ProductAttributeSet.replaceDescriptives`: mỗi thuộc tính một lần.
  .refine((v) => new Set(v.attributes.map((a) => a.attributeId)).size === v.attributes.length, {
    path: ["attributes"],
    message: "Mỗi thuộc tính chỉ được mô tả một lần",
  });

/**
 * Giá trị người dùng nhập cho một thuộc tính mô tả → entry gửi BE, theo loại (BE
 * `ProductAttributeSet.values`): SELECT / COLOR đúng một giá trị từ điển, MULTISELECT ít nhất một,
 * TEXT cần chữ, NUMBER cần số, BOOLEAN cần đúng / sai. Trả lý do tiếng Việt khi chưa hợp lệ.
 */
export type DescriptiveDraft = {
  attributeId: string;
  dataType: AttributeDataType;
  valueIds: string[];
  text: string;
  number: string;
  bool: boolean | null;
};

export function descriptiveEntryFromDraft(
  draft: DescriptiveDraft,
  sortOrder: number,
): { entry: DescriptiveEntry } | { error: string } {
  const base = { attributeId: draft.attributeId, sortOrder };
  switch (draft.dataType) {
    case "SELECT":
    case "COLOR":
      return draft.valueIds.length === 1
        ? { entry: { ...base, valueIds: draft.valueIds } }
        : { error: "Chọn đúng một giá trị" };
    case "MULTISELECT":
      return draft.valueIds.length >= 1
        ? { entry: { ...base, valueIds: draft.valueIds } }
        : { error: "Chọn ít nhất một giá trị" };
    case "TEXT": {
      const text = draft.text.trim();
      if (!text) return { error: "Nhập nội dung" };
      return text.length <= DESCRIPTIVE_TEXT_MAX
        ? { entry: { ...base, text } }
        : { error: `Tối đa ${DESCRIPTIVE_TEXT_MAX} ký tự` };
    }
    case "NUMBER": {
      // `@Digits(integer = 14, fraction = 4)`
      const raw = draft.number.trim();
      return /^-?\d{1,14}(\.\d{1,4})?$/.test(raw)
        ? { entry: { ...base, number: Number(raw) } }
        : { error: "Nhập số (tối đa 14 chữ số nguyên, 4 số lẻ)" };
    }
    case "BOOLEAN":
      return draft.bool === null
        ? { error: "Chọn Có hoặc Không" }
        : { entry: { ...base, bool: draft.bool } };
  }
}

/* ── Ma trận biến thể ────────────────────────────────────────────────── */

/**
 * `VariantMatrix.MAX_PER_CALL`: một lần sinh / tạo tối đa 100 tổ hợp (kể cả tổ hợp gán cho biến thể
 * mặc định), vượt thì BE từ chối cả lần gọi (400 VARIANT_MATRIX_TOO_LARGE).
 */
export const MATRIX_MAX_PER_CALL = 100;

/** Số tổ hợp = tích số giá trị mỗi trục (không trục = 0 tổ hợp). Bão hoà thay vì tràn. */
export function matrixSize(axisSizes: readonly number[]): number {
  if (axisSizes.length === 0 || axisSizes.some((n) => n <= 0)) return 0;
  return axisSizes.reduce((total, n) => Math.min(total * n, Number.MAX_SAFE_INTEGER), 1);
}

/** `SkuCodeRule.generate`: `MÃ_SẢN_PHẨM-GIÁ_TRỊ-GIÁ_TRỊ` theo thứ tự trục (BE viết hoa mã sản phẩm). */
export function generatedSku(productCode: string, valueCodes: readonly string[]): string {
  return [productCode.trim().toUpperCase(), ...valueCodes].join("-");
}

/** BE `Sku.MAX_LENGTH`: SKU sinh dài hơn thì BE từ chối (VALIDATION_FAILED) — báo trước ở bản xem trước. */
export const generatedSkuTooLong = (sku: string): boolean => sku.length > SKU_MAX_LENGTH;

/** Mọi tổ hợp một giá trị mỗi trục, trục đầu đổi chậm nhất (đúng thứ tự `VariantMatrix.of`). */
export function enumerateCombinations<T>(optionsPerAxis: readonly (readonly T[])[]): T[][] {
  if (optionsPerAxis.length === 0) return [];
  return optionsPerAxis.reduce<T[][]>(
    (rows, axis) => rows.flatMap((row) => axis.map((option) => [...row, option])),
    [[]],
  );
}
