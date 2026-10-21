import { describe, expect, it } from "vitest";

import { SHIPPING_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  handoverRefusalOf,
  isScanQueueFatal,
  isStaleLoadError,
  isTransientError,
  shipmentCodeOf,
  shippingErrorMessage,
} from "./errors";

const err = (code: string, status = 409, fieldErrors?: Record<string, string>) =>
  new ApiError(status, code, "en", fieldErrors);

describe("shippingErrorMessage — mọi mã lỗi BE có câu tiếng Việt", () => {
  it("mọi mã khai báo đều ra đúng câu của mã đó", () => {
    for (const [code, message] of Object.entries(SHIPPING_ERROR_MESSAGES)) {
      if (code === "generic") continue;
      expect(shippingErrorMessage(err(code))).toBe(message);
    }
  });

  it("phủ các mã BE của PR #137 mà màn xử lý", () => {
    const required = [
      "HANDOVER_NOT_SIGNED",
      "LOAD_NOT_FOUND",
      "PACKAGE_NOT_FOUND",
      "PACKAGE_NOT_IN_LOAD",
      "PACKAGE_ALREADY_LOADED",
      "PACKAGE_NOT_READY",
      "PACKAGE_OTHER_CARRIER",
      "LOAD_NOT_FULLY_LOADED",
      "LOAD_EMPTY",
      "LABEL_OUTDATED",
      "OPTIMISTIC_LOCK",
      "INVALID_LOAD_TRANSITION",
      "ORDER_BALANCE_NOT_PAID",
      "SHIPMENT_STATE_CONFLICT",
      "SHIPMENT_ON_ANOTHER_LOAD",
      "LOAD_SCAN_ID_CONFLICT",
      "CARRIER_INACTIVE",
    ];
    for (const code of required) expect(SHIPPING_ERROR_MESSAGES).toHaveProperty(code);
  });

  it("BE nêu tên lô → câu có tiền tố 'Lô <mã>'", () => {
    const message = shippingErrorMessage(err("LABEL_OUTDATED", 409, { shipmentCode: "SO-1-S2" }));
    expect(message).toBe(`Lô SO-1-S2: ${SHIPPING_ERROR_MESSAGES.LABEL_OUTDATED}`);
  });

  it("mã lạ hoặc lỗi không phải ApiError → câu chung, không lộ message tiếng Anh của BE", () => {
    expect(shippingErrorMessage(err("SOMETHING_NEW"))).toBe(SHIPPING_ERROR_MESSAGES.generic);
    expect(shippingErrorMessage(new Error("boom"))).toBe(SHIPPING_ERROR_MESSAGES.generic);
    expect(shippingErrorMessage(err("hasOwnProperty"))).toBe(SHIPPING_ERROR_MESSAGES.generic);
  });
});

describe("phân loại lỗi", () => {
  it("mã báo dữ liệu đã cũ → tải lại; mã khác thì không", () => {
    for (const code of [
      "INVALID_LOAD_TRANSITION",
      "OPTIMISTIC_LOCK",
      "LOAD_NOT_FULLY_LOADED",
      "SHIPMENT_ON_ANOTHER_LOAD",
      "PACKAGE_NOT_READY",
    ]) {
      expect(isStaleLoadError(err(code))).toBe(true);
    }
    for (const code of ["PACKAGE_NOT_IN_LOAD", "HANDOVER_NOT_SIGNED", "LABEL_OUTDATED"]) {
      expect(isStaleLoadError(err(code))).toBe(false);
    }
    expect(isStaleLoadError(new Error("x"))).toBe(false);
  });

  it("lỗi tạm thời (mất mạng, 5xx, sai hợp đồng) → giữ scanId; 4xx là câu trả lời dứt khoát", () => {
    expect(isTransientError(err("NETWORK_ERROR", 0))).toBe(true);
    expect(isTransientError(err("HTTP_503", 503))).toBe(true);
    expect(isTransientError(new Error("zod"))).toBe(true);
    expect(isTransientError(err("PACKAGE_NOT_IN_LOAD", 409))).toBe(false);
    expect(isTransientError(err("PACKAGE_NOT_FOUND", 404))).toBe(false);
  });

  it("lỗi làm mọi mã sau chắc chắn thất bại → dừng hàng đợi quét", () => {
    expect(isScanQueueFatal(err("INVALID_LOAD_TRANSITION"))).toBe(true);
    expect(isScanQueueFatal(err("X", 403))).toBe(true);
    expect(isScanQueueFatal(err("NETWORK_ERROR", 0))).toBe(true);
    expect(isScanQueueFatal(err("PACKAGE_NOT_IN_LOAD"))).toBe(false);
  });
});

describe("handoverRefusalOf — lô chặn bàn giao", () => {
  it("chưa thanh toán / đang giữ / nhãn lệch có tên lô → dữ liệu để đánh dấu lô; nhãn lệch mở lối in lại", () => {
    const label = handoverRefusalOf(err("LABEL_OUTDATED", 409, { shipmentCode: "SO-1-S1" }));
    expect(label).toMatchObject({
      code: "LABEL_OUTDATED",
      shipmentCode: "SO-1-S1",
      reprintLabel: true,
    });
    expect(label?.message).toContain("SO-1-S1");
    expect(
      handoverRefusalOf(err("ORDER_BALANCE_NOT_PAID", 409, { shipmentCode: "S" }))?.reprintLabel,
    ).toBe(false);
    expect(
      handoverRefusalOf(err("ORDER_INVALID_TRANSITION", 409, { shipmentCode: "S" })),
    ).toBeDefined();
  });

  it("không nêu tên lô hoặc lỗi khác → không đánh dấu lô nào", () => {
    expect(handoverRefusalOf(err("LABEL_OUTDATED"))).toBeUndefined();
    expect(handoverRefusalOf(err("OPTIMISTIC_LOCK", 409, { shipmentCode: "S" }))).toBeUndefined();
    expect(shipmentCodeOf(new Error("x"))).toBeUndefined();
  });
});
