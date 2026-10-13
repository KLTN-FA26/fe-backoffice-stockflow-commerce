/**
 * Mock routes — chặng QC của goods receipt (docs 03 §4 bước 7–9), khớp BE PR #62:
 * `POST /goods-receipts/{id}/lines/{lineId}/qc-transfer` và `/inspection`.
 * Thứ tự kiểm giống BE: validate request → tra khu → luật aggregate (GoodsReceipt#moveToQc/inspect).
 */

import { registerMockRoute } from "./mock-adapter";
import {
  MOCK_RECEIPT_ACTOR,
  invalidReceiptTransition,
  loadReceipt,
  receiptNotFound,
  requireStatus,
  resolveArea,
  saveReceipt,
} from "./mock-routes-goods-receipts-store";
import { beError, isRecord, parseJsonBody, readString } from "./mock-routes-purchase-orders-store";

import type { AxiosRequestConfig } from "axios";
import type {
  MockInspection,
  MockReceipt,
  MockReceiptLine,
} from "./mock-routes-goods-receipts-store";
import type { MockFieldError } from "./mock-routes-purchase-orders-store";

const PATH = "/goods-receipts/:id/lines/:lineId";

function lineIdParam(config: AxiosRequestConfig): string {
  const params: unknown = "_mockParams" in config ? config._mockParams : undefined;
  return isRecord(params) ? readString(params.lineId) : "";
}

function findLine(receipt: MockReceipt, lineId: string) {
  const line = receipt.lines.find((l) => l.id === lineId);
  return line
    ? { line }
    : {
        error: beError(
          404,
          "GOODS_RECEIPT_NOT_FOUND",
          `Receipt ${receipt.number} has no line ${lineId}`,
        ),
      };
}

function withLine(
  receipt: MockReceipt,
  line: MockReceiptLine,
  status?: MockReceipt["status"],
  closedAt?: string,
) {
  return {
    ...receipt,
    status: status ?? receipt.status,
    closedAt: closedAt ?? receipt.closedAt,
    lines: receipt.lines.map((l) => (l.id === line.id ? line : l)),
  };
}

/* ── Chuyển sang khu QC (bước 7) ─────────────────────────────────────── */

async function moveToQc(config: AxiosRequestConfig) {
  const body = parseJsonBody(config.data);
  if (!readString(body.qcLocationCode)) {
    return beError(400, "VALIDATION_FAILED", "Invalid request data", [
      { field: "qcLocationCode", message: "must not be blank", code: "NotBlank" },
    ]);
  }
  const { id, receipt } = await loadReceipt(config);
  if (!receipt) return receiptNotFound(id);
  const area = resolveArea(body.qcLocationCode, "QUALITY_CONTROL");
  if (area.error) return area.error;
  const notInQc = requireStatus(receipt, "IN_QC", "move goods to QC on");
  if (notInQc) return notInQc;
  const found = findLine(receipt, lineIdParam(config));
  if (found.error) return found.error;
  const { line } = found;
  if (!line.qcRequired)
    return invalidReceiptTransition(
      "This line needs no QC; it goes straight to putaway (2-step flow)",
    );
  if (line.movedToQcAt)
    return invalidReceiptTransition("The goods of this line are already in the QC area");
  const moved: MockReceiptLine = {
    ...line,
    qcProgress: "IN_QC_AREA",
    qcLocationCode: area.code ?? null,
    movedToQcAt: new Date().toISOString(),
  };
  return saveReceipt(withLine(receipt, moved));
}

/* ── Kết luận QC (bước 8–9, BR-08) ───────────────────────────────────── */

interface Part {
  quantity: number;
  locationCode: string;
  reason: string;
}

/** `@Valid QcDecisionRequest`: accepted/quantity ≥ 0; phần có mặt cần locationCode + reason. */
function readDecision(body: Record<string, unknown>) {
  const errors: MockFieldError[] = [];
  const accepted = typeof body.accepted === "number" ? body.accepted : -1;
  if (accepted < 0)
    errors.push({
      field: "accepted",
      message: "must be greater than or equal to 0",
      code: "PositiveOrZero",
    });
  const part = (key: "quarantined" | "rejected"): Part | null => {
    const raw = body[key];
    if (!isRecord(raw)) return null;
    const quantity = typeof raw.quantity === "number" ? raw.quantity : -1;
    if (quantity < 0)
      errors.push({
        field: `${key}.quantity`,
        message: "must be greater than or equal to 0",
        code: "PositiveOrZero",
      });
    if (!readString(raw.locationCode))
      errors.push({ field: `${key}.locationCode`, message: "must not be blank", code: "NotBlank" });
    if (!readString(raw.reason))
      errors.push({ field: `${key}.reason`, message: "must not be blank", code: "NotBlank" });
    return { quantity, locationCode: readString(raw.locationCode), reason: readString(raw.reason) };
  };
  return { accepted, quarantined: part("quarantined"), rejected: part("rejected"), errors };
}

