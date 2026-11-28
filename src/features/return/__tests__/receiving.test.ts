import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  candidateByLpn,
  progressPercent,
  remainingOf,
  rmaReceiving,
  splitCandidates,
} from "../receiving";
import { candidateProblem } from "../scan-checks";
import { returnScanErrorMessage } from "../scan-errors";
import { scanProgress } from "../selectors";

import type { CandidateCarton, ReturnProgress } from "../types";

const row = (over: Partial<ReturnProgress> = {}): ReturnProgress => ({
  sku: "SKU-B",
  approvedQuantity: 15,
  confirmedReceivedQuantity: 0,
  currentReceiptQuantity: 0,
  remainingQuantity: 15,
  ...over,
});
const carton = (over: Partial<CandidateCarton> = {}): CandidateCarton => ({
  lpn: "LPN-1",
  sku: "SKU-B",
  lotNumber: null,
  quantity: 20,
  maxReceivableQuantity: 15,
  eligibility: "COUNT_REQUIRED",
  ...over,
});

describe("rmaReceiving (WF-05 BE-22: by units of each approved SKU)", () => {
  it("is null for a carrier's return or an older BE — the screen keeps the carton reconciliation", () => {
    expect(
      rmaReceiving({ returnRequestId: null, returnProgress: [row()], status: "DRAFT" }),
    ).toBeNull();
    expect(
      rmaReceiving({ returnRequestId: "r", returnProgress: undefined, status: "DRAFT" }),
    ).toBeNull();
  });

  it("a draft that recorded everything is counted, awaiting confirmation — not received", () => {
    const counted = rmaReceiving({
      returnRequestId: "r",
      returnProgress: [row({ currentReceiptQuantity: 15, remainingQuantity: 0 })],
      status: "DRAFT",
    });
    expect(counted).toMatchObject({
      complete: true,
      countedAwaitingConfirmation: true,
      current: 15,
    });
    const closed = rmaReceiving({
      returnRequestId: "r",
      returnProgress: [row({ currentReceiptQuantity: 15, remainingQuantity: 0 })],
      status: "CLOSED",
    });
    expect(closed?.countedAwaitingConfirmation).toBe(false);
  });

  it("five cartons of 20, 20 approved: one carton is the whole target", () => {
    const done = row({ approvedQuantity: 20, currentReceiptQuantity: 20, remainingQuantity: 0 });
    expect(progressPercent(done)).toBe(100);
    expect(progressPercent(row({ approvedQuantity: 20, confirmedReceivedQuantity: 5 }))).toBe(25);
  });

  it("workable candidates and excluded ones are split; the cartons on the receipt are in neither", () => {
    const { workable, excluded } = splitCandidates([
      carton({ lpn: "A", eligibility: "RECEIVABLE" }),
      carton({ lpn: "B" }),
      carton({ lpn: "C", eligibility: "ON_THIS_RECEIPT" }),
      carton({ lpn: "D", eligibility: "SKU_NOT_APPROVED" }),
      carton({ lpn: "E", eligibility: "UNKNOWN" }),
    ]);
    expect(workable.map((c) => c.lpn)).toEqual(["A", "B"]);
    expect(excluded.map((c) => c.lpn)).toEqual(["D", "E"]);
  });

  it("finds a candidate by LPN regardless of case; remaining of a SKU, null when not approved", () => {
    expect(candidateByLpn([carton()], " lpn-1 ")?.lpn).toBe("LPN-1");
    expect(remainingOf({ returnProgress: [row({ remainingQuantity: 7 })] }, "SKU-B")).toBe(7);
    expect(remainingOf({ returnProgress: [row()] }, "SKU-X")).toBeNull();
  });
});

describe("candidateProblem — advisory checks before sending (BE decides again)", () => {
  it("a carton above what remains is never sent sealed, and its count is capped", () => {
    expect(candidateProblem(carton(), false, 0)).toMatch(
      /Thùng nguyên vượt số còn nhận được \(15\)/,
    );
    expect(candidateProblem(carton(), true, 16)).toMatch(/vượt số còn nhận được \(15\)/);
    expect(candidateProblem(carton(), true, 15)).toBeNull();
    expect(
      candidateProblem(carton({ eligibility: "RECEIVABLE", maxReceivableQuantity: 20 }), false, 0),
    ).toBeNull();
    expect(candidateProblem(undefined, false, 0)).toBeNull();
  });
});

describe("returnScanErrorMessage — the BE details say why", () => {
  const error = (code: string, details: Record<string, unknown>) =>
    new ApiError(409, code, "x", undefined, undefined, undefined, undefined, details);

  it("SKU not approved vs above what remains", () => {
    expect(returnScanErrorMessage(error("RETURN_CARTON_NOT_CLAIMED", { approved: 0 }))).toMatch(
      /không được duyệt trả/,
    );
    expect(
      returnScanErrorMessage(
        error("RETURN_CARTON_NOT_CLAIMED", { approved: 15, alreadyBack: 5, units: 20 }),
      ),
    ).toMatch(/mang 20 đơn vị nhưng chỉ còn nhận được 10/);
  });

  it("already back, came back opened, the customer's goods", () => {
    expect(
      returnScanErrorMessage(error("RETURN_CARTON_IN_WAREHOUSE", { reason: "IN_WAREHOUSE" })),
    ).toMatch(/đã về kho/);
    expect(
      returnScanErrorMessage(error("RETURN_CARTON_IN_WAREHOUSE", { reason: "RETURNED_OPENED" })),
    ).toMatch(/đã mở và đã bị huỷ/);
    expect(
      returnScanErrorMessage(error("RETURN_CARTON_IN_WAREHOUSE", { reason: "CUSTOMER_GOODS" })),
    ).toMatch(/giữ hộ/);
  });
});

describe("scanProgress (RTO) — a carton back on an earlier trip is not missing", () => {
  it("leaves earlier cartons out of the expected and missing counts", () => {
    const progress = scanProgress({
      cartons: [{ lpn: "L2", sku: "S", quantity: 1 }],
      expectedCartons: [
        { lpn: "L1", sku: "S", quantity: 1, scanned: false, receivedEarlier: true },
        { lpn: "L2", sku: "S", quantity: 1, scanned: true, receivedEarlier: false },
        { lpn: "L3", sku: "S", quantity: 1, scanned: false, receivedEarlier: false },
      ],
    });
    expect(progress).toMatchObject({ scanned: 1, expected: 2, earlier: 1 });
    expect(progress.missing.map((c) => c.lpn)).toEqual(["L3"]);
  });
});
