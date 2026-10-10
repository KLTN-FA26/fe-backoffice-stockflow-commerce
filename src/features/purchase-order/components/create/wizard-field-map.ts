import { STEPS } from "./types";

import type { FieldErrors } from "react-hook-form";
import type { PoCreateFieldPath, PoCreateFormValues } from "@/features/purchase-order";
import type { StepKey } from "./types";

type TopField = keyof PoCreateFormValues;

/** Single source of truth: field → bước wizard (theo mẫu wizard NCC). */
const FIELD_STEP: Record<TopField, StepKey> = {
  supplierId: "info",
  warehouseId: "info",
  currency: "info",
  expectedDate: "info",
  note: "info",
  lines: "lines",
};

const STEP_ORDER: StepKey[] = STEPS.map((s) => s.key);
const TOP_FIELDS = Object.keys(FIELD_STEP) as TopField[];

/** Field cần `trigger()` khi bấm "Tiếp tục" ở một bước (Tổng cộng / Rà soát không có ô nhập). */
export function fieldsOfStep(step: StepKey): TopField[] {
  return TOP_FIELDS.filter((f) => FIELD_STEP[f] === step);
}

/** `lines.2.orderedQty` → "lines"; `supplierId` → "info". */
export function stepOfPath(path: PoCreateFieldPath): StepKey {
  const top = path.split(".")[0];
  return top && top in FIELD_STEP ? FIELD_STEP[top as TopField] : "info";
}

/** Bước sớm nhất theo thứ tự wizard trong danh sách field (lỗi server → nhảy về đó). */
export function earliestStep(paths: readonly PoCreateFieldPath[]): StepKey | undefined {
  let best: StepKey | undefined;
  for (const path of paths) {
    const step = stepOfPath(path);
    if (!best || STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf(best)) best = step;
  }
  return best;
}

const messageOf = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null || !("message" in value)) return undefined;
  return typeof value.message === "string" ? value.message : undefined;
};

/** Danh sách lỗi theo bước — cho khung "Cần xử lý", checklist rà soát và trạng thái stepper. */
export function issuesByStep(errs: FieldErrors<PoCreateFormValues>): Map<StepKey, string[]> {
  const map = new Map<StepKey, string[]>();
  const push = (step: StepKey, message: string) =>
    map.set(step, [...(map.get(step) ?? []), message]);

  for (const field of ["supplierId", "warehouseId", "currency", "expectedDate"] as const) {
    const message = messageOf(errs[field]);
    if (message) push(FIELD_STEP[field], message);
  }
  // Lỗi cả mảng (vd "Cần ít nhất một dòng hàng") nằm ở `lines.root` hoặc `lines`.
  const linesError = errs.lines;
  const rootMessage = messageOf(linesError?.root) ?? messageOf(linesError);
  if (rootMessage) push("lines", rootMessage);
  if (Array.isArray(linesError)) {
    linesError.forEach((lineErrors: unknown, i) => {
      if (typeof lineErrors !== "object" || lineErrors === null) return;
      for (const value of Object.values(lineErrors)) {
        const message = messageOf(value);
        if (message) push("lines", `Dòng ${i + 1}: ${message}`);
      }
    });
  }
  return map;
}

/** Bước sớm nhất đang có lỗi. */
export function stepForErrors(errs: FieldErrors<PoCreateFormValues>): StepKey | undefined {
  const steps = [...issuesByStep(errs).keys()];
  return steps.sort((a, b) => STEP_ORDER.indexOf(a) - STEP_ORDER.indexOf(b))[0];
}
