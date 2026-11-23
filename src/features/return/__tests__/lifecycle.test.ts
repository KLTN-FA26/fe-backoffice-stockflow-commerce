import { describe, expect, it } from "vitest";

import { GOODS_RECEIPT_PERMISSIONS } from "@/constants/permissions";
import {
  RETURN_API_STATUSES,
  RETURN_RECEIPT_API_STATUSES,
  RETURN_RECEIPT_APPROVAL_PERMISSIONS,
  RMA_CUSTODY_PERMISSIONS,
  RMA_PERMISSIONS,
  RMA_RESOLUTION_PERMISSIONS,
} from "@/constants/returns";

import {
  RETURN_RECEIPT_TRANSITIONS,
  RETURN_TRANSITIONS,
  allowedReturnActions,
  allowedReturnReceiptActions,
  canAddCustody,
  canAddReturnEvidence,
  canRecordCustodyChoice,
  isReturnOpen,
  needsManagerConfirmation,
  returnReceiptConfirmBlock,
} from "../lifecycle";

import type { PermissionCode } from "@/lib/auth/me-permissions";

// Bộ quyền theo seed BE (baseline V20261111000000)
const SALES: PermissionCode[] = [
  ...Object.values(RMA_PERMISSIONS),
  RMA_RESOLUTION_PERMISSIONS.propose,
];
const ACCOUNTANT: PermissionCode[] = [
  RMA_PERMISSIONS.viewPage,
  RMA_PERMISSIONS.read,
  RMA_RESOLUTION_PERMISSIONS.approve,
];
const WAREHOUSE: PermissionCode[] = [
  RMA_PERMISSIONS.viewPage,
  RMA_PERMISSIONS.read,
  ...Object.values(GOODS_RECEIPT_PERMISSIONS),
];
const as = (grants: PermissionCode[]) => (code: PermissionCode) => grants.includes(code);

/** Một dòng của yêu cầu: số đã duyệt và số đã về. */
const line = (approvedQuantity: number, receivedQuantity: number) => ({
  id: "line-1",
  orderLineId: "ol-1",
  sku: "SKU-1",
  customPrinted: false,
  unitPrice: 100_000,
  requestedQuantity: approvedQuantity,
  approvedQuantity,
  receivedQuantity,
  refundQuantity: 0,
});
const parcel = { parcel: 1, goodsReceiptId: "gr-1", receiptNumber: "GR-RET-0001" };

describe("RETURN_TRANSITIONS (BE ReturnStatus.canTransitionTo)", () => {
  it("covers every BE status", () => {
    expect(Object.keys(RETURN_TRANSITIONS).sort()).toEqual(
      [...RETURN_API_STATUSES, "UNKNOWN"].sort(),
    );
    // WF-05 BO-11: trạng thái BE thêm sau không mở thao tác nào
    expect(RETURN_TRANSITIONS.UNKNOWN).toEqual([]);
  });

  it("REQUESTED → AWAITING_RETURN / REJECTED / CANCELLED; refund goes back to RECEIVED when sent back", () => {
    expect(RETURN_TRANSITIONS.REQUESTED).toEqual(["AWAITING_RETURN", "REJECTED", "CANCELLED"]);
    expect(RETURN_TRANSITIONS.SETTLEMENT_PENDING).toEqual(["RESOLVED", "RECEIVED"]);
  });

  it("RESOLVED, REJECTED and the historical INSPECTED are terminal", () => {
    expect(RETURN_TRANSITIONS.RESOLVED).toEqual([]);
    expect(RETURN_TRANSITIONS.REJECTED).toEqual([]);
    expect(RETURN_TRANSITIONS.INSPECTED).toEqual([]);
  });

  it("open statuses keep the order from completing (BR-ORD-005)", () => {
    expect(RETURN_API_STATUSES.filter(isReturnOpen)).toEqual([
      "REQUESTED",
      "AWAITING_RETURN",
      "RECEIVED",
      "SETTLEMENT_PENDING",
    ]);
  });
});

