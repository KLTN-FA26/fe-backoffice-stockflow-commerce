/** Giá trị khởi tạo + cấu hình ô của form danh mục hàng NCC (tách khỏi dialog cho gọn). */

import { SUPPLIER_ITEM_UI_LABELS } from "@/constants";

import type { SupplierItem, SupplierItemFormValues } from "@/features/supplier/types";

export type ItemTextField = Exclude<keyof SupplierItemFormValues, "preferred">;

export const EMPTY_ITEM_VALUES: SupplierItemFormValues = {
  sku: "",
  supplierSkuCode: "",
  price: "",
  moq: "",
  packSize: "",
  leadTimeDays: "",
  preferred: false,
};

/** Ô nhập theo thứ tự hiển thị; `wide` = chiếm cả hàng, còn lại xếp 3 cột. */
export const ITEM_TEXT_FIELDS: {
  name: ItemTextField;
  required?: boolean;
  mono?: boolean;
  numeric?: boolean;
  wide?: boolean;
}[] = [
  { name: "sku", required: true, mono: true, wide: true },
  { name: "supplierSkuCode", mono: true, wide: true },
  { name: "price", required: true, numeric: true, wide: true },
  { name: "moq", required: true, numeric: true },
  { name: "packSize", required: true, numeric: true },
  { name: "leadTimeDays", numeric: true },
];

export const ITEM_FIELD_HINTS: Partial<Record<ItemTextField, string>> =
  SUPPLIER_ITEM_UI_LABELS.hint;

export function toItemFormValues(item: SupplierItem): SupplierItemFormValues {
  return {
    sku: item.sku,
    supplierSkuCode: item.supplierSkuCode ?? "",
    price: String(item.price),
    moq: String(item.moq),
    packSize: String(item.packSize),
    leadTimeDays: item.leadTimeDays === null ? "" : String(item.leadTimeDays),
    // Luôn gửi lại `preferred` đang có — thiếu/false trên dòng ưu tiên = BE xoá NCC mặc định
    // của SKU (BE #121, docs 01 §3 "Nhà cung cấp mặc định")
    preferred: item.preferred,
  };
}
