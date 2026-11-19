import { describe, expect, it } from "vitest";

import {
  RECEIPT_API_STATUS_BY_STATUS,
  RECEIPT_API_STATUSES,
  RECEIPT_STATUS_BY_API,
  RECEIPT_STATUSES,
} from "@/constants";
import { RECEIPT_TRANSITIONS } from "@/lib/domain/lifecycle";
import { STATUS_LABEL_VI, toneOf } from "@/lib/domain/status-map";

describe("RECEIPT_TRANSITIONS (docs 03 §5, rescope 04/11)", () => {
  it("phủ đủ trạng thái BE GoodsReceiptStatus", () => {
    expect(Object.keys(RECEIPT_TRANSITIONS).sort()).toEqual([...RECEIPT_STATUSES].sort());
  });

  it("Draft → Confirmed (xác nhận) / Cancelled (huỷ)", () => {
    expect(RECEIPT_TRANSITIONS.Draft).toEqual(["Confirmed", "Cancelled"]);
  });

  it("Confirmed → In Putaway (không QC ở kho — BR-07)", () => {
    expect(RECEIPT_TRANSITIONS.Confirmed).toEqual(["In Putaway"]);
  });

  it("In Putaway → Closed khi cất xong mọi thùng (docs 03 §4.1 bước 8)", () => {
    expect(RECEIPT_TRANSITIONS["In Putaway"]).toEqual(["Closed"]);
  });

  it("Pending Approval là mã cũ chỉ đọc — không còn bước duyệt vượt dung sai (BR-02)", () => {
    expect(RECEIPT_TRANSITIONS["Pending Approval"]).toEqual([]);
  });

  it("BR-05: chỉ Draft được huỷ", () => {
    for (const status of RECEIPT_STATUSES.filter((s) => s !== "Draft")) {
      expect(RECEIPT_TRANSITIONS[status]).not.toContain("Cancelled");
    }
  });

  it("không còn trạng thái In QC (QC ở kho đã bỏ)", () => {
    expect(RECEIPT_STATUSES).not.toContain("In QC");
    expect(Object.values(RECEIPT_TRANSITIONS).flat()).not.toContain("In QC");
  });

  it.each(["Closed", "Cancelled"] as const)("%s là terminal — không transition nào", (status) => {
    expect(RECEIPT_TRANSITIONS[status]).toEqual([]);
  });
});

describe("Map trạng thái phiếu nhận BE ↔ FE (BE GoodsReceiptStatus)", () => {
  it("map đủ 6 mã BE, không trùng nhãn FE", () => {
    const mapped = RECEIPT_API_STATUSES.map((api) => RECEIPT_STATUS_BY_API[api]);
    expect([...mapped].sort()).toEqual([...RECEIPT_STATUSES].sort());
    expect(RECEIPT_API_STATUSES).not.toContain("IN_QC");
  });

  it.each(RECEIPT_API_STATUSES)("%s đi hai chiều không mất", (api) => {
    expect(RECEIPT_API_STATUS_BY_STATUS[RECEIPT_STATUS_BY_API[api]]).toBe(api);
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
});
