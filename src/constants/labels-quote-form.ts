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
  nextStep: {
    needPrices: "Bước tiếp theo: nhập đủ giá và phí, rồi Gửi khách.",
    readyToSend: "Báo giá đã đủ giá và phí — kiểm tra rồi bấm Gửi khách.",
  },
  send: { to: "Gửi cho", validUntil: "Hiệu lực đến hết ngày" },
  convert: { defaultAddress: "Địa chỉ mặc định của khách" },
} as const;
