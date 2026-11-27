/**
 * Chữ của khối Hợp đồng ở chi tiết đơn (docs 14 §4.3 bước 11–14): lý do khoá "Gửi hợp đồng", câu BE từ chối khi gửi, nhãn
 * thẻ đợt thanh toán. Nhãn trạng thái hợp đồng ở `./orders`.
 */

/** Số đợt giao → "đợt 1, đợt 2". */
const batches = (seqs: readonly number[]) => seqs.map((seq) => `đợt ${seq}`).join(", ");

export const ORDER_CONTRACT_LABELS = {
  /** Một dòng dưới nút "Gửi hợp đồng" khi chưa gửi được (R7). */
  sendBlocked: {
    missing: (seqs: readonly number[]) => `Còn thiếu: cửa sổ giao ${batches(seqs)}.`,
    past: (seqs: readonly number[]) =>
      `Cần sửa: cửa sổ giao ${batches(seqs)} bắt đầu trước hôm nay.`,
  },
  /**
   * Gửi bị BE từ chối vì điều kiện FE không biết trước (hợp đồng / khách không có trường báo): nói vì sao và ai gỡ
   * (docs 15 BR-12, 18 BR-03; BE `SalesContractService.send`).
   */
  sendRefused: {
    CUSTOMER_NOT_ACTIVE:
      "Khách hàng chưa ở trạng thái Hoạt động nên chưa gửi được hợp đồng mới. Khách chờ kích hoạt thì gửi lại lời mời kích hoạt; khách bị chặn hoặc đã đóng thì nhờ Quản lý kinh doanh gỡ chặn hoặc mở lại. Xong thì gửi lại hợp đồng.",
    PAYMENT_SCHEDULE_NEEDS_CREDIT:
      "Hợp đồng có đợt trả sau giao hàng nhưng khách chưa có hạn mức công nợ do Kế toán duyệt. Nhờ Kế toán cấp hạn mức, hoặc bấm Sửa để đổi đợt đó sang Trước giao. Xong thì gửi lại hợp đồng.",
  },
  sendRefusedFields: "Huỷ hộp thoại, bấm Sửa để chỉnh rồi gửi lại.",
  /** Hai điều khoản số cuối hợp đồng (S06-8): bắt buộc (dấu *), đơn vị là hậu tố trong ô. */
  terms: {
    rounds: { label: "Số lần in mẫu miễn phí", unit: "lần" },
    returnWindow: { label: "Thời hạn khiếu nại", unit: "ngày" },
  },
  plan: {
    name: "Tên đợt",
    milestone: "Mốc",
    value: "Giá trị",
    days: "Hạn (ngày)",
    batch: "Gắn đợt giao",
    amountMode: { amount: "Số tiền (₫)", percent: "% tổng đơn" },
  },
} as const;
