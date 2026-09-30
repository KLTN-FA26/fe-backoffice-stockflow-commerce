import { STEPS } from "./wizard-constants";

import type { FieldErrors, FieldPath } from "react-hook-form";
import type { SupplierCreateInput } from "@/features/supplier/types";
import type { StepKey } from "./wizard-constants";

type SupplierFieldPath = FieldPath<SupplierCreateInput>;

/** Single source of truth: field path → wizard step. */
export const FIELD_STEP_MAP: Partial<Record<SupplierFieldPath, StepKey>> = {
  code: "profile",
  name: "profile",
  taxCode: "profile",
  contactName: "contact",
  contactPhone: "contact",
  contactEmail: "contact",
  address: "address",
  "address.street": "address",
  "address.ward": "address",
  "address.district": "address",
  "address.province": "address",
  "address.postalCode": "address",
  "address.country": "address",
  paymentTerms: "terms",
  currency: "terms",
  leadTimeDays: "terms",
};

/** BE field name → FE form field (resolve trước khi tra FIELD_STEP_MAP). */
export const FIELD_ALIAS: Record<string, SupplierFieldPath> = {
  email: "contactEmail",
  phone: "contactPhone",
};

const STEP_ORDER: StepKey[] = STEPS.map((s) => s.key);

const STEP_FALLBACK_MESSAGE: Record<StepKey, string> = {
  profile: "Kiểm tra lại hồ sơ",
  contact: "Kiểm tra lại liên hệ",
  address: "Kiểm tra lại địa chỉ",
  terms: "Kiểm tra lại điều khoản",
};

function isMappedPath(path: string): path is SupplierFieldPath {
  return path in FIELD_STEP_MAP;
}

/** Bước sớm nhất theo thứ tự wizard trong danh sách path. */
function earliestStep(paths: string[]): StepKey | undefined {
  let best: StepKey | undefined;
  for (const p of paths) {
    const step = isMappedPath(p) ? FIELD_STEP_MAP[p] : undefined;
    if (step && (!best || STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf(best))) best = step;
  }
  return best;
}

/** Collect dot-paths of every node that has an RHF error (recursively). */
function collectErrorPaths(errs: FieldErrors<SupplierCreateInput>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, val] of Object.entries(errs as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!val || typeof val !== "object") continue;
    const node = val as Record<string, unknown>;
    if ("message" in node && typeof node.message === "string") {
      out.push(path);
    } else {
      out.push(...collectErrorPaths(val as FieldErrors<SupplierCreateInput>, path));
    }
  }
  return out;
}

/** Read a nested message by dot-path from RHF errors. */
export function messageAt(
  errs: FieldErrors<SupplierCreateInput>,
  path: string,
): string | undefined {
  let cur: unknown = errs;
  for (const part of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (cur && typeof cur === "object" && "message" in cur) {
    const m = (cur as Record<string, unknown>).message;
    return typeof m === "string" ? m : undefined;
  }
  return undefined;
}

/** First step that has any validation error, preferring earliest wizard step. */
export function stepForErrors(errs: FieldErrors<SupplierCreateInput>): StepKey | undefined {
  return earliestStep(collectErrorPaths(errs));
}

/** First validation message for a step — đọc từ `errs` mới nhất (onInvalid), không từ snapshot. */
export function firstMessageForStep(errs: FieldErrors<SupplierCreateInput>, step: StepKey): string {
  for (const [field, s] of Object.entries(FIELD_STEP_MAP)) {
    if (s !== step) continue;
    const msg = messageAt(errs, field);
    if (msg) return msg;
  }
  return STEP_FALLBACK_MESSAGE[step];
}

export interface ResolvedServerErrors {
  fields: { path: SupplierFieldPath; message: string }[];
  step: StepKey | undefined;
}

/**
 * `ApiError.fieldErrors` (§4.4) → path form + bước sớm nhất cần nhảy tới.
 * Hỗ trợ alias BE (`email`/`phone`) và path lồng (`address.street`); field lạ bị bỏ qua
 * (toast chung của mutation vẫn hiện message server).
 */
export function resolveServerFieldErrors(
  fieldErrors: Record<string, string>,
): ResolvedServerErrors {
  const fields: ResolvedServerErrors["fields"] = [];
  for (const [field, message] of Object.entries(fieldErrors)) {
    const path = FIELD_ALIAS[field] ?? field;
    if (isMappedPath(path)) fields.push({ path, message });
  }
  return { fields, step: earliestStep(fields.map((f) => f.path)) };
}
