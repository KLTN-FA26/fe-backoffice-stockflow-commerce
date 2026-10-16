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
  it("phủ đủ 6 trạng thái của docs", () => {
    expect(Object.keys(RECEIPT_TRANSITIONS).sort()).toEqual([...RECEIPT_STATUSES].sort());
  });

  it("Draft → Confirmed / Cancelled", () => {
    expect(RECEIPT_TRANSITIONS.Draft).toEqual(["Confirmed", "Cancelled"]);
  });

  it("Confirmed → In QC khi có dòng cần QC, → In Putaway khi không", () => {
    expect(RECEIPT_TRANSITIONS.Confirmed).toEqual(["In QC", "In Putaway"]);
  });

  it("In QC → In Putaway, hoặc thẳng Closed khi không còn phần Accepted", () => {
    expect(RECEIPT_TRANSITIONS["In QC"]).toEqual(["In Putaway", "Closed"]);
  });

  it("BR-05: đã Confirmed thì không quay về Cancelled", () => {
    const afterConfirm = RECEIPT_STATUSES.filter((s) => s !== "Draft");
    for (const status of afterConfirm) {
      expect(RECEIPT_TRANSITIONS[status]).not.toContain("Cancelled");
    }
  });

  it.each(["Closed", "Cancelled"] as const)("%s là terminal — không transition nào", (status) => {
    expect(RECEIPT_TRANSITIONS[status]).toEqual([]);
  });
});

describe("Map trạng thái phiếu nhận BE ↔ FE (BE GoodsReceiptStatus, PR #62)", () => {
  it("map đủ 6 mã BE, không trùng nhãn FE", () => {
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

  it("In QC là warning (đang chặn putaway), Not Required là muted", () => {
    expect(toneOf("In QC")).toBe("warning");
    expect(toneOf("Not Required")).toBe("muted");
  });
});
