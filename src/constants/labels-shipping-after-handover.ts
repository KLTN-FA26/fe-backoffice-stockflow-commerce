/**
 * Nhãn sau bàn giao (docs 09 §4.2 bước 9, §4.3, §4.5, BR-02, BR-14, BR-16): gỡ lô giao khỏi xe khi huỷ có kiểm soát,
 * sửa lý do giao thất bại, bước do hãng báo qua webhook, file vận đơn / POD của đơn cho Sale.
 */

export const SHIPPING_AFTER_HANDOVER_LABELS = {
  /** Huỷ có kiểm soát một xe: chọn lô giao gỡ khỏi xe (docs 09 §4.2 bước 9, BR-14; `REMOVED_FROM_VEHICLE`). */
  removal: {
    label: "Gỡ lô giao khỏi xe (loại khỏi kế hoạch)",
    hint: "Chọn lô cần dỡ hẳn (ví dụ đơn chưa thu đợt trước giao, thùng hư). Lô được chọn bị loại khỏi kế hoạch và chờ ở khu xuất hàng; chuyến mới của xe chỉ chở các lô còn lại với sơ đồ xếp tính lại. Không chọn lô nào thì chuyến mới giữ nguyên sơ đồ.",
    order: "Đơn",
    packages: "kiện",
    allRemoved: "Đã chọn mọi lô — xe không còn gì để chở nên không có chuyến mới.",
  },
  /** RTM-LOADCANCEL2 (docs 09 §4.5): hãng huỷ đơn khi xe đang xếp — chuyến về Chưa đặt xe, kiện đã quét phải dỡ. */
  unloadBeforeBooking:
    "Hãng đã huỷ đơn khi xe đang xếp — quét dỡ các kiện còn trên xe về khu xuất hàng rồi mới đặt xe lại.",
  carrierCancelledUnload: {
    title: "Kiện còn trên xe hãng đã huỷ đơn",
    description:
      "Hãng huỷ đơn khi xe đang xếp: chuyến về Chưa đặt xe với cùng sơ đồ. Quét dỡ từng kiện về khu xuất hàng; dỡ hết mới đặt xe lại.",
  },
  /** Docs 09 BR-16: chuyến đã đặt xe không đổi hãng trực tiếp. */
  carrierLocked: "Muốn đổi hãng: huỷ đặt xe (ghi lý do) rồi đặt lại với hãng mới.",
  /** In lại sơ đồ xếp của xe sau khi tính lại (docs 09 §4.2 bước 9: "xuất lại PDF sơ đồ xếp"). */
  reprintLayout: "In lại sơ đồ xếp của xe",
  /** Sửa lý do giao thất bại (docs 09 edge "hoàn hàng khi còn Handed Over"). */
  reasonCorrection: {
    button: "Sửa lý do thất bại",
    title: "Sửa lý do giao thất bại",
    description:
      "Khi đã biết lý do thật (ví dụ hãng báo hoàn hàng nên hệ thống ghi tạm “Khác”). Trạng thái lô không đổi. Không sửa được sau khi hàng hoàn đã nhập kho.",
    reasonLabel: "Lý do sửa",
    reasonHint: "Ghi rõ vì sao sửa, biết lý do thật từ đâu (bắt buộc).",
    confirm: "Lưu lý do",
    historyTitle: "Lý do thất bại đã sửa",
    from: "Trước",
    to: "Sau",
    by: "Người sửa",
    why: "Lý do sửa",
  },
  /**
   * QLK huỷ lô Sẵn sàng xuất (docs 09 §5.1; RTM-RTDCANCEL 19/11): thùng hư vào cách ly, thùng tốt vào hàng chờ cất lại;
   * đơn tạm giữ (thiếu hàng) để phân bổ thùng khác, kiểm lại thùng mới rồi gỡ treo về Đã đóng gói.
   */
  shipmentCancel: {
    button: "Huỷ lô giao",
    title: "Huỷ lô giao",
    description:
      "Lô chưa bàn giao. Thùng đánh dấu hư vào khu cách ly; thùng còn tốt vào hàng chờ cất lại. Đơn chuyển Tạm giữ (thiếu hàng) để phân bổ thùng khác, kiểm lại thùng mới rồi gỡ treo.",
    reasonLabel: "Lý do huỷ",
    damagedLabel: "Thùng hư hỏng (vào cách ly)",
    damagedHint: "Đánh dấu các thùng hư; thùng không đánh dấu được cất lại vào kho.",
    confirm: "Huỷ lô",
  },
  /** Bước do hãng báo qua webhook (docs 09 BR-02: ghi nguồn webhook / tay). */
  webhookSource: "Hãng báo (webhook)",
  /** Nguyên văn lý do thất bại của hãng, lưu kèm mã lý do nội bộ (docs 09 §4.1). */
  carrierOriginalReason: "Lý do gốc của hãng",
  /** File vận đơn và POD của đơn — Sale gửi khách khi khách xin qua chat (docs 09 §2, §7). */
  documents: {
    title: "File vận đơn & biên bản giao nhận",
    hint: "Gửi khách qua chat khi khách xin. Khách không tự xem được các file này.",
    empty: "Chưa có file vận đơn hay biên bản giao nhận nào.",
    shipment: "Lô",
    vehicle: "Chuyến",
    waybillNo: "Mã vận đơn",
    pod: "Biên bản giao nhận (POD)",
    waybillFile: "File vận đơn",
    noPod: "Chưa có POD",
    noWaybillFile: "Chưa có file vận đơn",
    download: "Tải",
    downloadFailed: "Không tải được file — thử lại.",
    loadFailed: "Không tải được danh sách file.",
  },
} as const;

export const SHIPPING_AFTER_HANDOVER_TOAST_MESSAGES = {
  failureReasonCorrected: "Đã sửa lý do giao thất bại",
  shipmentCancelled: "Đã huỷ lô giao — đơn tạm giữ chờ phân bổ thùng khác",
} as const;

/** errorCode BE → câu tiếng Việt cho các thao tác trên. */
export const SHIPPING_AFTER_HANDOVER_ERROR_MESSAGES = {
  LOAD_REMOVAL_SPLITS_SHIPMENT:
    "Lô giao này còn kiện trên xe khác của kế hoạch — không gỡ riêng khỏi xe này được.",
  LOAD_PLAN_RELAYOUT_INCOMPLETE:
    "Không xếp lại được mọi kiện còn lại lên xe — gỡ thêm lô hoặc huỷ không gỡ lô nào.",
  LOAD_CARRIER_CHANGE_NEEDS_CANCEL:
    "Chuyến đã đặt xe với hãng khác — huỷ đặt xe (ghi lý do) rồi mới đặt lại với hãng mới.",
  SHIPMENT_FAILURE_REASON_LOCKED:
    "Hàng hoàn đã nhập kho và đã mở hồ sơ giao thất bại — không sửa lý do được nữa.",
} as const;
