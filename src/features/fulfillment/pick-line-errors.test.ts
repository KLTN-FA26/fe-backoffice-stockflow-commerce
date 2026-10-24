import { describe, expect, it } from "vitest";

import {
  FULFILLMENT_ERROR_MESSAGES as MSG,
  PICK_LINE_ERROR_MESSAGES as PL,
  PUT_BACK_ERROR_MESSAGES as PB,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { isStaleFulfillmentError } from "./errors";
import {
  confirmLineError,
  putBackError,
  reallocateError,
  shortPickError,
} from "./pick-line-errors";

const LINE = { locationCode: "HN-A01-01-01-A", sku: "TEE-BLK-M", allocatedQty: 3 };
const be = (status: number, code: string) => new ApiError(status, code, "x");

describe("confirmLineError — BE PickList.confirm (vị trí → mã hàng → số lượng, dừng ở lỗi đầu)", () => {
  it.each([
    ["PICK_LOCATION_MISMATCH", "locationCode", PL.locationMismatch(LINE.locationCode)],
    ["PICK_ITEM_MISMATCH", "scannedCode", PL.itemMismatch(LINE.sku)],
    ["PICK_QUANTITY_EXCEEDS_ALLOCATION", "quantity", PL.quantityExceeds(3)],
    ["PICK_QUANTITY_SHORT", "quantity", PL.quantityShort(3)],
  ] as const)("%s → lỗi dưới ô %s", (code, field, message) => {
    expect(confirmLineError(be(409, code), LINE)).toEqual({ field, message, stale: false });
  });

  it.each([
    ["PICK_LINE_NOT_OPEN", 409, PL.lineNotOpen],
    ["PICK_TASK_STATE_CONFLICT", 409, PL.taskState],
    ["NOT_FOUND", 404, PL.notAssignee],
  ] as const)("%s → banner + tải lại", (code, status, message) => {
    expect(confirmLineError(be(status, code), LINE)).toEqual({ message, stale: true });
  });

  it("mất mạng / lần gửi trước đang xử lý → banner, không tải lại", () => {
    expect(confirmLineError(be(0, "NETWORK_ERROR"), LINE)).toEqual({
      message: PL.network,
      stale: false,
    });
    expect(confirmLineError(be(409, "IDEMPOTENT_REQUEST_IN_PROGRESS"), LINE).message).toBe(
      PL.inProgress,
    );
  });

  it("lỗi không phải ApiError → câu chung", () => {
    expect(confirmLineError(new Error("x"), LINE)).toEqual({ message: MSG.generic, stale: false });
  });
});

describe("shortPickError — BE PickList.reportShort", () => {
  it("sai vị trí → ô Vị trí; số tìm thấy ngoài 0..phân bổ−1 (400) → ô Số tìm thấy", () => {
    expect(shortPickError(be(409, "PICK_LOCATION_MISMATCH"), LINE)).toEqual({
      field: "locationCode",
      message: PL.locationMismatch(LINE.locationCode),
      stale: false,
    });
    expect(shortPickError(be(400, "VALIDATION_FAILED"), LINE)).toEqual({
      field: "foundQuantity",
      message: PL.shortFoundRange(2),
      stale: false,
    });
  });

  it("dòng không còn mở / task đổi trạng thái / không còn được gán → tải lại", () => {
    expect(shortPickError(be(409, "PICK_LINE_NOT_OPEN"), LINE)).toEqual({
      message: PL.lineNotOpen,
      stale: true,
    });
    expect(shortPickError(be(409, "PICK_TASK_STATE_CONFLICT"), LINE).stale).toBe(true);
    expect(shortPickError(be(404, "NOT_FOUND"), LINE).stale).toBe(true);
  });
});

describe("reallocateError — BE reallocateShort", () => {
  it("INSUFFICIENT_STOCK → câu riêng; dòng không còn SHORT → đã đổi ở nơi khác", () => {
    expect(reallocateError(be(409, "INSUFFICIENT_STOCK"))).toBe(PL.insufficientStock);
    expect(reallocateError(be(409, "PICK_LINE_NOT_OPEN"))).toBe(PL.lineNotOpen);
    expect(reallocateError(be(0, "NETWORK_ERROR"))).toBe(PL.network);
  });

  it("404: BE reallocateShort không xét người được gán → 'task / dòng không còn', không phải 'không được gán cho bạn'", () => {
    expect(reallocateError(be(404, "NOT_FOUND"))).toBe(PL.lineMissing);
    expect(PL.lineMissing).not.toBe(PL.notAssignee);
  });
});

describe("putBackError — BE PickList.putBack (SCRUM-275)", () => {
  it("PUT_BACK_LOCATION_INVALID → lỗi dưới ô Vị trí trả", () => {
    expect(putBackError(be(409, "PUT_BACK_LOCATION_INVALID"))).toEqual({
      field: "locationCode",
      message: PB.locationInvalid,
      stale: false,
    });
  });

  it("dòng đã trả / không cần trả / không còn → tải lại", () => {
    expect(putBackError(be(409, "PUT_BACK_NOT_REQUIRED"))).toEqual({
      message: PB.notRequired,
      stale: true,
    });
    expect(putBackError(be(404, "NOT_FOUND"))).toEqual({ message: PB.notFound, stale: true });
    expect(isStaleFulfillmentError(be(409, "PUT_BACK_NOT_REQUIRED"))).toBe(true);
  });

  it("kho ngoài phạm vi / mất mạng → banner, không tải lại", () => {
    expect(putBackError(be(403, "OUT_OF_DATA_SCOPE"))).toEqual({
      message: PB.outOfScope,
      stale: false,
    });
    expect(putBackError(be(0, "NETWORK_ERROR"))).toEqual({ message: PB.network, stale: false });
  });
});
