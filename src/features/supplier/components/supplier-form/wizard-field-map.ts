import { STEPS } from "./wizard-constants";

import type { FieldErrors } from "react-hook-form";
import type { SupplierFormValues } from "@/features/supplier/types";
import type { StepKey } from "./wizard-constants";

type SupplierField = keyof SupplierFormValues;

/** Single source of truth: field → bước wizard. */
export const FIELD_STEP_MAP: Record<SupplierField, StepKey> = {
  code: "profile",
  name: "profile",
  taxCode: "profile",
  contactName: "contact",
  email: "contact",
  phone: "contact",
  paymentTermDays: "terms",
  leadTimeDays: "terms",
  communicationChannel: "terms",
  apiEndpoint: "terms",
};

const STEP_ORDER: StepKey[] = STEPS.map((s) => s.key);

const STEP_FALLBACK_MESSAGE: Record<StepKey, string> = {
  profile: "Kiểm tra lại hồ sơ",
  contact: "Kiểm tra lại liên hệ",
  terms: "Kiểm tra lại điều khoản",
};

const FIELDS = Object.keys(FIELD_STEP_MAP) as SupplierField[];

/** Các field thuộc một bước — dùng cho `trigger()` khi bấm "Tiếp". */
export function fieldsOfStep(step: StepKey): SupplierField[] {
  return FIELDS.filter((f) => FIELD_STEP_MAP[f] === step);
}

/** Bước sớm nhất theo thứ tự wizard trong danh sách field. */
export function earliestStep(fields: readonly SupplierField[]): StepKey | undefined {
  let best: StepKey | undefined;
  for (const field of fields) {
    const step = FIELD_STEP_MAP[field];
    if (!best || STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf(best)) best = step;
  }
  return best;
}

export function messageOf(
  errs: FieldErrors<SupplierFormValues>,
  field: SupplierField,
): string | undefined {
  const message = errs[field]?.message;
  return typeof message === "string" ? message : undefined;
}

/** Bước sớm nhất đang có lỗi. */
export function stepForErrors(errs: FieldErrors<SupplierFormValues>): StepKey | undefined {
  return earliestStep(FIELDS.filter((f) => messageOf(errs, f)));
}

/** Câu lỗi đầu tiên của một bước — đọc từ `errs` mới nhất (onInvalid), không từ snapshot. */
export function firstMessageForStep(errs: FieldErrors<SupplierFormValues>, step: StepKey): string {
  for (const field of fieldsOfStep(step)) {
    const message = messageOf(errs, field);
    if (message) return message;
  }
  return STEP_FALLBACK_MESSAGE[step];
}

/** Danh sách lỗi theo bước — cho checklist rà soát và trạng thái sidebar. */
export function issuesByStep(errs: FieldErrors<SupplierFormValues>): Map<StepKey, string[]> {
  const map = new Map<StepKey, string[]>();
  for (const field of FIELDS) {
    const message = messageOf(errs, field);
    if (!message) continue;
    const step = FIELD_STEP_MAP[field];
    map.set(step, [...(map.get(step) ?? []), message]);
  }
  return map;
}