describe("allowedReturnActions — three roles", () => {
  it("Sales decide a REQUESTED claim and may withdraw it; accountant and warehouse may not", () => {
    expect(allowedReturnActions({ status: "REQUESTED" }, as(SALES))).toEqual([
      "approve",
      "reject",
      "cancel",
    ]);
    expect(allowedReturnActions({ status: "REQUESTED" }, as(ACCOUNTANT))).toEqual([]);
    expect(allowedReturnActions({ status: "REQUESTED" }, as(WAREHOUSE))).toEqual([]);
  });

  it("AWAITING_RETURN: warehouse opens the return receipt (17 BR-18), Sales may still withdraw", () => {
    expect(allowedReturnActions({ status: "AWAITING_RETURN" }, as(WAREHOUSE))).toEqual([
      "createReceipt",
    ]);
    expect(allowedReturnActions({ status: "AWAITING_RETURN" }, as(SALES))).toEqual(["cancel"]);
  });

  it("RECEIVED: Sales propose the refund; SETTLEMENT_PENDING: only the accountant decides (four eyes)", () => {
    const back = { status: "RECEIVED" as const, lines: [line(2, 2)] };
    expect(allowedReturnActions(back, as(SALES))).toEqual(["propose"]);
    expect(allowedReturnActions(back, as(ACCOUNTANT))).toEqual([]);
    expect(allowedReturnActions({ status: "SETTLEMENT_PENDING" }, as(ACCOUNTANT))).toEqual([
      "approveSettlement",
      "rejectSettlement",
    ]);
    expect(allowedReturnActions({ status: "SETTLEMENT_PENDING" }, as(SALES))).toEqual([]);
  });

  it("terminal statuses render no mutating button for anyone", () => {
    const everyone = as([...SALES, ...ACCOUNTANT, ...WAREHOUSE]);
    for (const status of ["RESOLVED", "REJECTED", "CANCELLED", "EXPIRED", "INSPECTED"] as const)
      expect(allowedReturnActions({ status }, everyone)).toEqual([]);
  });
});

describe("return receipt", () => {
  it("covers every receipt status; only DRAFT moves", () => {
    expect(Object.keys(RETURN_RECEIPT_TRANSITIONS).sort()).toEqual(
      [...RETURN_RECEIPT_API_STATUSES, "UNKNOWN"].sort(),
    );
    expect(RETURN_RECEIPT_TRANSITIONS.UNKNOWN).toEqual([]);
    expect(RETURN_RECEIPT_TRANSITIONS.DRAFT).toEqual(["CLOSED", "CANCELLED"]);
    expect(RETURN_RECEIPT_TRANSITIONS.CLOSED).toEqual([]);
  });

  it("a draft without cartons cannot be confirmed; Sales cannot touch it", () => {
    expect(allowedReturnReceiptActions({ status: "DRAFT", cartons: [] }, as(WAREHOUSE))).toEqual([
      "scan",
      "cancel",
    ]);
    expect(
      allowedReturnReceiptActions({ status: "DRAFT", cartons: [{}] }, as(WAREHOUSE)),
    ).toContain("confirm");
    expect(allowedReturnReceiptActions({ status: "DRAFT", cartons: [{}] }, as(SALES))).toEqual([]);
    expect(allowedReturnReceiptActions({ status: "CLOSED", cartons: [{}] }, as(WAREHOUSE))).toEqual(
      [],
    );
  });
});

