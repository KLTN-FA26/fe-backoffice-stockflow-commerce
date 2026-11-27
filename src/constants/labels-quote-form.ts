/** Chữ của form báo giá và hộp thoại gửi / tạo đơn (docs 14 §4.1). */

export const QUOTE_FORM_LABELS = {
  /** Hậu tố nhãn của ô không bắt buộc (S01-14): ô bắt buộc có dấu * đỏ, ô tuỳ chọn ghi rõ. */
  optional: "(không bắt buộc)",
  shippingFeeHint: "Để trống nếu không thu phí vận chuyển.",
  sku: {
    label: "Sản phẩm (SKU riêng)",
    placeholder: "Chọn sản phẩm…",
    search: "Gõ tên sản phẩm hoặc mã SKU…",
    none: "Không có sản phẩm khớp.",
  },
  addLine: {
    label: "Thêm dòng",
    /** Dòng dưới nút khi không thêm được (R7). */
    noSkuLeft: "Còn thiếu: SKU riêng khác của khách để báo giá (mỗi SKU một dòng).",
  },
  validity: {
    daysLeft: (days: number) => `Còn ${days} ngày kể từ hôm nay.`,
  },
  minCartons: { label: "Số thùng tối thiểu", none: "chưa có", unit: "thùng" },
  tiers: {
    from: "Từ số thùng",
    unitPrice: "Đơn giá một cái",
    firstIsMinimum: "Bậc đầu là số thùng tối thiểu của báo giá",
  },
  /** Giá tham chiếu dưới ô đơn giá của từng bậc (14 BR-10) — xem trước, BE kiểm lại khi gửi. */
  reference: {
    label: (price: string, source: string) => `Tham chiếu ${price} (${source.toLowerCase()})`,
    below: (percent: string) => `thấp hơn ${percent}%`,
    above: (percent: string) => `cao hơn ${percent}%`,
    equal: "bằng giá",
    needsApproval: "cần duyệt",
    noReference: "Chưa có giá tham chiếu — cần duyệt",
  },
  /** Khung tóm tắt bên phải form báo giá. */
  summary: {
    region: "Tóm tắt báo giá",
    customer: "Khách hàng",
    taxCode: (code: string) => `MST ${code}`,
    customerCode: (code: string) => `Mã KH ${code}`,
    credit: {
      limit: "Hạn mức công nợ",
      exposure: "Dư nợ trả sau giao",
      available: "Còn dùng được",
      noCredit: "Không bán trả sau",
      overdue: (amount: string) =>
        `Có ${amount} quá hạn — hợp đồng ký lúc này sẽ chờ Kế toán duyệt.`,
    },
    checkTitle: "Kiểm tra giá",
    allOk: (ok: number, total: number) => `${ok}/${total} dòng đạt giá`,
    needsApproval: (count: number) => `${count} dòng cần Quản lý kinh doanh duyệt giá`,
    pending: "Một số dòng chưa đủ dữ liệu — hệ thống kiểm khi gửi",
    noLines: "Chưa có dòng nào để kiểm tra.",
    verdict: {
      ok: "Đạt",
      needsApproval: "Cần duyệt",
      unknown: "Kiểm khi gửi",
      noPrice: "Chưa có giá",
    },
    noSku: "Chưa chọn sản phẩm",
    threshold: (percent: string) =>
      `Bậc giá thấp hơn giá tham chiếu quá ${percent}%, hoặc chưa có giá tham chiếu, thì báo giá chờ Quản lý kinh doanh duyệt trước khi đến khách.`,
    note: "Giá cuối cùng do hệ thống tính khi lưu; số trên form chỉ để xem trước.",
    saveAndSend: "Lưu và gửi khách",
    saveAndSendForApproval: "Lưu và gửi duyệt giá",
    saveAndSendHint: "Lưu nháp rồi mở hộp xác nhận gửi với tổng tiền hệ thống đã tính.",
  },
  skuLoad: {
    failed: "Không tải được SKU riêng của khách.",
    next: "Bấm Thử lại; vẫn lỗi thì tải lại trang hoặc báo quản trị hệ thống.",
    retry: "Thử lại",
  },
  nextStep: {
    needPrices: "Bước tiếp theo: nhập đủ giá và phí, rồi Gửi khách.",
    readyToSend: "Báo giá đã đủ giá và phí — kiểm tra rồi bấm Gửi khách.",
  },
  send: { to: "Gửi cho", validUntil: "Hiệu lực đến hết ngày" },
  convert: { defaultAddress: "Địa chỉ mặc định của khách" },
} as const;
