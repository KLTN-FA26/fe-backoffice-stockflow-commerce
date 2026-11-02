/**
 * Mock routes — chặng QC của goods receipt (docs 03 §4 bước 7–9), khớp BE PR #62:
 * `POST /goods-receipts/{id}/lines/{lineId}/qc-transfer` và `/inspection`.
 * Thứ tự kiểm giống BE: validate request → tra khu → luật aggregate (GoodsReceipt#moveToQc/inspect).
 */

import { registerMockRoute } from "./mock-adapter";
import { shownPackages } from "./mock-receipt-cartons";
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
    // SCRUM-473 §5: mọi thùng IN_STOCK của dòng sang khu QC nguyên thùng, giữ LPN
    packages: line.packages?.map((p) =>
      p.status === "IN_STOCK" ? { ...p, locationCode: area.code ?? p.locationCode } : p,
    ),
  };
  return saveReceipt(withLine(receipt, moved));
}

/* ── Kết luận QC (bước 8–9, BR-08) ───────────────────────────────────── */

interface Part {
  /** Hàng lẻ (SCRUM-473: thùng nêu ở `packages`). */
  quantity: number;
  locationCode: string;
  reason: string;
  packages: string[];
}

const hasGoods = (part: Part | null): part is Part =>
  !!part && (part.quantity > 0 || part.packages.length > 0);

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
    const packages = Array.isArray(raw.packages)
      ? raw.packages.map((lpn) => readString(lpn).toUpperCase())
      : [];
    // BE: phần không có hàng (0 lẻ, không thùng) không cần khu / lý do
    if (quantity > 0 || packages.length > 0) {
      if (!readString(raw.locationCode))
        errors.push({
          field: `${key}.locationCode`,
          message: "must not be blank",
          code: "NotBlank",
        });
      if (!readString(raw.reason))
        errors.push({ field: `${key}.reason`, message: "must not be blank", code: "NotBlank" });
    }
    return {
      quantity,
      locationCode: readString(raw.locationCode),
      reason: readString(raw.reason),
      packages,
    };
  };
  return { accepted, quarantined: part("quarantined"), rejected: part("rejected"), errors };
}

async function inspect(config: AxiosRequestConfig) {
  const decision = readDecision(parseJsonBody(config.data));
  if (decision.errors.length)
    return beError(400, "VALIDATION_FAILED", "Invalid request data", decision.errors);
  const { id, receipt } = await loadReceipt(config);
  if (!receipt) return receiptNotFound(id);
  const quarantineTo = hasGoods(decision.quarantined)
    ? resolveArea(decision.quarantined.locationCode, "QUARANTINE")
    : null;
  if (quarantineTo?.error) return quarantineTo.error;
  const rejectTo = hasGoods(decision.rejected)
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
  // SCRUM-473 §5: thùng nêu tên phải là thùng của dòng, mỗi LPN một phần; tính nguyên thùng theo receivedQty
  const cartons = shownPackages(line);
  const named = new Map<string, "quarantined" | "rejected">();
  const inCartons = { quarantined: 0, rejected: 0 };
  for (const key of ["quarantined", "rejected"] as const) {
    for (const [j, lpn] of (decision[key]?.packages ?? []).entries()) {
      const carton = cartons.find((c) => c.lpn === lpn);
      const field = `${key}.packages[${j}]`;
      if (!carton)
        return beError(
          404,
          "STOCK_PACKAGE_NOT_FOUND",
          `${lpn} is not a carton of this receipt line`,
          [
            {
              field,
              message: `${lpn} is not a carton of this receipt line`,
              code: "STOCK_PACKAGE_NOT_FOUND",
            },
          ],
        );
      if (named.has(lpn))
        return beError(
          400,
          "VALIDATION_FAILED",
          `${lpn} is named twice; a carton goes to one place`,
          [{ field, message: `${lpn} is named twice`, code: "VALIDATION_FAILED" }],
        );
      if (carton.status !== "IN_STOCK")
        return beError(409, "INVALID_STOCK_PACKAGE_TRANSITION", `${lpn} is ${carton.status}`, [
          {
            field,
            message: `${lpn} is ${carton.status}`,
            code: "INVALID_STOCK_PACKAGE_TRANSITION",
          },
        ]);
      if (carton.locationCode !== line.qcLocationCode)
        return beError(422, "STOCK_PACKAGE_WRONG_LOCATION", `${lpn} is at ${carton.locationCode}`, [
          {
            field,
            message: `${lpn} is at ${carton.locationCode}`,
            code: "STOCK_PACKAGE_WRONG_LOCATION",
          },
        ]);
      named.set(lpn, key);
      inCartons[key] += carton.receivedQty;
    }
  }
  const decided: MockInspection[] = [];
  if (decision.accepted > 0) decided.push(outcome("ACCEPTED", decision.accepted, null, null));
  const quarantined = decision.quarantined;
  if (hasGoods(quarantined))
    decided.push(
      outcome(
        "QUARANTINE",
        quarantined.quantity + inCartons.quarantined,
        quarantineTo?.code ?? null,
        quarantined.reason,
      ),
    );
  const rejected = decision.rejected;
  if (hasGoods(rejected))
    decided.push(
      outcome(
        "REJECTED",
        rejected.quantity + inCartons.rejected,
        rejectTo?.code ?? null,
        rejected.reason,
      ),
    );
  const total = decided.reduce((sum, d) => sum + d.quantity, 0);
  const looseTaken = (quarantined?.quantity ?? 0) + (rejected?.quantity ?? 0);
  const looseRemainder = line.quantity - cartons.reduce((sum, c) => sum + c.receivedQty, 0);
  if (looseTaken > looseRemainder)
    return beError(
      409,
      "QC_QUANTITY_MISMATCH",
      `The quarantined and rejected parts take ${looseTaken} loose units; the line has ${looseRemainder} outside its cartons (BR-08)`,
    );
  if (total !== line.quantity) {
    return beError(
      409,
      "QC_QUANTITY_MISMATCH",
      `Accepted, quarantined and rejected add up to ${total}; ${line.quantity} units were moved to QC`,
    );
  }

  const areaOf = { quarantined: quarantineTo?.code, rejected: rejectTo?.code };
  const inspected: MockReceiptLine = {
    ...line,
    qcProgress: "INSPECTED",
    quantityForPutaway: decision.accepted,
    inspections: decided,
    // Thùng cách ly / không đạt sang khu của phần đó nguyên thùng, giữ LPN
    packages: line.packages?.map((p) => {
      const key = named.get(p.lpn);
      return key ? { ...p, locationCode: areaOf[key] ?? p.locationCode } : p;
    }),
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
