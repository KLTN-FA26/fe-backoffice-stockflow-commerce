import { describe, expect, it } from "vitest";

import { SHIPPING_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  handoverRefusalOf,
  reprintLabelHref,
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
      "ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED",
    ];
    for (const code of required) expect(SHIPPING_ERROR_MESSAGES).toHaveProperty(code);
  });

  it("BE nêu tên lô → câu có tiền tố 'Lô <mã>'", () => {
    const message = shippingErrorMessage(err("LABEL_OUTDATED", 409, { shipmentCode: "SO-1-S2" }));
    expect(message).toBe(`Lô SO-1-S2: ${SHIPPING_ERROR_MESSAGES.LABEL_OUTDATED}`);
  });

  it("mã chưa biết nhưng BE nêu tên lô (đơn huỷ, lô xung đột, vượt số lượng…) → vẫn 'Lô X' + lý do chung", () => {
    for (const code of [
      "ORDER_CANCELLED",
      "ORDER_SHIPMENT_CONFLICT",
      "ORDER_SHIPMENT_QUANTITY_EXCEEDED",
    ]) {
      expect(shippingErrorMessage(err(code, 409, { shipmentCode: "SO-9-S1" }))).toBe(
        `Lô SO-9-S1: ${SHIPPING_ERROR_MESSAGES.shipmentRefused}`,
      );
    }
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

  it("mã chưa biết có tên lô → vẫn đánh dấu lô với lý do chung, không mở lối in nhãn", () => {
    const refusal = handoverRefusalOf(err("ORDER_CANCELLED", 409, { shipmentCode: "SO-9-S1" }));
    expect(refusal).toMatchObject({
      code: "ORDER_CANCELLED",
      shipmentCode: "SO-9-S1",
      reprintLabel: false,
    });
    expect(refusal?.message).toBe(`Lô SO-9-S1: ${SHIPPING_ERROR_MESSAGES.shipmentRefused}`);
  });

  it("không nêu tên lô hoặc lỗi khác → không đánh dấu lô nào", () => {
    expect(handoverRefusalOf(err("LABEL_OUTDATED"))).toBeUndefined();
    expect(handoverRefusalOf(err("OPTIMISTIC_LOCK"))).toBeUndefined();
    expect(shipmentCodeOf(new Error("x"))).toBeUndefined();
  });
});

describe("reprintLabelHref", () => {
  it("có taskId → thẳng trạm đóng gói của task; chưa có → danh sách task", () => {
    expect(reprintLabelHref("task-1")).toBe("/admin/packing/task-1");
    expect(reprintLabelHref(undefined)).toBe("/admin/picking");
    expect(reprintLabelHref(null)).toBe("/admin/picking");
  });
});

describe("ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED (BE PR #150) — mở chuyến, thêm lô, bàn giao", () => {
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
      reprintLabel: false,
    });
  });
});

describe("chuyến nguyên xe (BE PR #162)", () => {
  it("phủ các mã mới của đặt xe / bắt đầu xếp / dỡ kiện / bàn giao theo xe", () => {
    for (const code of [
      "LOAD_UNLOAD_PENDING",
      "LOAD_MANAGED_BY_PLAN",
      "INVALID_LOAD_PLAN_TRANSITION",
      "ORDER_NOT_CANCELLABLE",
      "CARRIER_NOT_FOUND",
      "CARRIER_INACTIVE",
      "SHIPMENT_OTHER_CARRIER",
      "PACKAGE_REQUIRES_LOAD_PLAN",
      "ORDER_BALANCE_NOT_PAID",
      "ORDER_INVALID_TRANSITION",
      "ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED",
    ]) {
      expect(SHIPPING_ERROR_MESSAGES).toHaveProperty(code);
      // Câu tiếng Việt thật, không rơi vào câu chung
      expect(shippingErrorMessage(err(code))).not.toBe(SHIPPING_ERROR_MESSAGES.generic);
    }
  });

  it("quét kiện của xe khác: câu nêu số xe và mã chuyến của xe đúng", () => {
    const error = err("PACKAGE_NOT_IN_LOAD", 409, { vehicleSeq: "2", loadCode: "LD-F002" });
    expect(wrongVehicleOf(error)).toEqual({ seq: "2", loadCode: "LD-F002" });
    expect(shippingErrorMessage(error)).toBe(
      "Kiện này thuộc xe số 2 (LD-F002) — không xếp lên xe này.",
    );
  });

  it("PACKAGE_NOT_IN_LOAD thiếu vehicleSeq / loadCode → câu chung; mã khác không bao giờ thành 'sai xe'", () => {
    expect(wrongVehicleOf(err("PACKAGE_NOT_IN_LOAD"))).toBeUndefined();
    expect(wrongVehicleOf(err("PACKAGE_NOT_IN_LOAD", 409, { vehicleSeq: "2" }))).toBeUndefined();
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
    expect(isStaleLoadError(err("LOAD_MANAGED_BY_PLAN"))).toBe(false);
  });

  it("ORDER_NOT_CANCELLABLE khi bàn giao có tên lô → 'Lô X: …'", () => {
    expect(
      shippingErrorMessage(err("ORDER_NOT_CANCELLABLE", 409, { shipmentCode: "SO-1-S1" })),
    ).toBe(`Lô SO-1-S1: ${SHIPPING_ERROR_MESSAGES.ORDER_NOT_CANCELLABLE}`);
  });
});
