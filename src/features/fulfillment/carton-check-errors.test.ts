import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  CARTON_CHECK_ERROR_MESSAGES as MSG,
  CARTON_CHECK_FIELD_MESSAGES,
  CARTON_CHECK_INVALID_RESPONSE_MESSAGE,
  CARTON_NOT_CHECKED_MESSAGES,
  CARTON_SPEC_UNMEASURED_MESSAGES,
  FULFILLMENT_ERROR_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { cartonCheckErrorMessage, isStaleCartonCheckError } from "./carton-check-errors";

const apiError = (status: number, code: string, fieldErrors?: Record<string, string>) =>
  new ApiError(status, code, "English message", fieldErrors);

describe("cartonCheckErrorMessage — mã lỗi BE 4C-6 → câu tiếng Việt", () => {
  it.each(Object.keys(MSG) as (keyof typeof MSG)[])(
    "%s có câu riêng, không hiện message tiếng Anh của BE",
    (code) => {
      const message = cartonCheckErrorMessage(apiError(409, code));
      expect(message).toBe(MSG[code]);
      expect(message).not.toContain("English");
    },
  );

  it("CARTON_NOT_IN_TASK: LPN lạ / của đơn khác → từ chối, báo quản lý kho kiểm lại phần lấy hàng (docs 08 §4.2)", () => {
    const message = cartonCheckErrorMessage(apiError(409, "CARTON_NOT_IN_TASK"));
    expect(message).toMatch(/không thuộc/);
    expect(message).toMatch(/quản lý kho/);
  });

  it("PACKING_TAKEN: nêu tên người đang kiểm khi biết; không biết thì câu chung", () => {
    expect(
      cartonCheckErrorMessage(apiError(409, "PACKING_TAKEN"), { starterName: "Hoàng Anh Tuấn" }),
    ).toBe(UI_LABELS.cartonCheck.notice.takenTitle("Hoàng Anh Tuấn"));
    expect(cartonCheckErrorMessage(apiError(409, "PACKING_TAKEN"))).toBe(MSG.PACKING_TAKEN);
  });

  it("PACKING_NOT_READY: chưa lấy xong / thùng còn ở khu chờ xuất (BR-01)", () => {
    expect(cartonCheckErrorMessage(apiError(409, "PACKING_NOT_READY"))).toMatch(/khu chờ xuất/);
  });

  it("PACKING_INCOMPLETE / PACK_PARTIAL_NOT_ALLOWED / PACK_NOTHING_TO_SHIP: ba câu khác nhau", () => {
    const messages = ["PACKING_INCOMPLETE", "PACK_PARTIAL_NOT_ALLOWED", "PACK_NOTHING_TO_SHIP"].map(
      (code) => cartonCheckErrorMessage(apiError(409, code)),
    );
    expect(new Set(messages).size).toBe(3);
    expect(MSG.PACK_PARTIAL_NOT_ALLOWED).toMatch(/Sale/);
  });

  it("CARTON_NOT_CHECKED đổi nghĩa theo thao tác: dán nhãn / in / in lại", () => {
    const error = apiError(409, "CARTON_NOT_CHECKED");
    expect(cartonCheckErrorMessage(error, { context: "label" })).toBe(
      CARTON_NOT_CHECKED_MESSAGES.label,
    );
    expect(cartonCheckErrorMessage(error, { context: "print" })).toBe(
      CARTON_NOT_CHECKED_MESSAGES.print,
    );
    expect(cartonCheckErrorMessage(error, { context: "reprint" })).toBe(
      CARTON_NOT_CHECKED_MESSAGES.reprint,
    );
    expect(cartonCheckErrorMessage(error)).toBe(CARTON_NOT_CHECKED_MESSAGES.generic);
  });

  it("CARTON_SPEC_UNMEASURED nêu các SKU BE trả trong fieldErrors (BR-07)", () => {
    const error = new ApiError(
      422,
      "CARTON_SPEC_UNMEASURED",
      "English",
      { sku: "MUG-WHT-11" },
      undefined,
      undefined,
      [
        { field: "sku", message: "MUG-WHT-11", code: "CartonSpecUnmeasured" },
        { field: "sku", message: "TEE-BLK-M", code: "CartonSpecUnmeasured" },
      ],
    );
    expect(cartonCheckErrorMessage(error)).toBe(
      CARTON_SPEC_UNMEASURED_MESSAGES.withSkus("MUG-WHT-11, TEE-BLK-M"),
    );
    expect(cartonCheckErrorMessage(apiError(422, "CARTON_SPEC_UNMEASURED"))).toBe(
      CARTON_SPEC_UNMEASURED_MESSAGES.generic,
    );
  });

  it("VALIDATION_FAILED: câu theo field BE nêu đầu tiên mà FE biết; không biết thì câu chung", () => {
    expect(cartonCheckErrorMessage(apiError(400, "VALIDATION_FAILED", { note: "required" }))).toBe(
      CARTON_CHECK_FIELD_MESSAGES.noteRequired,
    );
    expect(cartonCheckErrorMessage(apiError(400, "VALIDATION_FAILED", { other: "x" }))).toBe(
      FULFILLMENT_ERROR_MESSAGES.VALIDATION_FAILED,
    );
  });

  it("mã chung của hệ thống, phản hồi sai hợp đồng và lỗi lạ", () => {
    expect(cartonCheckErrorMessage(apiError(403, "FORBIDDEN"))).toBe(
      FULFILLMENT_ERROR_MESSAGES.FORBIDDEN,
    );
    expect(cartonCheckErrorMessage(apiError(0, "NETWORK_ERROR"))).toBe(
      FULFILLMENT_ERROR_MESSAGES.NETWORK_ERROR,
    );
    expect(cartonCheckErrorMessage(apiError(409, "PICK_TASK_STATE_CONFLICT"))).toBe(
      FULFILLMENT_ERROR_MESSAGES.stale,
    );
    expect(cartonCheckErrorMessage(new ZodError([]))).toBe(CARTON_CHECK_INVALID_RESPONSE_MESSAGE);
    expect(cartonCheckErrorMessage(new Error("x"))).toBe(FULFILLMENT_ERROR_MESSAGES.generic);
    expect(cartonCheckErrorMessage(apiError(500, "SOMETHING_NEW"))).toBe(
      FULFILLMENT_ERROR_MESSAGES.generic,
    );
  });
});

describe("isStaleCartonCheckError — phiên đã đổi ở nơi khác → tải lại", () => {
  it("mã trạng thái / xung đột của trạm và của task → cũ; lỗi nhập liệu → không", () => {
    for (const code of [
      "PACKING_NOT_READY",
      "PACKING_TAKEN",
      "PACK_STATE_CONFLICT",
      "CARTON_NOT_CHECKED",
      "PACKAGE_SHIPPED",
      "PACKING_INCOMPLETE",
      "PACK_NOTHING_TO_SHIP",
      "ORDER_CANCELLED",
      "PICK_TASK_STATE_CONFLICT",
    ]) {
      expect(isStaleCartonCheckError(apiError(409, code))).toBe(true);
    }
    expect(isStaleCartonCheckError(apiError(400, "VALIDATION_FAILED"))).toBe(false);
    expect(isStaleCartonCheckError(apiError(409, "CARTON_NOT_IN_TASK"))).toBe(false);
  });

  it("phản hồi sai hợp đồng (ZodError): BE có thể đã ghi → tải lại; lỗi lạ khác → không", () => {
    expect(isStaleCartonCheckError(new ZodError([]))).toBe(true);
    expect(isStaleCartonCheckError(new Error("x"))).toBe(false);
  });
});
