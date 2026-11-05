import { describe, expect, it } from "vitest";

import {
  QC_OUTCOME_API,
  QC_OUTCOME_BY_API,
  QC_OUTCOME_STATUSES,
  RECEIPT_API_STATUS_BY_STATUS,
  RECEIPT_API_STATUSES,
  RECEIPT_STATUS_BY_API,
  RECEIPT_STATUSES,
} from "@/constants";
import { RECEIPT_TRANSITIONS } from "@/lib/domain/lifecycle";
import { STATUS_LABEL_VI, toneOf } from "@/lib/domain/status-map";

describe("RECEIPT_TRANSITIONS (docs 03 §5.1)", () => {
  it("phủ đủ 6 trạng thái của docs + Pending Approval (BR-RCP-001)", () => {
    expect(Object.keys(RECEIPT_TRANSITIONS).sort()).toEqual([...RECEIPT_STATUSES].sort());
  });

  it("Draft → Pending Approval (đếm vượt dung sai) / Confirmed / Cancelled", () => {
    expect(RECEIPT_TRANSITIONS.Draft).toEqual(["Pending Approval", "Confirmed", "Cancelled"]);
  });

  it("BR-RCP-001: Pending Approval → ghi nhận như Confirmed (In QC / In Putaway) hoặc Cancelled", () => {
    expect(RECEIPT_TRANSITIONS["Pending Approval"]).toEqual(["In QC", "In Putaway", "Cancelled"]);
  });

  it("Confirmed → In QC khi có dòng cần QC, → In Putaway khi không", () => {
    expect(RECEIPT_TRANSITIONS.Confirmed).toEqual(["In QC", "In Putaway"]);
  });

  it("In QC → In Putaway, hoặc thẳng Closed khi không còn phần Accepted", () => {
    expect(RECEIPT_TRANSITIONS["In QC"]).toEqual(["In Putaway", "Closed"]);
  });

  it("BR-05: đã Confirmed thì không quay về Cancelled", () => {
    // Pending Approval chưa ghi nhận tồn nên huỷ được như Draft
    const afterConfirm = RECEIPT_STATUSES.filter((s) => s !== "Draft" && s !== "Pending Approval");
    for (const status of afterConfirm) {
      expect(RECEIPT_TRANSITIONS[status]).not.toContain("Cancelled");
    }
  });

  it.each(["Closed", "Cancelled"] as const)("%s là terminal — không transition nào", (status) => {
    expect(RECEIPT_TRANSITIONS[status]).toEqual([]);
  });
});

describe("Map trạng thái phiếu nhận BE ↔ FE (BE GoodsReceiptStatus, PR #62)", () => {
  it("map đủ 7 mã BE, không trùng nhãn FE", () => {
    const mapped = RECEIPT_API_STATUSES.map((api) => RECEIPT_STATUS_BY_API[api]);
    expect([...mapped].sort()).toEqual([...RECEIPT_STATUSES].sort());
  });

  it.each(RECEIPT_API_STATUSES)("%s đi hai chiều không mất", (api) => {
    expect(RECEIPT_API_STATUS_BY_STATUS[RECEIPT_STATUS_BY_API[api]]).toBe(api);
  });

  it("kết luận QC map đủ 3 giá trị docs 03 §5.2", () => {
    expect(QC_OUTCOME_API.map((api) => QC_OUTCOME_BY_API[api])).toEqual([...QC_OUTCOME_STATUSES]);
  });
});

describe("status-map cho phiếu nhận", () => {
  it.each(RECEIPT_STATUSES)("%s có nhãn tiếng Việt", (status) => {
    expect(STATUS_LABEL_VI[status]).toBeTruthy();
  });

  it("Pending Approval là warning như PO chờ duyệt", () => {
    expect(toneOf("Pending Approval")).toBe("warning");
    expect(STATUS_LABEL_VI["Pending Approval"]).toBe("Chờ duyệt");
  });

  it("In QC là warning (đang chặn putaway), Not Required là muted", () => {
    expect(toneOf("In QC")).toBe("warning");
    expect(toneOf("Not Required")).toBe("muted");
  });
});