describe("WF-05 — parcels, goods complete, closure without refund", () => {
  it("RECEIVED → RESOLVED is allowed (closure without refund)", () => {
    expect(RETURN_TRANSITIONS.RECEIVED).toEqual(["SETTLEMENT_PENDING", "RESOLVED"]);
  });

  it("TH-3: once a parcel is back, Sales mark the goods complete instead of withdrawing", () => {
    const partly = { status: "AWAITING_RETURN" as const, receipt: { parcels: [parcel] } };
    expect(allowedReturnActions(partly, as(SALES))).toEqual(["goodsComplete"]);
    expect(
      allowedReturnActions(
        { status: "AWAITING_RETURN", receipt: { goodsReceiptId: "gr-1" } },
        as(SALES),
      ),
    ).toEqual(["goodsComplete"]);
    // Chưa có kiện nào về: rút được, chưa chốt được
    expect(
      allowedReturnActions({ status: "AWAITING_RETURN", receipt: { parcels: [] } }, as(SALES)),
    ).toEqual(["cancel"]);
    // Kế toán / kho không chốt hàng về
    expect(allowedReturnActions(partly, as(ACCOUNTANT))).toEqual([]);
    expect(allowedReturnActions(partly, as(WAREHOUSE))).toEqual(["createReceipt"]);
  });

  it("TH-4: nothing refundable → close without refund replaces the refund proposal", () => {
    const empty = { status: "RECEIVED" as const, lines: [line(2, 0)] };
    expect(allowedReturnActions(empty, as(SALES))).toEqual(["closeWithoutRefund"]);
    expect(allowedReturnActions(empty, as(ACCOUNTANT))).toEqual([]);
    const some = { status: "RECEIVED" as const, lines: [line(2, 0), line(1, 1)] };
    expect(allowedReturnActions(some, as(SALES))).toEqual(["propose"]);
  });

  it("claim photos: REQUESTED / AWAITING_RETURN with sales-rmas:CREATE only", () => {
    expect(canAddReturnEvidence({ status: "REQUESTED" }, as(SALES))).toBe(true);
    expect(canAddReturnEvidence({ status: "AWAITING_RETURN" }, as(SALES))).toBe(true);
    expect(canAddReturnEvidence({ status: "RECEIVED" }, as(SALES))).toBe(false);
    expect(canAddReturnEvidence({ status: "REQUESTED" }, as(ACCOUNTANT))).toBe(false);
  });

  it("TH-4 loose units: only on a draft against a return request; they alone allow the confirmation", () => {
    const draft = { status: "DRAFT" as const, cartons: [], returnRequestId: "ret-1" };
    expect(allowedReturnReceiptActions(draft, as(WAREHOUSE))).toEqual(["scan", "loose", "cancel"]);
    expect(allowedReturnReceiptActions({ ...draft, looseLines: [{}] }, as(WAREHOUSE))).toEqual([
      "scan",
      "loose",
      "confirm",
      "cancel",
    ]);
    expect(
      allowedReturnReceiptActions(
        { status: "DRAFT", cartons: [{}], returnRequestId: null },
        as(WAREHOUSE),
      ),
    ).toEqual(["scan", "remove", "confirm", "cancel"]);
    expect(
      allowedReturnReceiptActions({ ...draft, status: "CLOSED", looseLines: [{}] }, as(WAREHOUSE)),
    ).toEqual([]);
  });
});

