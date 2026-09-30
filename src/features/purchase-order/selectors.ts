/**
 * Purchase Order — selectors (pure derivations).
 *
 * Source: BE PurchaseOrder aggregate (open quantity semantics),
 * plus list-stats derived from BE 7-state.
 */

import { PO_STATUS } from "@/constants";
import { formatMoney } from "@/lib/format";

import { receiveGoodsLineInputSchema } from "./schemas";

import type { PurchaseOrder, PoLine, PoStatus } from "./types";

export { formatMoney };

/** BE `POLineResponse.openQuantity` — the BE is the source of truth, never recomputed here. */
export function openQuantity(line: PoLine): number {
  return line.openQuantity;
}

export function totalOpenQuantity(po: PurchaseOrder): number {
  return po.lines.reduce((sum, line) => sum + openQuantity(line), 0);
}

export function totalOrderedQuantity(po: PurchaseOrder): number {
  return po.lines.reduce((sum, line) => sum + line.orderedQty, 0);
}

export function totalReceivedQuantity(po: PurchaseOrder): number {
  return po.lines.reduce((sum, line) => sum + line.receivedQty, 0);
}

/** Statuses that should flag a row in the list table. */
const FLAGGED_STATUSES: readonly PoStatus[] = [PO_STATUS.CANCELLED];

export function shouldFlagPoRow(po: PurchaseOrder): boolean {
  return FLAGGED_STATUSES.includes(po.status);
}

/* ── Receive goods draft ─────────────────────────────────────────────── */

export interface ReceiveDraftResult {
  /** Valid lines, ready for POST /receipts. */
  lines: { lineId: string; quantity: number }[];
  /** Inline error per lineId. */
  errors: Record<string, string>;
}

/**
 * Validate the "Nhận hàng" form before it reaches the BE.
 *
 * BR-04 (docs 02 §6): tổng SL nhận của một dòng ≤ SL đặt × (1 + dung sai nhận vượt).
 * ASSUMPTION (open-question C9): dung sai chưa chốt/chưa có cấu hình — BE `PoLine#receive`
 * đang dùng dung sai = 0 (qty ≤ openQuantity), FE mirror đúng giới hạn đó.
 * Vi phạm ở BE là IllegalArgumentException → 400 chung không có field, nên FE phải tự báo lý do.
 * Empty inputs are skipped (not every line has to be received in one go).
 */
export function validateReceiveDraft(
  poLines: readonly PoLine[],
  draft: Readonly<Record<string, string>>,
): ReceiveDraftResult {
  const result: ReceiveDraftResult = { lines: [], errors: {} };
  for (const line of poLines) {
    const raw = (draft[line.lineId] ?? "").trim();
    if (raw === "") continue;
    const parsed = receiveGoodsLineInputSchema.shape.quantity.safeParse(Number(raw));
    if (!parsed.success) {
      result.errors[line.lineId] = parsed.error.issues[0]?.message ?? "SL nhận không hợp lệ";
      continue;
    }
    const quantity = parsed.data;
    if (quantity > line.openQuantity) {
      result.errors[line.lineId] = `Vượt SL còn nhận được (${line.openQuantity})`;
    } else {
      result.lines.push({ lineId: line.lineId, quantity });
    }
  }
  return result;
}
