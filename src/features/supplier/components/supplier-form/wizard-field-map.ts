import type { FieldErrors } from "react-hook-form";

import type { SupplierCreateInput } from "@/features/supplier/types";

import type { StepKey } from "./wizard-constants";

/** Single source of truth: field path → wizard step. */
export const FIELD_STEP_MAP: Record<string, StepKey> = {
  name: "profile",
  taxCode: "profile",
  code: "profile",
  contactName: "contact",
  contactPhone: "contact",
  contactEmail: "contact",
  // BE aliases — resolved before lookup
  email: "contact",
  phone: "contact",
  "address.street": "address",
  "address.ward": "address",
  "address.district": "address",
  "address.province": "address",
  "address.postalCode": "address",
  address: "address",
  paymentTerms: "terms",
  leadTimeDays: "terms",
  currency: "terms",
};

/** BE field name → FE form field. */
export const FIELD_ALIAS: Record<string, keyof SupplierCreateInput> = {
  email: "contactEmail",
  phone: "contactPhone",
};

const STEP_ORDER: StepKey[] = ["profile", "contact", "address", "terms"];

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

/** First step that has any validation error, preferring earliest wizard step. */
export function stepForErrors(errs: FieldErrors<SupplierCreateInput>): StepKey | undefined {
  const paths = collectErrorPaths(errs);
  let best: StepKey | undefined;
  let bestIdx = Infinity;
  for (const p of paths) {
    const step = FIELD_STEP_MAP[p];
    if (!step) continue;
    const idx = STEP_ORDER.indexOf(step);
    if (idx !== -1 && idx < bestIdx) {
      bestIdx = idx;
      best = step;
    }
  }
  return best;
}

/** Read a nested message by dot-path from errs (fresh onInvalid). */
function messageAt(errs: FieldErrors<SupplierCreateInput>, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = errs;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (cur && typeof cur === "object" && "message" in (cur as Record<string, unknown>)) {
    const m = (cur as Record<string, unknown>).message;
    return typeof m === "string" ? m : undefined;
  }
  return undefined;
}

/**
 * First validation message for a step — reads from fresh `errs` first,
 * avoids stale `validationByStep` snapshot (1-frame lag after trigger).
 */
export function firstMessageForStep(errs: FieldErrors<SupplierCreateInput>, step: StepKey): string {
  const stepFields = Object.entries(FIELD_STEP_MAP)
    .filter(([, s]) => s === step)
    .map(([field]) => field);
  for (const field of stepFields) {
    const msg = messageAt(errs, field);
    if (msg) return msg;
  }
  const fallback: Record<StepKey, string> = {
    profile: "Kiểm tra lại hồ sơ",
    contact: "Kiểm tra lại liên hệ",
    address: "Kiểm tra lại địa chỉ",
    terms: "Kiểm tra lại điều khoản",
  };
  return fallback[step];
}