describe("WF-05 decisions on the return screen", () => {
  const everyone = as([...SALES, ...ACCOUNTANT, ...WAREHOUSE]);

  it("BO-11: a status the FE does not know offers no action to anyone, and is not open", () => {
    expect(
      allowedReturnActions(
        { status: "UNKNOWN", lines: [line(2, 2)], receiptOpenable: true },
        everyone,
      ),
    ).toEqual([]);
    expect(isReturnOpen("UNKNOWN")).toBe(false);
    expect(
      allowedReturnReceiptActions({ status: "UNKNOWN", cartons: [1], looseLines: [] }, everyone),
    ).toEqual([]);
  });

  it("Q-4: Sales still propose while units are refundable (the 0 refund goes through the same proposal)", () => {
    expect(allowedReturnActions({ status: "RECEIVED", lines: [line(2, 2)] }, as(SALES))).toEqual([
      "propose",
    ]);
    // nothing refundable: closure without refund, not a proposal
    expect(allowedReturnActions({ status: "RECEIVED", lines: [line(2, 0)] }, as(SALES))).toEqual([
      "closeWithoutRefund",
    ]);
  });

  it("Q-11 / BE-13: the receipt opens where the BE says so — late parcels too — and never where it says no", () => {
    for (const status of ["RECEIVED", "SETTLEMENT_PENDING", "EXPIRED", "CANCELLED"] as const)
      expect(allowedReturnActions({ status, receiptOpenable: true }, as(WAREHOUSE))).toContain(
        "createReceipt",
      );
    expect(
      allowedReturnActions({ status: "AWAITING_RETURN", receiptOpenable: false }, as(WAREHOUSE)),
    ).not.toContain("createReceipt");
    // old BE without the flag: only while awaiting the goods
    expect(allowedReturnActions({ status: "AWAITING_RETURN" }, as(WAREHOUSE))).toContain(
      "createReceipt",
    );
    expect(allowedReturnActions({ status: "RECEIVED" }, as(WAREHOUSE))).not.toContain(
      "createReceipt",
    );
    // the permission still decides
    expect(
      allowedReturnActions({ status: "RECEIVED", receiptOpenable: true }, as(SALES)),
    ).not.toContain("createReceipt");
  });

  it("BE-23: 'Đã nhận đủ hàng' is not offered while a draft receipt is being counted", () => {
    const back = { status: "AWAITING_RETURN" as const, receipt: { parcels: [parcel] } };
    expect(allowedReturnActions(back, as(SALES))).toContain("goodsComplete");
    expect(allowedReturnActions({ ...back, receiptDraftOpen: true }, as(SALES))).not.toContain(
      "goodsComplete",
    );
    expect(allowedReturnActions({ ...back, receiptDraftOpen: false }, as(SALES))).toContain(
      "goodsComplete",
    );
  });

  it("BE-23 (BE G4): nor a refund proposal, its approval, a closure without refund or a second receipt", () => {
    const counting = { receiptDraftOpen: true, receiptOpenable: true };
    expect(
      allowedReturnActions({ status: "RECEIVED", lines: [line(2, 2)], ...counting }, as(SALES)),
    ).toEqual([]);
    expect(
      allowedReturnActions({ status: "RECEIVED", lines: [line(2, 0)], ...counting }, as(SALES)),
    ).toEqual([]);
    expect(
      allowedReturnActions({ status: "SETTLEMENT_PENDING", ...counting }, as(ACCOUNTANT)),
    ).toEqual(["rejectSettlement"]);
    expect(allowedReturnActions({ status: "RECEIVED", ...counting }, as(WAREHOUSE))).not.toContain(
      "createReceipt",
    );
  });

  it("Q-11 / audit r2 M4: custody notes are taken in any status, by sales-rma-custody:CREATE (warehouse and Sales)", () => {
    for (const status of ["REQUESTED", "RESOLVED", "REJECTED", "UNKNOWN"] as const) {
      expect(canAddCustody({ status }, as([...SALES, RMA_CUSTODY_PERMISSIONS.create]))).toBe(true);
      expect(canAddCustody({ status }, as([...WAREHOUSE, RMA_CUSTODY_PERMISSIONS.create]))).toBe(
        true,
      );
      // sales-rmas:CREATE (mở yêu cầu — khách cũng có) không còn đủ
      expect(canAddCustody({ status }, as(SALES))).toBe(false);
      expect(canAddCustody({ status }, as(WAREHOUSE))).toBe(false);
    }
  });

  it("audit r2 M-3: “Rút thay khách” is hidden while a parcel is counted on a draft receipt", () => {
    const awaiting = { status: "AWAITING_RETURN" as const, receipt: null };
    expect(allowedReturnActions(awaiting, as(SALES))).toContain("cancel");
    expect(allowedReturnActions({ ...awaiting, receiptDraftOpen: true }, as(SALES))).not.toContain(
      "cancel",
    );
    expect(
      allowedReturnActions({ status: "REQUESTED", receiptDraftOpen: true }, as(SALES)),
    ).not.toContain("cancel");
  });

  it("audit r2 L15: approve needs a claim photo and someone other than the Sales person who opened it", () => {
    const photo = { id: "e1", stage: "CLAIM", uploadedAt: "2026-11-20T00:00:00Z" };
    const requested = {
      status: "REQUESTED" as const,
      channel: "BACK_OFFICE" as const,
      requestedBy: "u-sale",
      evidence: [photo],
    };
    expect(allowedReturnActions(requested, as(SALES), "u-other")).toContain("approve");
    expect(allowedReturnActions(requested, as(SALES), "u-sale")).not.toContain("approve");
    expect(
      allowedReturnActions({ ...requested, evidence: [] }, as(SALES), "u-other"),
    ).not.toContain("approve");
    // Khách mở trên cổng: không có bốn mắt theo người mở
    expect(
      allowedReturnActions({ ...requested, channel: "PORTAL" }, as(SALES), "u-sale"),
    ).toContain("approve");
  });

  it("audit r2 L15: the refund's proposer does not approve it", () => {
    const pending = {
      status: "SETTLEMENT_PENDING" as const,
      resolution: { proposedBy: "u-acc" },
    };
    const approver = as([...ACCOUNTANT]);
    expect(allowedReturnActions(pending, approver, "u-acc")).not.toContain("approveSettlement");
    expect(allowedReturnActions(pending, approver, "u-other")).toContain("approveSettlement");
  });

  it("audit r2 returns H1: Sales record the customer's custody choice only on a return that refunded nothing", () => {
    const resolved = {
      status: "RESOLVED" as const,
      outcome: "REFUSED" as const,
      lines: [{ ...line(2, 2), refundQuantity: 0 }],
    };
    expect(canRecordCustodyChoice(resolved, as(SALES))).toBe(true);
    expect(canRecordCustodyChoice({ ...resolved, outcome: "NOTHING_TO_REFUND" }, as(SALES))).toBe(
      true,
    );
    expect(canRecordCustodyChoice({ ...resolved, outcome: "REFUNDED" }, as(SALES))).toBe(false);
    expect(
      canRecordCustodyChoice(
        { ...resolved, lines: [{ ...line(2, 2), refundQuantity: 1 }] },
        as(SALES),
      ),
    ).toBe(false);
    expect(canRecordCustodyChoice({ ...resolved, status: "RECEIVED" }, as(SALES))).toBe(false);
    expect(canRecordCustodyChoice(resolved, as(WAREHOUSE))).toBe(false);
  });
});

