import type { AttributeDataType, AttributeRole } from "./attribute-schemas";

/** Nhãn loại thuộc tính (BE `AttributeDataType`). */
export const DATA_TYPE_LABEL: Record<AttributeDataType, string> = {
  TEXT: "Văn bản",
  NUMBER: "Số",
  BOOLEAN: "Có / Không",
  SELECT: "Chọn một",
  MULTISELECT: "Chọn nhiều",
  COLOR: "Màu sắc",
};

/** Nhãn vai trò mặc định của thuộc tính trong một danh mục (BE `AttributeRole`). */
export const ROLE_LABEL: Record<AttributeRole, string> = {
  VARIANT_AXIS: "Trục biến thể",
  DESCRIPTIVE: "Mô tả",
};
