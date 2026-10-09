/**
 * Purchase Order — map lỗi BE → câu tiếng Việt (đã thống nhất: mọi lỗi hiển thị tiếng Việt,
 * không lộ message thô tiếng Anh / UUID của BE). Theo mẫu `features/supplier/errors.ts`.
 */

import { ZodError } from "zod";

import { PO_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

/** Ngữ cảnh thao tác — cùng một `errorCode` có thể cần câu giải thích khác nhau. */
export type PoErrorContext = "send" | "recover" | "default";

type KnownErrorCode = Exclude<
  keyof typeof PO_ERROR_MESSAGES,
  "sendSupplierUnavailable" | "recoverConflict" | "generic"
>;

/** Tên trường BE (CreatePurchaseOrderRequest…) → nhãn tiếng Việt. */
const FIELD_LABELS: Record<string, string> = {
  supplierId: UI_LABELS.purchaseOrder.supplier,
  currency: UI_LABELS.purchaseOrder.currency,
  expectedAt: UI_LABELS.purchaseOrder.expectedDate,
  lines: UI_LABELS.purchaseOrder.lines,
  sku: UI_LABELS.purchaseOrder.sku,
  quantityOrdered: UI_LABELS.purchaseOrder.orderedQty,
  unitPrice: UI_LABELS.purchaseOrder.unitPrice,
  reason: "Lý do",
  note: "Ghi chú",
  status: UI_LABELS.purchaseOrder.supplierResponse,
  supplierReference: UI_LABELS.purchaseOrder.supplierReference,
};

function isKnownErrorCode(code: string): code is KnownErrorCode {
  return code in PO_ERROR_MESSAGES;
}

/** "lines[0].quantityOrdered" → "Dòng 1 — SL đặt". */
function fieldLabel(path: string): string {
  const line = /^lines\[(\d+)\]\.(\w+)$/.exec(path);
  if (line) return `Dòng ${Number(line[1]) + 1} — ${FIELD_LABELS[line[2] ?? ""] ?? line[2]}`;
  return FIELD_LABELS[path] ?? path;
}

/** Câu tiếng Việt cho lỗi khi thao tác với PO. */
export function poErrorMessage(error: unknown, context: PoErrorContext = "default"): string {
  if (error instanceof ZodError) return PO_ERROR_MESSAGES.CONTRACT_MISMATCH;
  if (!(error instanceof ApiError)) return PO_ERROR_MESSAGES.generic;
  const firstField = Object.keys(error.fieldErrors ?? {})[0];
  if (firstField) return `${PO_ERROR_MESSAGES.VALIDATION_FAILED}: ${fieldLabel(firstField)}`;
  // BE: nhận vượt "còn nhận được" là IllegalArgumentException → 400 chung, không có field.
  // BE publishDelivery: 409 CONFLICT chung khi NCC không nhận được PO (mã cụ thể đi nhánh dưới).
  if (context === "send" && error.code === "CONFLICT") {
    return PO_ERROR_MESSAGES.sendSupplierUnavailable;
  }
  // BE `requireDeliveryRecovery` + `publishDelivery`: 409 CONFLICT chung khi khôi phục gửi.
  if (context === "recover" && error.code === "CONFLICT") return PO_ERROR_MESSAGES.recoverConflict;
  if (isKnownErrorCode(error.code)) return PO_ERROR_MESSAGES[error.code];
  if (error.status === 403) return PO_ERROR_MESSAGES.FORBIDDEN;
  if (error.status === 404) return PO_ERROR_MESSAGES.PURCHASE_ORDER_NOT_FOUND;
  return PO_ERROR_MESSAGES.generic;
}

/** Lỗi nào nghĩa là dữ liệu PO trên màn đã cũ → cần tải lại. */
export function isStalePoError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 409 || (error.status === 400 && !error.fieldErrors))
  );
}
