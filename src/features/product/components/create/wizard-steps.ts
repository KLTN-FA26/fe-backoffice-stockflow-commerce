import { ClipboardCheck, FileText, Grid3x3, Info } from "lucide-react";

import type { FieldErrors } from "react-hook-form";
import type { ProductDraftFormValues } from "../../schemas";

export type ProductStepKey = "info" | "description" | "axes" | "review";

/** Trạng thái một bước trên stepper — cùng nghĩa với wizard PO / NCC. */
export type ProductStepStatus = "active" | "done" | "error" | "idle";

export type ProductStep = { key: ProductStepKey; label: string; icon: typeof FileText };

const INFO: ProductStep = { key: "info", label: "Thông tin chung", icon: Info };
const DESCRIPTION: ProductStep = { key: "description", label: "Mô tả", icon: FileText };

export const PRODUCT_CREATE_STEPS: readonly ProductStep[] = [
  INFO,
  DESCRIPTION,
  { key: "axes", label: "Trục biến thể", icon: Grid3x3 },
  { key: "review", label: "Rà soát & tạo", icon: ClipboardCheck },
];

/**
 * Sửa không có bước trục: `PUT /products/{id}` không nhận `axes` — trục / SKU sửa ở trang chi tiết.
 */
export const PRODUCT_EDIT_STEPS: readonly ProductStep[] = [
  INFO,
  DESCRIPTION,
  { key: "review", label: "Rà soát & lưu", icon: ClipboardCheck },
];

type Field = keyof ProductDraftFormValues;

/** Nguồn duy nhất: ô → bước (lỗi BE nhảy về bước sớm nhất có lỗi). Trục là state riêng, không ở đây. */
const FIELD_STEP: Record<Field, ProductStepKey> = {
  productCode: "info",
  name: "info",
  nameEn: "info",
  brandId: "info",
  categoryId: "info",
  taxClass: "info",
  customizable: "info",
  shortDescription: "description",
  description: "description",
  descriptionEn: "description",
};

const ORDER = PRODUCT_CREATE_STEPS.map((s) => s.key);
const FIELDS = Object.keys(FIELD_STEP) as Field[];

/** Ô cần `trigger()` khi bấm "Tiếp tục" ở một bước (bước trục / rà soát không có ô của form). */
export const fieldsOfStep = (step: ProductStepKey): Field[] =>
  FIELDS.filter((f) => FIELD_STEP[f] === step);

/** Bước chứa ô lỗi BE trả về; ô không có trên form → `undefined`. */
export const stepOfField = (field: string): ProductStepKey | undefined =>
  field in FIELD_STEP ? FIELD_STEP[field as Field] : undefined;

export function earliestStep(steps: Iterable<ProductStepKey>): ProductStepKey | undefined {
  return [...steps].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0];
}

/** Lỗi theo bước — cho khung "Cần xử lý", checklist rà soát và trạng thái stepper. */
export function issuesByStep(
  errors: FieldErrors<ProductDraftFormValues>,
): Map<ProductStepKey, string[]> {
  const map = new Map<ProductStepKey, string[]>();
  for (const field of FIELDS) {
    const message = errors[field]?.message;
    if (typeof message !== "string" || !message) continue;
    const step = FIELD_STEP[field];
    map.set(step, [...(map.get(step) ?? []), message]);
  }
  return map;
}
