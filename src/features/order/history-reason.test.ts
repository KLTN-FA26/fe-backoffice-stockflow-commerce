/**
 * Lý do bước đổi trạng thái trong lịch sử đơn (BE `Order#transitionTo` — `CODE` / `CODE: ghi chú`): nhãn tiếng Việt + ghi
 * chú; mã lạ / ghi chú tự do giữ nguyên văn.
 */
import { describe, expect, it } from "vitest";

import { formatClosureNote, formatHistoryReason, historyReasonCodeLabel } from "./history-reason";

describe("formatHistoryReason", () => {
  it.each([
    ["CONTRACT_SENT", "Đã gửi hợp đồng cho khách"],
    ["CONTRACT_CANCELLED", "Hợp đồng bị huỷ — đơn quay về nháp"],
    ["CREDIT_APPROVED", "Kế toán duyệt công nợ"],
    ["CREDIT", "Chờ duyệt công nợ (khách quá hạn hoặc vượt hạn mức)"],
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

  it("lô giao hoàn về kho: RETURNED / RETURNED_<lý do> → câu tiếng Việt, không lộ mã thô", () => {
    expect(formatHistoryReason("RETURNED")).toBe("Lô giao đã hoàn về kho");
    expect(formatHistoryReason("RETURNED_REFUSED")).toBe(
      "Lô giao đã hoàn về kho (Khách từ chối nhận)",
    );
    expect(formatHistoryReason("RETURNED_CUSTOMER_ABSENT")).not.toMatch(/RETURNED|CUSTOMER_ABSENT/);
    // mã cũ có sẵn trong bảng vẫn thắng tiền tố RETURNED_
    expect(formatHistoryReason("RETURNED_TO_ORIGIN")).toBe("Hàng giao thất bại đã về lại kho");
  });

  it("ghi chú đóng phần còn lại cũ 'Returned shipment <UUID>' → câu tiếng Việt, ghi chú khác giữ nguyên", () => {
    const legacy = "Returned shipment 3f2b8c1e-5a4d-4b7e-9c11-0d2e6a7f8b90";
    const text = formatClosureNote(legacy);
    expect(text).toBe("Lô giao bị hoàn về kho: phần hàng của lô không giao lại trên đơn này");
    expect(text).not.toMatch(/Returned|3f2b8c1e/);
    expect(formatClosureNote("Khách đổi ý")).toBe("Khách đổi ý");
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

  it("BE-4: a sent contract cancelled with a reason is written CONTRACT_CANCELLED: <reason> and shows the reason", () => {
    expect(formatHistoryReason("CONTRACT_CANCELLED: Khách đổi điều khoản thanh toán")).toBe(
      "Hợp đồng bị huỷ — đơn quay về nháp — Khách đổi điều khoản thanh toán",
    );
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

  it("M-7: every WF-05 code the BE writes on a status step has a Vietnamese label", () => {
    // BE `Order#goodsReceived`, `#closeLostShipment`, `#returnSettledWithoutRefund` (fix/wf05-full 18d4cf88)
    for (const code of ["RETURN_RECEIVED", "LOST_CLOSED", "RETURN_SETTLED_WITHOUT_REFUND"]) {
      expect(historyReasonCodeLabel(code)).toMatch(/[à-ỹ]/);
    }
    expect(formatHistoryReason("LOST_CLOSED")).toBe(
      "Đóng lô giao thất lạc — đã tính lại tiền của lô",
    );
  });

  it("mã lạ / ghi chú tự do → nguyên văn (không bỏ trống, không đoán)", () => {
    expect(formatHistoryReason("BRAND_NEW_CODE: x")).toBe("BRAND_NEW_CODE: x");
    expect(formatHistoryReason("Khách gọi lại xin đổi ngày")).toBe("Khách gọi lại xin đổi ngày");
    expect(formatHistoryReason("RETURN_REQUESTED  hai dấu cách")).toBe(
      "RETURN_REQUESTED  hai dấu cách",
    );
  });
});
