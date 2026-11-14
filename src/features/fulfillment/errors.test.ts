import { describe, expect, it } from "vitest";

import { FULFILLMENT_ERROR_MESSAGES as MSG } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { fulfillmentErrorMessage, isOutOfDataScope, isStaleFulfillmentError } from "./errors";

const notFound = new ApiError(404, "NOT_FOUND", "Resource not found");
const conflict = new ApiError(409, "CONFLICT", "Conflicting state");
const invalid = new ApiError(
  400,
  "VALIDATION_FAILED",
  "Assignee must be an active warehouse staff",
);

describe("fulfillmentErrorMessage — cùng mã BE, nghĩa khác theo thao tác", () => {
  it("NOT_FOUND: tạo task = không có đơn; lấy hàng = không phải người được gán; artifact = thiếu file", () => {
    expect(fulfillmentErrorMessage(notFound, "create")).toBe(MSG.orderNotFound);
    expect(fulfillmentErrorMessage(notFound, "pick")).toBe(MSG.notAssignee);
    expect(fulfillmentErrorMessage(notFound, "pack")).toBe(MSG.notAssignee);
    expect(fulfillmentErrorMessage(notFound, "artifact")).toBe(MSG.artifactMissing);
  });

  it("FULFILLMENT_HOLDS_OUTSIDE_WAREHOUSE (hàng giữ ở kho khác kho xuất) → câu riêng ở mọi thao tác", () => {
    const outside = new ApiError(409, "FULFILLMENT_HOLDS_OUTSIDE_WAREHOUSE", "English");
    expect(fulfillmentErrorMessage(outside, "create")).toBe(
      MSG.FULFILLMENT_HOLDS_OUTSIDE_WAREHOUSE,
    );
    expect(fulfillmentErrorMessage(outside, "pick")).toBe(MSG.FULFILLMENT_HOLDS_OUTSIDE_WAREHOUSE);
    expect(MSG.FULFILLMENT_HOLDS_OUTSIDE_WAREHOUSE).not.toBe(MSG.generic);
  });

  it("CONFLICT: mỗi thao tác một câu riêng", () => {
    expect(fulfillmentErrorMessage(conflict, "create")).toBe(MSG.createConflict);
    expect(fulfillmentErrorMessage(conflict, "assign")).toBe(MSG.assignConflict);
    expect(fulfillmentErrorMessage(conflict, "pick")).toBe(MSG.stale);
    expect(fulfillmentErrorMessage(conflict, "dispatch")).toBe(MSG.dispatchConflict);
    expect(fulfillmentErrorMessage(conflict, "artifact")).toBe(MSG.artifactMismatch);
  });

  it("PICK_TASK_STATE_CONFLICT (mã thật của BE khi task / đơn sai trạng thái) dùng câu của CONFLICT", () => {
    const stateConflict = new ApiError(409, "PICK_TASK_STATE_CONFLICT", "English");
    expect(fulfillmentErrorMessage(stateConflict, "create")).toBe(MSG.createConflict);
    expect(fulfillmentErrorMessage(stateConflict, "assign")).toBe(MSG.assignConflict);
    expect(fulfillmentErrorMessage(stateConflict, "pick")).toBe(MSG.stale);
    expect(fulfillmentErrorMessage(stateConflict, "dispatch")).toBe(MSG.dispatchConflict);
    expect(fulfillmentErrorMessage(stateConflict, "artifact")).toBe(MSG.artifactOrderClosed);
    expect(isStaleFulfillmentError(stateConflict)).toBe(true);
  });

  it("VALIDATION_FAILED khi gán / tạo = người được gán không hợp lệ; chỗ khác = câu chung", () => {
    expect(fulfillmentErrorMessage(invalid, "assign")).toBe(MSG.assigneeInvalid);
    expect(fulfillmentErrorMessage(invalid, "create")).toBe(MSG.assigneeInvalid);
    expect(fulfillmentErrorMessage(invalid, "pick")).toBe(MSG.VALIDATION_FAILED);
  });

  it("mã chung của hệ thống dùng câu chung; không hiện message tiếng Anh của BE", () => {
    expect(fulfillmentErrorMessage(new ApiError(403, "FORBIDDEN", "Access denied"), "pick")).toBe(
      MSG.FORBIDDEN,
    );
    expect(fulfillmentErrorMessage(new ApiError(409, "OPTIMISTIC_LOCK", "x"), "pack")).toBe(
      MSG.OPTIMISTIC_LOCK,
    );
    expect(fulfillmentErrorMessage(new ApiError(503, "STORAGE_ERROR", "S3 down"), "pack")).toBe(
      MSG.STORAGE_ERROR,
    );
    expect(fulfillmentErrorMessage(new ApiError(500, "SOMETHING_NEW", "boom"), "pick")).toBe(
      MSG.generic,
    );
  });

  it("lỗi không phải ApiError → câu chung", () => {
    expect(fulfillmentErrorMessage(new Error("x"), "pick")).toBe(MSG.generic);
    expect(fulfillmentErrorMessage(null, "pick")).toBe(MSG.generic);
  });
});

