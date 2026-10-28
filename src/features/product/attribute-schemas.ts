/**
 * Từ điển thuộc tính (BE PR #113) — DTO của `AttributeController` / `CategoryAttributeController`
 * và schema form. Quy tắc nghiệp vụ lấy từ BE (`Attribute`, `CategoryAttributeService`):
 *  - mã thuộc tính A-Z, 0-9, `_`; mã giá trị có thêm `-` (BE tự viết hoa);
 *  - chỉ SELECT / MULTISELECT / COLOR có danh sách giá trị; giá trị COLOR bắt buộc có màu #RRGGBB,
 *    các loại khác không được có màu;
 *  - chỉ SELECT / COLOR làm được trục biến thể (một biến thể = một giá trị mỗi trục).
 */

import { z } from "zod";

import { bePageSchema } from "@/lib/api/page-schema";

/** BE serialise BigDecimal thành số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

/** BE `AttributeDataType`. */
export const ATTRIBUTE_DATA_TYPES = [
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "MULTISELECT",
  "COLOR",
] as const;
export type AttributeDataType = (typeof ATTRIBUTE_DATA_TYPES)[number];

/** Chỉ một danh sách lựa chọn đóng mới có từ điển giá trị (BE `AttributeDataType#holdsValues`). */
export const holdsValues = (dataType: AttributeDataType): boolean =>
  dataType === "SELECT" || dataType === "MULTISELECT" || dataType === "COLOR";

/** Một biến thể là một lựa chọn mỗi trục → thuộc tính đa trị không làm trục được (`canBeVariantAxis`). */
export const canBeVariantAxis = (dataType: AttributeDataType): boolean =>
  dataType === "SELECT" || dataType === "COLOR";

/** BE `AttributeRole`: dùng để phân biệt biến thể hay chỉ để mô tả sản phẩm. */
export const ATTRIBUTE_ROLES = ["VARIANT_AXIS", "DESCRIPTIVE"] as const;
export type AttributeRole = (typeof ATTRIBUTE_ROLES)[number];

/** BE `AttributeValueResponse`. */
export const beAttributeValueSchema = z.object({
  valueId: z.string(),
  code: z.string(),
  label: z.string(),
  valueNumber: beDecimal.nullish(),
  hexColor: z.string().nullish(),
  sortOrder: z.number().int(),
  active: z.boolean(),
  /** Gửi lại khi sửa / xoá giá trị (409 OPTIMISTIC_LOCK nếu đã đổi). */
  version: z.number().int(),
});
export type AttributeValue = z.infer<typeof beAttributeValueSchema>;

/** BE `AttributeResponse`. */
export const beAttributeSchema = z.object({
  attributeId: z.string(),
  code: z.string(),
  name: z.string(),
  dataType: z.enum(ATTRIBUTE_DATA_TYPES),
  unit: z.string().nullish(),
  filterable: z.boolean(),
  searchable: z.boolean(),
  sortOrder: z.number().int(),
  active: z.boolean(),
  version: z.number().int(),
  values: z.array(beAttributeValueSchema),
});
export type Attribute = z.infer<typeof beAttributeSchema>;

export const beAttributePageSchema = bePageSchema(beAttributeSchema);

/** BE `CategoryAttributeResponse` — bộ thuộc tính gợi ý của một danh mục. */
export const beCategoryAttributeSchema = z.object({
  attributeId: z.string(),
  attributeCode: z.string(),
  attributeName: z.string(),
  dataType: z.enum(ATTRIBUTE_DATA_TYPES),
  attributeActive: z.boolean(),
  defaultRole: z.enum(ATTRIBUTE_ROLES),
  required: z.boolean(),
  sortOrder: z.number().int(),
});
export type CategoryAttribute = z.infer<typeof beCategoryAttributeSchema>;

/* ── Input ───────────────────────────────────────────────────────────── */

/** `ck_attributes_code` / `Attribute.normaliseCode`: sau khi viết hoa là `[A-Z0-9][A-Z0-9_]{0,49}`. */
export const ATTRIBUTE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_]{0,49}$/;
/** `ck_attribute_values_code`: như mã thuộc tính, cho phép thêm `-` (vd `12OZ-HOT`). */
export const ATTRIBUTE_VALUE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/;
/** `Attribute.HEX_COLOR` — BE viết hoa trước khi kiểm. */
export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
export const ATTRIBUTE_NAME_MAX = 255;
export const ATTRIBUTE_UNIT_MAX = 20;
export const ATTRIBUTE_VALUE_LABEL_MAX = 255;

