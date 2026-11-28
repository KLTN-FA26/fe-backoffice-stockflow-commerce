/**
 * Khối điều kiện hoàn tất / đóng đơn (WF-05 BO-02; contract F-1 `OrderResponse.settlementReadiness`, BE-34).
 *
 * BE tính và trả lý do đơn chưa tự hoàn tất / chưa tự đóng (`OrderSettlementService`, job 00:30). BO chỉ hiển thị — không
 * tự tính lại hạn đổi trả, nợ, hoá đơn (invariant G5). Enum lấy nguyên văn từ contract F-1.
 */

/** `settlementReadiness.branch`: đang chờ hoàn tất, chờ đóng nhánh hoàn tiền, hay không chờ gì. */
export const SETTLEMENT_BRANCHES = ["COMPLETION", "REFUND_CLOSE", "NONE"] as const;

/** `settlementReadiness.blockers` — điều kiện còn chặn. */
export const SETTLEMENT_BLOCKERS = [
  "NOT_DELIVERED",
  "RETURN_WINDOW_OPEN",
  "OWING",
  "OPEN_RETURN",
  "SHIPMENT_UNINVOICED",
  "SHIPPING_FEE_UNINVOICED",
  "REFUND_OUTSTANDING",
  "COMPLETION_HELD",
] as const;

export const SETTLEMENT_READINESS_LABELS = {
  section: "Điều kiện hoàn tất / đóng đơn",
  heading: {
    COMPLETION: "Điều kiện tự hoàn tất (00:30 mỗi đêm)",
    REFUND_CLOSE: "Điều kiện tự đóng đơn sau hoàn tiền (00:30 mỗi đêm)",
  },
  /**
   * Nhánh REFUND_CLOSE của đơn RETURNED / PARTIALLY_FULFILLED mà hãng chở hàng về hoặc làm thất lạc (WF-05 BE-45, settlement
   * 9e98660b): đơn đóng không qua hoàn tiền khi không còn gì phải hoàn — không gọi là "sau hoàn tiền".
   */
  headingCarrierEnded: "Điều kiện tự đóng đơn — hàng không giao được (00:30 mỗi đêm)",
  /** Fallback khi BE chưa trả khối điều kiện (BE cũ): tính tạm ở FE, ghi rõ là ước tính. */
  estimateNote: "Ước tính trên màn hình — máy chủ chưa trả khối điều kiện của đơn.",
  blockers: {
    NOT_DELIVERED: "Còn lô giao chưa xong (đang giao, giao thất bại hoặc chưa giao)",
    RETURN_WINDOW_OPEN: "Chưa hết hạn đổi / trả",
    OWING: "Còn đợt thanh toán chưa trả đủ",
    OPEN_RETURN: "Còn yêu cầu trả hàng đang mở",
    SHIPMENT_UNINVOICED: "Còn lô giao chưa có hoá đơn điện tử phát hành",
    // BE-62 / Q-19 (settlement 9e98660b): phần phí còn lại gồm cả phí vận chuyển lẫn phí khuôn chưa hoá đơn nào mang
    SHIPPING_FEE_UNINVOICED: "Phần phí còn lại (vận chuyển, phí khuôn) chưa có hoá đơn phát hành",
    REFUND_OUTSTANDING: "Còn tiền phải hoàn cho khách",
    COMPLETION_HELD: "Sale đang giữ hoàn tất",
  },
  /** Mã chặn máy chủ thêm sau — không đoán nghĩa. */
  unknownBlocker: (code: string) => `Điều kiện khác chưa đạt (${code})`,
  detail: {
    windowEndsAt: (when: string, days: number | null) =>
      days === null
        ? `Hết hạn lúc 0 giờ ngày ${when}`
        : `Hết hạn lúc 0 giờ ngày ${when} (${days} ngày theo hợp đồng)`,
    uninvoiced: (count: number) => `${count} lô giao chưa có hoá đơn phát hành`,
    held: "Gỡ giữ ở thẻ “Giữ hoàn tất”",
  },
  none: "Đủ điều kiện.",
  completesAt: (when: string) => `Đơn tự hoàn tất trong lần chạy đêm ngày ${when}.`,
  closesAt: (when: string) => `Đơn tự đóng trong lần chạy đêm ngày ${when}.`,
  /** Q-16: điều chỉnh trả hàng chưa phát hành KHÔNG chặn đóng, chỉ là dòng thông tin. */
  returnAdjustmentUnissued:
    "Còn hoá đơn điều chỉnh trả hàng chưa phát hành — không chặn đóng đơn; Kế toán vẫn phát hành được sau khi đóng.",
  /**
   * Audit r3 EINV-7 (QĐ HĐ-3, Q-16): bản giảm do giao không thành công (hoá đơn của lô giảm về 0, phí vận chuyển được miễn
   * giảm trên hoá đơn phần phí còn lại) chưa phát hành — thông tin, không chặn đóng.
   */
  deliveryReductionUnissued:
    "Còn bản giảm (giao không thành công) chưa phát hành — không chặn đóng đơn; Kế toán phát hành ở màn hoá đơn.",
  /** Blocker SHIPPING_FEE_UNINVOICED: lập hoá đơn phần phí còn lại (BE `POST /einvoices {orderId}`, không lô giao). */
  drawUpFeeRest: "Lập hoá đơn phần phí còn lại",
  /** Blocker SHIPMENT_UNINVOICED: lô giao đã giao mà chưa có hoá đơn phát hành — mở hộp chọn lô (nháp tự động có thể đã bị từ chối). */
  drawUpShipment: "Lập hoá đơn nháp",
  /** Hàng "Hoàn tiền" khi không có tiền phải hoàn nhưng có phí được miễn / còn thiếu (Q-19). */
  nothingToRefund: "Không có tiền phải hoàn",
  /** Audit r2 M-6: đơn "Hoàn tiền một phần" mà chưa hoàn đồng nào (dữ liệu trước bản sửa BE-45). */
  noRefundDespiteStatus:
    "Đơn chưa hoàn đồng nào cho khách: không có tiền phải hoàn, dù trạng thái ghi “Hoàn tiền một phần”.",
  met: "Đạt",
  unmet: "Chưa đạt",
} as const;
