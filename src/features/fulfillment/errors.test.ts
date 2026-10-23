import { describe, expect, it } from "vitest";

import { FULFILLMENT_ERROR_MESSAGES as MSG } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { fulfillmentErrorMessage, isStaleFulfillmentError } from "./errors";

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

  it("CONFLICT: mỗi thao tác một câu riêng", () => {
    expect(fulfillmentErrorMessage(conflict, "create")).toBe(MSG.createConflict);
    expect(fulfillmentErrorMessage(conflict, "assign")).toBe(MSG.assignConflict);
    expect(fulfillmentErrorMessage(conflict, "pick")).toBe(MSG.stale);
    expect(fulfillmentErrorMessage(conflict, "reverify")).toBe(MSG.reverifyConflict);
    expect(fulfillmentErrorMessage(conflict, "artifact", { onDesignHold: true })).toBe(
      MSG.artifactMismatch,
    );
  });

  it("PICK_TASK_STATE_CONFLICT (mã thật của BE khi task / đơn sai trạng thái) dùng câu của CONFLICT", () => {
    const stateConflict = new ApiError(409, "PICK_TASK_STATE_CONFLICT", "English");
    expect(fulfillmentErrorMessage(stateConflict, "create")).toBe(MSG.createConflict);
    expect(fulfillmentErrorMessage(stateConflict, "assign")).toBe(MSG.assignConflict);
    expect(fulfillmentErrorMessage(stateConflict, "pick")).toBe(MSG.stale);
    expect(fulfillmentErrorMessage(stateConflict, "reverify")).toBe(MSG.reverifyConflict);
    expect(fulfillmentErrorMessage(stateConflict, "artifact", { onDesignHold: true })).toBe(
      MSG.artifactMismatch,
    );
    expect(fulfillmentErrorMessage(stateConflict, "artifact")).toBe(MSG.artifactUnavailable);
    expect(isStaleFulfillmentError(stateConflict)).toBe(true);
  });

  it("VALIDATION_FAILED khi gán / tạo = người được gán không hợp lệ; chỗ khác = câu chung", () => {
    expect(fulfillmentErrorMessage(invalid, "assign")).toBe(MSG.assigneeInvalid);
    expect(fulfillmentErrorMessage(invalid, "create")).toBe(MSG.assigneeInvalid);
    expect(fulfillmentErrorMessage(invalid, "reverify")).toBe(MSG.VALIDATION_FAILED);
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

describe("tải artifact — 409 của BE có hai nghĩa", () => {
  it("task đang bị giữ → chắc chắn là lệch checksum", () => {
    expect(fulfillmentErrorMessage(conflict, "artifact", { onDesignHold: true })).toBe(
      MSG.artifactMismatch,
    );
  });

  it("task chưa bị giữ → không khẳng định lệch checksum (có thể đơn đã rời khâu xuất kho)", () => {
    expect(fulfillmentErrorMessage(conflict, "artifact")).toBe(MSG.artifactUnavailable);
    expect(fulfillmentErrorMessage(conflict, "artifact", { onDesignHold: false })).toBe(
      MSG.artifactUnavailable,
    );
    expect(MSG.artifactUnavailable).not.toBe(MSG.artifactMismatch);
  });

  it("kiểm tra lại 409: câu báo nêu cả hai khả năng", () => {
    expect(MSG.reverifyConflict).toMatch(/không còn bị giữ/);
    expect(MSG.reverifyConflict).toMatch(/không còn ở khâu xuất kho/);
  });
});

describe("isStaleFulfillmentError", () => {
  it("404 / 409 / optimistic lock → cần tải lại dữ liệu", () => {
    expect(isStaleFulfillmentError(notFound)).toBe(true);
    expect(isStaleFulfillmentError(conflict)).toBe(true);
    expect(isStaleFulfillmentError(new ApiError(409, "OPTIMISTIC_LOCK", "x"))).toBe(true);
  });

  it("lỗi validate / mạng / lỗi lạ → không", () => {
    expect(isStaleFulfillmentError(invalid)).toBe(false);
    expect(isStaleFulfillmentError(new ApiError(0, "NETWORK_ERROR", "x"))).toBe(false);
    expect(isStaleFulfillmentError(new Error("x"))).toBe(false);
  });
});