const sortOrderText = z
  .string()
  .trim()
  .refine((v) => v === "" || Number.isInteger(Number(v)), "Số nguyên");

/** `@Digits(integer = 14, fraction = 4)` của `valueNumber`. */
const decimalText = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || /^-?\d{1,14}(\.\d{1,4})?$/.test(v),
    "Tối đa 14 chữ số nguyên và 4 số lẻ",
  );

/** Form tạo / sửa thuộc tính — chuỗi người dùng gõ; `attributeBody` đổi sang request BE. */
export const attributeFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Nhập mã thuộc tính")
    .regex(
      ATTRIBUTE_CODE_PATTERN,
      "Mã chỉ gồm chữ, số và '_', bắt đầu bằng chữ hoặc số (tối đa 50)",
    ),
  dataType: z.enum(ATTRIBUTE_DATA_TYPES),
  name: z
    .string()
    .trim()
    .min(1, "Nhập tên thuộc tính")
    .max(ATTRIBUTE_NAME_MAX, `Tên tối đa ${ATTRIBUTE_NAME_MAX} ký tự`),
  unit: z.string().trim().max(ATTRIBUTE_UNIT_MAX, `Đơn vị tối đa ${ATTRIBUTE_UNIT_MAX} ký tự`),
  filterable: z.boolean(),
  searchable: z.boolean(),
  sortOrder: sortOrderText,
  active: z.boolean(),
});
export type AttributeFormValues = z.infer<typeof attributeFormSchema>;

/**
 * Form giá trị. Màu phụ thuộc loại thuộc tính nên schema dựng theo `dataType`
 * (BE `Attribute.requireShape`: COLOR cần #RRGGBB, loại khác không được có màu).
 */
export function attributeValueFormSchemaFor(dataType: AttributeDataType) {
  const isColor = dataType === "COLOR";
  return z.object({
    code: z
      .string()
      .trim()
      .min(1, "Nhập mã giá trị")
      .regex(
        ATTRIBUTE_VALUE_CODE_PATTERN,
        "Mã chỉ gồm chữ, số, '_' và '-', bắt đầu bằng chữ hoặc số",
      ),
    label: z
      .string()
      .trim()
      .min(1, "Nhập nhãn giá trị")
      .max(ATTRIBUTE_VALUE_LABEL_MAX, `Nhãn tối đa ${ATTRIBUTE_VALUE_LABEL_MAX} ký tự`),
    valueNumber: decimalText,
    hexColor: isColor
      ? z.string().trim().regex(HEX_COLOR_PATTERN, "Chọn màu dạng #RRGGBB")
      : z.string().trim().max(0, "Chỉ giá trị màu mới có mã màu"),
    sortOrder: sortOrderText,
    active: z.boolean(),
  });
}
export type AttributeValueFormValues = z.infer<ReturnType<typeof attributeValueFormSchemaFor>>;

/** Một dòng của bộ thuộc tính danh mục (`ReplaceCategoryAttributesRequest.Entry`). */
export const categoryAttributeEntrySchema = z.object({
  attributeId: z.string().min(1),
  defaultRole: z.enum(ATTRIBUTE_ROLES),
  required: z.boolean(),
  sortOrder: z.number().int(),
});
export type CategoryAttributeEntry = z.infer<typeof categoryAttributeEntrySchema>;

/** Cả bộ thay thế toàn bộ: thuộc tính bỏ ra khỏi danh sách bị gỡ, danh sách rỗng = xoá hết. */
export const replaceCategoryAttributesSchema = z
  .object({ attributes: z.array(categoryAttributeEntrySchema) })
  // BE `CategoryAttributeService.replace`: mỗi thuộc tính một lần.
  .refine((v) => new Set(v.attributes.map((e) => e.attributeId)).size === v.attributes.length, {
    path: ["attributes"],
    message: "Mỗi thuộc tính chỉ được liệt kê một lần",
  });