describe("WF-05 Q-18: who confirms a return receipt with an opened carton or loose units", () => {
  const MANAGER = [...WAREHOUSE, RETURN_RECEIPT_APPROVAL_PERMISSIONS.approve];
  const sealed = { lpn: "L1", sku: "S", quantity: 10, countedQuantity: 10, scannedBy: "u-clerk" };
  const opened = { ...sealed, countedQuantity: 8 };
  const loose = { id: "ll", sku: "S", quantity: 2, recordedBy: "u-clerk" };

  it("an opened carton (counted below its label, or flagged) or a loose line needs the manager", () => {
    expect(needsManagerConfirmation({ cartons: [sealed], looseLines: [] })).toBe(false);
    expect(needsManagerConfirmation({ cartons: [opened], looseLines: [] })).toBe(true);
    expect(
      needsManagerConfirmation({ cartons: [{ ...sealed, opened: true }], looseLines: null }),
    ).toBe(true);
    expect(needsManagerConfirmation({ cartons: [], looseLines: [loose] })).toBe(true);
  });

  it("a clerk is blocked; a manager who did not count is not; the manager who counted is", () => {
    const receipt = { cartons: [opened], looseLines: [loose] };
    expect(returnReceiptConfirmBlock(receipt, as(WAREHOUSE), "u-clerk")).toBe("managerRequired");
    expect(returnReceiptConfirmBlock(receipt, as(MANAGER), "u-manager")).toBeNull();
    expect(returnReceiptConfirmBlock(receipt, as(MANAGER), "u-clerk")).toBe("selfConfirmation");
    expect(
      returnReceiptConfirmBlock(
        { cartons: [opened], looseLines: [{ ...loose, recordedBy: "u-manager" }] },
        as(MANAGER),
        "u-manager",
      ),
    ).toBe("selfConfirmation");
  });

  it("the BE flag decides when present; countedBy (a recount) is a counter too", () => {
    expect(
      needsManagerConfirmation({
        cartons: [opened],
        looseLines: [],
        managerConfirmationRequired: false,
      }),
    ).toBe(false);
    expect(
      needsManagerConfirmation({
        cartons: [sealed],
        looseLines: [],
        managerConfirmationRequired: true,
      }),
    ).toBe(true);
    expect(
      returnReceiptConfirmBlock(
        { cartons: [{ ...opened, countedBy: "u-manager" }], looseLines: [] },
        as(MANAGER),
        "u-manager",
      ),
    ).toBe("selfConfirmation");
  });

  it("sealed cartons only: anyone with the receipt permission confirms", () => {
    expect(
      returnReceiptConfirmBlock({ cartons: [sealed], looseLines: [] }, as(WAREHOUSE), "u-clerk"),
    ).toBeNull();
  });
});
