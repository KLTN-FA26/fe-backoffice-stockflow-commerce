/**
 * Lý do bước đổi trạng thái trong lịch sử đơn (BE `Order#transitionTo` — `CODE` / `CODE: ghi chú`): nhãn tiếng Việt + ghi
 * chú; mã lạ / ghi chú tự do giữ nguyên văn.
 */
import { describe, expect, it } from "vitest";

import { formatHistoryReason, historyReasonCodeLabel } from "./history-reason";

describe("formatHistoryReason", () => {
  it.each([
    ["CONTRACT_SENT", "Đã gửi hợp đồng cho khách"],
    ["CONTRACT_CANCELLED", "Hợp đồng bị huỷ — đơn quay về nháp"],
    ["CREDIT_APPROVED", "Kế toán duyệt vượt hạn mức công nợ"],
    ["CREDIT", "Vượt hạn mức công nợ"],
    ["RETURNED_TO_ORIGIN", "Hàng giao thất bại đã về lại kho"],
    ["RETURN_WINDOW_CLOSED", "Hết hạn đổi / trả — đơn tự hoàn tất"],
    ["CLOSED_AFTER_SETTLEMENT", "Tự đóng sau khi đã tất toán"],
    ["RETURN_REQUESTED", "Khách yêu cầu trả hàng"],
    ["RETURN_REQUESTED_ON_FULL_DELIVERY", "Đơn giao đủ, còn yêu cầu trả hàng đang mở"],
    ["RETURN_GOODS_ARRIVED", "Hàng trả đã về kho"],
    ["RETURN_GOODS_BACK", "Đã nhận lại hàng trả"],
    ["RETURN_ENDED", "Kết thúc yêu cầu trả hàng, không có hàng về"],
    ["REFUNDED", "Đã hoàn tiền hàng trả"],
    ["DELIVERY_FAILED_SETTLED", "Đã tất toán tiền sau giao thất bại"],
  ])("mã %s → %s", (code, label) => {
    expect(formatHistoryReason(code)).toBe(label);
  });

  it("CODE: ghi chú → nhãn — ghi chú (REFUND_VOIDED, lý do giữ, lý do giao thất bại)", () => {
    expect(formatHistoryReason("REFUND_VOIDED: Chuyển nhầm tài khoản")).toBe(
      "Huỷ phiếu hoàn tiền — Chuyển nhầm tài khoản",
    );
    expect(formatHistoryReason("ADDRESS: Sai phường — chờ khách")).toBe(
      "Sai địa chỉ / hãng vận chuyển không giao tới — Sai phường — chờ khách",
    );
    expect(formatHistoryReason("CUSTOMER_ABSENT: Gọi 3 lần")).toBe("Khách vắng mặt — Gọi 3 lần");
  });

  it("RETURN_REQUESTED <số RMA> (cách bằng dấu cách) → nhãn — số RMA", () => {
    expect(formatHistoryReason("RETURN_REQUESTED RMA-20261119-0001")).toBe(
      "Khách yêu cầu trả hàng — RMA-20261119-0001",
    );
  });

  it("HOLD_RESOLVED_<lý do giữ>: ghi chú → Gỡ giữ đơn (nhãn lý do) — ghi chú", () => {
    expect(formatHistoryReason("HOLD_RESOLVED_ADDRESS: Khách đã sửa địa chỉ")).toBe(
      "Gỡ giữ đơn (Sai địa chỉ / hãng vận chuyển không giao tới) — Khách đã sửa địa chỉ",
    );
    expect(formatHistoryReason("HOLD_RESOLVED_SOMETHING_NEW: ok")).toBe("Gỡ giữ đơn — ok");
    expect(historyReasonCodeLabel("HOLD_RESOLVED_DELIVERY_FAILED")).toContain("Gỡ giữ đơn (");
  });

  it("mã lạ / ghi chú tự do → nguyên văn (không bỏ trống, không đoán)", () => {
    expect(formatHistoryReason("BRAND_NEW_CODE: x")).toBe("BRAND_NEW_CODE: x");
    expect(formatHistoryReason("Khách gọi lại xin đổi ngày")).toBe("Khách gọi lại xin đổi ngày");
    expect(formatHistoryReason("RETURN_REQUESTED  hai dấu cách")).toBe(
      "RETURN_REQUESTED  hai dấu cách",
    );
  });
});
