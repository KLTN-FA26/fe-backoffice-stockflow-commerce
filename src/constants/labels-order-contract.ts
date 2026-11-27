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
    /** bo-20: số tiền một đợt tính theo % quy ra (theo tổng có thuế; phần lẻ BE dồn đợt cuối). */
    percentAmount: (amount: string) => `≈ ${amount}`,
  },
  /**
   * bo-19: xác nhận trước khi lập hợp đồng nháp — bấm là BE lập ngay (`POST /orders/{id}/contract` không body: một đợt giao
   * cho cả đơn, lịch thanh toán mặc định của khách, số lần in mẫu theo cấu hình).
   */
  create: {
    title: (orderNumber: string) => `Lập hợp đồng nháp cho đơn ${orderNumber}?`,
    description:
      "Hệ thống lập ngay một hợp đồng nháp theo mặc định. Hợp đồng chưa gửi cho khách: bạn xem lại, sửa rồi mới gửi.",
    total: "Tổng đơn (có thuế)",
    lines: "Số dòng hàng",
    batches: "Lịch giao",
    batchesValue: "1 đợt giao cho cả đơn (sửa được)",
    plan: "Lịch thanh toán",
    planValue: "Theo mặc định của khách (sửa được)",
    confirm: "Lập hợp đồng",
    cancel: "Huỷ",
    /** Ngay sau khi lập: mời xem lại trước khi gửi. */
    created: (contractNumber: string) =>
      `Đã lập hợp đồng nháp ${contractNumber}. Xem lại lịch giao và lịch thanh toán bên dưới, xem trước PDF, sửa nếu cần rồi mới gửi cho khách.`,
  },
  history: { show: "Xem lịch sử hợp đồng", hide: "Ẩn lịch sử hợp đồng" },
  /**
   * bo-20: công nợ của khách cạnh lịch thanh toán (BE `GET /orders/credit-position/{customerId}`) — phần trả sau giao của
   * hợp đồng này cộng dư nợ so với hạn mức, như BE kiểm khi gửi (15 BR-10, BR-11).
   */
  credit: {
    title: "Công nợ của khách",
    limit: "Hạn mức",
    noCredit: "Không bán trả sau",
    exposure: "Dư nợ hiện tại",
    deferred: "Hợp đồng này trả sau giao",
    remaining: "Còn lại sau hợp đồng",
    over: (amount: string) =>
      `Vượt hạn mức ${amount}: bấm gửi thì hợp đồng phải chờ Kế toán duyệt tín dụng rồi mới tới khách.`,
    overdue: (amount: string) =>
      `Khách đang có khoản quá hạn ${amount}: hợp đồng có đợt trả sau giao phải chờ Kế toán duyệt rồi mới tới khách.`,
    loading: "Đang tải công nợ của khách…",
    error: "Không tải được công nợ của khách.",
    retry: "Thử lại",
  },
} as const;
