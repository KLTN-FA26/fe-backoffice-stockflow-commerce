import { describe, expect, it } from "vitest";

import { SHIPPING_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  handoverRefusalOf,
  isScanQueueFatal,
  isStaleLoadError,
  isTransientError,
  shipmentCodeOf,
  shippingErrorMessage,
  unloadErrorMessage,
  wrongVehicleOf,
} from "./errors";

const err = (code: string, status = 409, fieldErrors?: Record<string, string>) =>
  new ApiError(status, code, "en", fieldErrors);

describe("shippingErrorMessage — mọi mã lỗi BE có câu tiếng Việt", () => {
  it("mọi mã khai báo đều ra đúng câu của mã đó", () => {
    for (const [code, message] of Object.entries(SHIPPING_ERROR_MESSAGES)) {
      if (code === "generic" || code === "shipmentRefused") continue;
      expect(shippingErrorMessage(err(code))).toBe(message);
    }
  });

  it("phủ các mã BE mà màn quét / bàn giao / đặt xe / mã vận đơn xử lý", () => {
    const required = [
      "HANDOVER_NOT_SIGNED",
      "LOAD_NOT_FOUND",
      "PACKAGE_NOT_FOUND",
      "PACKAGE_NOT_IN_LOAD",
      "PACKAGE_ALREADY_LOADED",
      "PACKAGE_NOT_READY",
      "PACKAGE_UNLOAD_PENDING",
      "LOAD_NOT_FULLY_LOADED",
      "LOAD_EMPTY",
      "OPTIMISTIC_LOCK",
      "INVALID_LOAD_TRANSITION",
      "INVALID_LOAD_PLAN_TRANSITION",
      "LOAD_UNLOAD_PENDING",
      "LOAD_HANDOVER_BLOCKED",
      "LOAD_WAYBILL_MISSING",
      "WAYBILL_DUPLICATE",
      "WAYBILL_FROM_CARRIER_API",
      "WAYBILL_IMPORT_INVALID_FILE",
      "CARRIER_CODE_EXISTS",
      "CARRIER_BOOKS_THROUGH_API",
      "CARRIER_BOOKING_IN_PROGRESS",
      "CARRIER_BOOKING_FAILED",
      "CARRIER_CANCEL_REFUSED",
      "CARRIER_STOP_OUT_OF_AREA",
      "ORDER_BALANCE_NOT_PAID",
      "DELIVERY_BATCH_WINDOW_NOT_OPEN",
      "ORDER_INVALID_TRANSITION",
      "ORDER_CANCELLED",
    ];
    for (const code of required) {
      expect(SHIPPING_ERROR_MESSAGES).toHaveProperty(code);
      // Câu tiếng Việt thật, không rơi vào câu chung và không lộ message tiếng Anh của BE
      const message = shippingErrorMessage(err(code));
      expect(message).not.toBe(SHIPPING_ERROR_MESSAGES.generic);
      expect(message).not.toBe("en");
    }
  });

  it("mã của chuyến gửi kiện / lệnh chuyển kho đã bỏ → coi như mã lạ (câu chung)", () => {
    for (const code of ["LABEL_OUTDATED", "PACKAGE_OTHER_CARRIER", "TRANSFER_NOT_PACKED"]) {
      expect(SHIPPING_ERROR_MESSAGES).not.toHaveProperty(code);
      expect(shippingErrorMessage(err(code))).toBe(SHIPPING_ERROR_MESSAGES.generic);
    }
  });

  it("BE nêu tên lô → câu có tiền tố 'Lô <mã>'", () => {
    const message = shippingErrorMessage(
      err("ORDER_BALANCE_NOT_PAID", 409, { shipmentCode: "SO-1-S2" }),
    );
    expect(message).toBe(`Lô SO-1-S2: ${SHIPPING_ERROR_MESSAGES.ORDER_BALANCE_NOT_PAID}`);
  });

  it("mã chưa biết nhưng BE nêu tên lô (lô xung đột, vượt số lượng…) → vẫn 'Lô X' + lý do chung", () => {
    for (const code of ["ORDER_SHIPMENT_CONFLICT", "ORDER_SHIPMENT_QUANTITY_EXCEEDED"]) {
      expect(shippingErrorMessage(err(code, 409, { shipmentCode: "SO-9-S1" }))).toBe(
        `Lô SO-9-S1: ${SHIPPING_ERROR_MESSAGES.shipmentRefused}`,
      );
    }
  });

  it("hãng từ chối tạo đơn: nối lý do hãng nêu; không có lý do thì chỉ câu chung của mã", () => {
    expect(
      shippingErrorMessage(err("CARRIER_BOOKING_FAILED", 409, { carrier: "Địa chỉ không hợp lệ" })),
    ).toBe(
      `${SHIPPING_ERROR_MESSAGES.CARRIER_BOOKING_FAILED} Lý do hãng nêu: Địa chỉ không hợp lệ`,
    );
    expect(shippingErrorMessage(err("CARRIER_BOOKING_FAILED"))).toBe(
      SHIPPING_ERROR_MESSAGES.CARRIER_BOOKING_FAILED,
    );
    // fieldErrors.carrier của mã khác không được nối vào
    expect(shippingErrorMessage(err("CARRIER_CANCEL_REFUSED", 409, { carrier: "x" }))).toBe(
      SHIPPING_ERROR_MESSAGES.CARRIER_CANCEL_REFUSED,
    );
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
      "CARRIER_BOOKING_IN_PROGRESS",
      "WAYBILL_FROM_CARRIER_API",
    ]) {
      expect(isStaleLoadError(err(code))).toBe(true);
    }
    for (const code of [
      "PACKAGE_NOT_IN_LOAD",
      "HANDOVER_NOT_SIGNED",
      "LOAD_HANDOVER_BLOCKED",
      "LOAD_WAYBILL_MISSING",
      "WAYBILL_DUPLICATE",
    ]) {
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
  it("chưa thanh toán / đang giữ có tên lô → dữ liệu để đánh dấu lô, kèm câu có tiền tố 'Lô'", () => {
    const unpaid = handoverRefusalOf(
      err("ORDER_BALANCE_NOT_PAID", 409, { shipmentCode: "SO-1-S1" }),
    );
    expect(unpaid).toEqual({
      code: "ORDER_BALANCE_NOT_PAID",
      shipmentCode: "SO-1-S1",
      message: `Lô SO-1-S1: ${SHIPPING_ERROR_MESSAGES.ORDER_BALANCE_NOT_PAID}`,
    });
    expect(
      handoverRefusalOf(err("ORDER_INVALID_TRANSITION", 409, { shipmentCode: "S" })),
    ).toBeDefined();
  });

  it("không còn cờ in lại nhãn (COD đã bỏ)", () => {
    const refusal = handoverRefusalOf(err("ORDER_CANCELLED", 409, { shipmentCode: "SO-9-S1" }));
    expect(refusal).not.toHaveProperty("reprintLabel");
    expect(refusal?.message).toBe(`Lô SO-9-S1: ${SHIPPING_ERROR_MESSAGES.ORDER_CANCELLED}`);
  });

  it("mã chưa biết có tên lô → vẫn đánh dấu lô với lý do chung", () => {
    const refusal = handoverRefusalOf(err("ORDER_SHIPMENT_CONFLICT", 409, { shipmentCode: "S9" }));
    expect(refusal?.message).toBe(`Lô S9: ${SHIPPING_ERROR_MESSAGES.shipmentRefused}`);
  });

  it("không nêu tên lô hoặc lỗi khác → không đánh dấu lô nào", () => {
    expect(handoverRefusalOf(err("ORDER_BALANCE_NOT_PAID"))).toBeUndefined();
    expect(handoverRefusalOf(err("OPTIMISTIC_LOCK"))).toBeUndefined();
    expect(handoverRefusalOf(new Error("x"))).toBeUndefined();
    expect(shipmentCodeOf(new Error("x"))).toBeUndefined();
  });
});

describe("ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED (BE PR #150) — bàn giao", () => {
  it("câu tiếng Việt: nhờ Sale bật giao một phần trên đơn", () => {
    expect(shippingErrorMessage(err("ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED"))).toBe(
      SHIPPING_ERROR_MESSAGES.ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED,
    );
    expect(SHIPPING_ERROR_MESSAGES.ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED).toContain(
      "Cho phép giao một phần",
    );
  });

  it("bàn giao nêu tên lô → có tiền tố 'Lô <mã>' và đánh dấu đúng lô bị chặn", () => {
    const error = err("ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED", 409, { shipmentCode: "SO-1-S2" });
    expect(shippingErrorMessage(error)).toBe(
      `Lô SO-1-S2: ${SHIPPING_ERROR_MESSAGES.ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED}`,
    );
    expect(handoverRefusalOf(error)).toMatchObject({
      code: "ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED",
      shipmentCode: "SO-1-S2",
    });
  });
});

describe("chuyến là một xe của kế hoạch", () => {
  it("quét kiện của xe khác: câu nêu số xe và mã chuyến của xe đúng", () => {
    const error = err("PACKAGE_NOT_IN_LOAD", 409, { vehicleSeq: "2", loadCode: "LD-F002" });
    expect(wrongVehicleOf(error)).toEqual({ seq: "2", loadCode: "LD-F002" });
    expect(shippingErrorMessage(error)).toBe(
      "Kiện này thuộc xe số 2 (LD-F002) — không xếp lên xe này.",
    );
  });

  it("BE bỏ loadCode nhưng gửi vehicleSeq → vẫn nêu số xe (không kèm mã chuyến)", () => {
    const error = err("PACKAGE_NOT_IN_LOAD", 409, { vehicleSeq: "3" });
    expect(wrongVehicleOf(error)).toEqual({ seq: "3", loadCode: undefined });
    expect(shippingErrorMessage(error)).toBe("Kiện này thuộc xe số 3 — không xếp lên xe này.");
  });

  it("PACKAGE_NOT_IN_LOAD thiếu vehicleSeq → câu chung (kể cả khi chỉ có loadCode); mã khác không bao giờ thành 'sai xe'", () => {
    expect(wrongVehicleOf(err("PACKAGE_NOT_IN_LOAD"))).toBeUndefined();
    expect(wrongVehicleOf(err("PACKAGE_NOT_IN_LOAD", 409, { loadCode: "LD-1" }))).toBeUndefined();
    expect(shippingErrorMessage(err("PACKAGE_NOT_IN_LOAD"))).toBe(
      SHIPPING_ERROR_MESSAGES.PACKAGE_NOT_IN_LOAD,
    );
    expect(
      wrongVehicleOf(err("PACKAGE_ALREADY_LOADED", 409, { vehicleSeq: "2", loadCode: "X" })),
    ).toBeUndefined();
    expect(wrongVehicleOf(new Error("x"))).toBeUndefined();
  });

  it("dỡ kiện: PACKAGE_NOT_IN_LOAD nghĩa là kiện không nằm trong danh sách cần dỡ; mã khác dùng câu chung", () => {
    expect(unloadErrorMessage(err("PACKAGE_NOT_IN_LOAD"))).toBe(
      UI_LABELS.shipping.ftl.unload.notPending,
    );
    expect(unloadErrorMessage(err("PACKAGE_NOT_FOUND", 404))).toBe(
      SHIPPING_ERROR_MESSAGES.PACKAGE_NOT_FOUND,
    );
  });

  it("bàn giao: LOAD_UNLOAD_PENDING / INVALID_LOAD_PLAN_TRANSITION là dữ liệu cũ → tải lại; không nêu lô nên không đánh dấu lô", () => {
    expect(isStaleLoadError(err("LOAD_UNLOAD_PENDING"))).toBe(true);
    expect(isStaleLoadError(err("INVALID_LOAD_PLAN_TRANSITION"))).toBe(true);
    expect(handoverRefusalOf(err("LOAD_UNLOAD_PENDING"))).toBeUndefined();
  });
});