describe("tải artifact — BE tách hai mã 409", () => {
  it("CONFLICT (DesignServiceImpl) = lệch checksum, bất kể task đang giữ hay không", () => {
    expect(fulfillmentErrorMessage(conflict, "artifact")).toBe(MSG.artifactMismatch);
  });

  it("PICK_TASK_STATE_CONFLICT (TaskAccess) = đơn đã rời khâu xuất kho, không phải lệch checksum", () => {
    const stateConflict = new ApiError(409, "PICK_TASK_STATE_CONFLICT", "English");
    expect(fulfillmentErrorMessage(stateConflict, "artifact")).toBe(MSG.artifactOrderClosed);
    expect(MSG.artifactOrderClosed).not.toBe(MSG.artifactMismatch);
  });

  it("chuyển sang khu xuất hàng: đơn đang treo (409 PICK_ORDER_ON_HOLD) có câu riêng nói thùng vẫn ở khu chờ xuất", () => {
    const onHold = new ApiError(409, "PICK_ORDER_ON_HOLD", "English");
    expect(fulfillmentErrorMessage(onHold, "dispatch")).toBe(MSG.PICK_ORDER_ON_HOLD);
    expect(MSG.PICK_ORDER_ON_HOLD).toMatch(/tạm giữ/);
    expect(MSG.PICK_ORDER_ON_HOLD).toMatch(/khu chờ xuất/);
    expect(MSG.PICK_ORDER_ON_HOLD).not.toBe(MSG.dispatchConflict);
  });

  it("tạo task đích STAGING: 422 STAGING_AREA_INVALID → nói chọn khu chờ xuất đang hoạt động", () => {
    const area = new ApiError(422, "STAGING_AREA_INVALID", "English");
    expect(fulfillmentErrorMessage(area, "create")).toBe(MSG.STAGING_AREA_INVALID);
  });
});

describe("isStaleFulfillmentError", () => {
  it("404 / 409 / optimistic lock → cần tải lại dữ liệu", () => {
    expect(isStaleFulfillmentError(notFound)).toBe(true);
    expect(isStaleFulfillmentError(conflict)).toBe(true);
    expect(isStaleFulfillmentError(new ApiError(409, "OPTIMISTIC_LOCK", "x"))).toBe(true);
    // Dòng đã lấy / báo thiếu / huỷ ở máy khác (BE PickList)
    expect(isStaleFulfillmentError(new ApiError(409, "PICK_LINE_NOT_OPEN", "x"))).toBe(true);
    // Hoàn tất khi BE còn dòng chưa lấy (dòng mới lập / phân bổ lại ở máy khác) → tải lại
    expect(isStaleFulfillmentError(new ApiError(409, "PICK_LINES_INCOMPLETE", "x"))).toBe(true);
    expect(fulfillmentErrorMessage(new ApiError(409, "PICK_LINES_INCOMPLETE", "x"), "pick")).toBe(
      MSG.PICK_LINES_INCOMPLETE,
    );
  });

  it("lỗi validate / mạng / lỗi lạ → không", () => {
    expect(isStaleFulfillmentError(invalid)).toBe(false);
    expect(isStaleFulfillmentError(new ApiError(0, "NETWORK_ERROR", "x"))).toBe(false);
    expect(isStaleFulfillmentError(new Error("x"))).toBe(false);
  });
});

describe("isOutOfDataScope — BE WarehouseScope: kho ngoài phạm vi người gọi", () => {
  it("chỉ 403 OUT_OF_DATA_SCOPE", () => {
    expect(isOutOfDataScope(new ApiError(403, "OUT_OF_DATA_SCOPE", "x"))).toBe(true);
    expect(isOutOfDataScope(new ApiError(403, "FORBIDDEN", "x"))).toBe(false);
    expect(isOutOfDataScope(new Error("x"))).toBe(false);
  });
});