async function inspect(config: AxiosRequestConfig) {
  const decision = readDecision(parseJsonBody(config.data));
  if (decision.errors.length)
    return beError(400, "VALIDATION_FAILED", "Invalid request data", decision.errors);
  const { id, receipt } = await loadReceipt(config);
  if (!receipt) return receiptNotFound(id);
  const quarantineTo = decision.quarantined
    ? resolveArea(decision.quarantined.locationCode, "QUARANTINE")
    : null;
  if (quarantineTo?.error) return quarantineTo.error;
  const rejectTo = decision.rejected
    ? resolveArea(decision.rejected.locationCode, "QUARANTINE")
    : null;
  if (rejectTo?.error) return rejectTo.error;
  if (quarantineTo?.code && quarantineTo.code === rejectTo?.code) {
    return beError(
      400,
      "VALIDATION_FAILED",
      "Quarantined and rejected goods go to two different quarantine locations",
    );
  }

  const now = new Date().toISOString();
  const outcome = (
    kind: MockInspection["outcome"],
    qty: number,
    code: string | null,
    reason: string | null,
  ): MockInspection => ({
    id: crypto.randomUUID(),
    outcome: kind,
    quantity: qty,
    locationCode: code,
    reason,
    inspectedBy: MOCK_RECEIPT_ACTOR,
    inspectedAt: now,
  });
  const decided: MockInspection[] = [];
  if (decision.accepted > 0) decided.push(outcome("ACCEPTED", decision.accepted, null, null));
  if (decision.quarantined && decision.quarantined.quantity > 0) {
    decided.push(
      outcome(
        "QUARANTINE",
        decision.quarantined.quantity,
        quarantineTo?.code ?? null,
        decision.quarantined.reason,
      ),
    );
  }
  if (decision.rejected && decision.rejected.quantity > 0) {
    decided.push(
      outcome(
        "REJECTED",
        decision.rejected.quantity,
        rejectTo?.code ?? null,
        decision.rejected.reason,
      ),
    );
  }

  const notInQc = requireStatus(receipt, "IN_QC", "record QC on");
  if (notInQc) return notInQc;
  const found = findLine(receipt, lineIdParam(config));
  if (found.error) return found.error;
  const { line } = found;
  if (!line.movedToQcAt)
    return invalidReceiptTransition(
      "QC decides only on goods already moved to the QC area (BR-08)",
    );
  if (line.qcProgress === "INSPECTED")
    return invalidReceiptTransition("This line has already been inspected");
  const total = decided.reduce((sum, d) => sum + d.quantity, 0);
  if (total !== line.quantity) {
    return beError(
      409,
      "QC_QUANTITY_MISMATCH",
      `Accepted, quarantined and rejected add up to ${total}; ${line.quantity} units were moved to QC`,
    );
  }

  const inspected: MockReceiptLine = {
    ...line,
    qcProgress: "INSPECTED",
    quantityForPutaway: decision.accepted,
    inspections: decided,
  };
  const next = withLine(receipt, inspected);
  // GoodsReceipt#inspect: dòng QC cuối cùng có kết luận → In Putaway, hoặc Closed nếu không còn gì để cất
  const allDecided = next.lines
    .filter((l) => l.qcRequired)
    .every((l) => l.qcProgress === "INSPECTED");
  if (!allDecided) return saveReceipt(next);
  const anythingToPutAway = next.lines.some((l) => l.quantityForPutaway > 0);
  return saveReceipt(
    anythingToPutAway
      ? { ...next, status: "IN_PUTAWAY" }
      : { ...next, status: "CLOSED", closedAt: now },
  );
}

export function registerGoodsReceiptQcMockRoutes(): void {
  registerMockRoute("POST", `${PATH}/qc-transfer`, moveToQc);
  registerMockRoute("POST", `${PATH}/inspection`, inspect);
}
