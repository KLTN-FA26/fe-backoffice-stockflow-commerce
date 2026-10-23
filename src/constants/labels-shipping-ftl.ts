/**
 * Nhãn của chuyến nguyên xe (FTL, FULL_TRUCKLOAD): mỗi xe của kế hoạch xếp xe là một chuyến — đặt xe với
 * hãng, bắt đầu xếp hàng, quét kiện của riêng xe đó, dỡ kiện của đơn đã huỷ, bàn giao theo xe
 * (BE PR #162, SCRUM-392; docs 09 §4.2 bước 5, BR-14, BR-15).
 */

export const SHIPPING_FTL_LABELS = {
  modeFilter: "Hình thức",
  modeAll: "Tất cả",
  modeColumn: "Hình thức",
  planColumn: "Kế hoạch / xe",
  planCode: "Kế hoạch",
  vehicleSeq: "Xe số",
  vehicleType: "Loại xe",
  planCard: "Xe của kế hoạch xếp xe",
  planCardHint:
    "Chuyến nguyên xe do kế hoạch xếp xe tạo ra: kiện của xe này do kế hoạch xếp, không thêm / bớt lô tay. Thay đổi phải đi qua kế hoạch.",
  /* ── Lệnh chuyển kho trên xe (kế hoạch nguồn TRANSFER, BE PR #164) ── */
  transfer: {
    badge: "Lệnh chuyển kho",
    /** Thay chữ "Lô giao" ở xe chở lệnh chuyển kho (không có lô giao, không COD). */
    sectionTitle: "Lệnh chuyển kho trên xe",
    cardAria: "Lệnh chuyển kho",
    badgeTitle:
      "Xe này chở một lệnh chuyển kho nguyên chuyến: người nhận là kho đích, không thu hộ. Hàng chỉ rời kho nguồn khi xe cuối cùng của kế hoạch được bàn giao.",
    manageByPlan: "Lệnh chuyển kho do kế hoạch xếp xe quản lý — thay đổi qua kế hoạch.",
  },
  /* ── Đặt xe ─────────────────────────────────────────────────────── */
  booking: {
    title: "Đặt xe với hãng",
    hintPlanned: "Đặt xe với hãng bên ngoài hệ thống, rồi nhập hãng, biển số và tài xế ở đây.",
    hintBooked: "Xe đã đặt. Khi xe tới kho, bấm bắt đầu xếp hàng.",
    hintLocked: "Đã bắt đầu xếp hàng — không đổi hoặc huỷ đặt xe được nữa.",
    bookedAt: "Đặt lúc",
    notBooked: "Chưa đặt xe",
    book: "Đặt xe",
    rebook: "Sửa thông tin đặt xe",
    cancel: "Huỷ đặt xe",
    start: "Bắt đầu xếp hàng",
    lastCancelled: "Lần đặt xe trước đã huỷ",
    lastCancelledAt: "lúc",
  },
  bookDialog: {
    title: "Đặt xe",
    rebookTitle: "Sửa thông tin đặt xe",
    description:
      "Ghi lại xe đã đặt với hãng vận chuyển. Biển số và tài xế có thể bổ sung sau, chậm nhất khi ký bàn giao.",
    carrier: "Hãng vận chuyển",
    vehiclePlate: "Biển số xe",
    driverName: "Tên tài xế",
    driverPhone: "SĐT tài xế",
    submit: "Lưu đặt xe",
  },
  cancelBookingDialog: {
    title: "Huỷ đặt xe",
    description:
      "Xe quay về trạng thái chưa đặt (hãng, biển số, tài xế được xoá, lý do được giữ lại). Nhớ báo huỷ xe với hãng ngoài hệ thống. Chỉ huỷ được trước khi bắt đầu xếp hàng.",
    reason: "Lý do huỷ đặt xe",
    confirm: "Huỷ đặt xe",
  },
  startDialog: {
    title: "Bắt đầu xếp hàng",
    description:
      "Xe đã tới kho. Từ lúc này kế hoạch xếp xe không mở lại hoặc huỷ được nữa (BR-14), và lô còn kiện bị bỏ lại sẽ tách thành lô mới.",
    confirm: "Bắt đầu xếp hàng",
  },
  /* ── Xe bị huỷ khi đã đặt ───────────────────────────────────────── */
  bookingToCancel: {
    title: "Nhớ huỷ xe đã đặt với nhà xe",
    body: "Chuyến này đã huỷ nhưng xe vẫn còn đặt ở ngoài hệ thống — hãy liên hệ hãng để huỷ.",
    autoCancelled: "Hệ thống tự huỷ chuyến này vì xe không còn gì để chở (các đơn trên xe đã huỷ).",
    reason: "Lý do huỷ:",
  },
  /* ── Dỡ kiện của đơn đã huỷ ─────────────────────────────────────── */
  unload: {
    title: "Kiện cần dỡ khỏi xe",
    description:
      "Đơn của các kiện này đã huỷ khi xe đang xếp. Quét từng kiện để dỡ xuống; còn kiện chưa dỡ thì chưa bàn giao được.",
    label: "Quét mã kiện để dỡ xuống",
    placeholder: "Quét hoặc nhập mã kiện cần dỡ rồi nhấn Enter",
    hint: "Hàng dỡ xuống quay về kho qua hàng đợi cất hàng của lấy hàng.",
    parcel: "Mã kiện",
    shipment: "Lô giao",
    reason: "Lý do",
    requestedAt: "Yêu cầu lúc",
    accepted: "Đã dỡ xuống",
    readOnly: "Bạn chỉ có quyền xem — dỡ kiện cần quyền xếp xe & bàn giao.",
    notPending: "Kiện này không nằm trong danh sách cần dỡ của xe này.",
  },
  /* ── Kiện ───────────────────────────────────────────────────────── */
  parcel: {
    kit: (partNo: number, partCount: number) => `Bộ ${partNo}/${partCount}`,
    kitTitle: "Kiện thuộc một bộ — phải lên xe đủ các kiện của bộ",
    labelOutdated: "Cần in lại nhãn",
    labelOutdatedTitle:
      "Kiện đã chuyển sang lô khác sau khi in nhãn — in lại nhãn ở trạm đóng gói trước khi quét lên xe.",
  },
  /* ── Biên bản theo xe ───────────────────────────────────────────── */
  manifest: {
    vehicle: "Xe của kế hoạch",
    vehicleValue: (planCode: string | null | undefined, seq: number | null | undefined) =>
      [planCode, seq != null ? `xe số ${seq}` : null].filter(Boolean).join(" · ") || "—",
    vehicleType: "Loại xe",
    perVehicleNote:
      "Biên bản của riêng xe này — chỉ gồm kiện kế hoạch xếp lên xe; thu hộ (COD) của chuyến nguyên xe luôn bằng 0.",
  },
  handover: {
    doneTitle: "Xe đã bàn giao",
    shipmentStatus: { HANDED_OVER: "Đã bàn giao", READY_TO_DISPATCH: "Chờ xe cuối" },
    description:
      "Hai bên đã ký biên bản giấy của riêng xe này. Lô chở trên nhiều xe chỉ chuyển Đã bàn giao ở xe cuối cùng chở lô đó; kế hoạch xếp xe chuyển Đã xuất khi mọi xe đã đi.",
    doneDescription:
      "Xe đã chuyển sang Đã bàn giao. Lô chỉ chuyển Đã bàn giao ở xe cuối cùng của lô; các lô trên xe này:",
  },
  disabledReason: {
    unloadPending: "Còn kiện của đơn đã huỷ trên xe — dỡ xuống trước khi bàn giao.",
  },
  noActions: {
    planned: "Chưa đặt xe — đặt xe với hãng rồi nhập thông tin ở thẻ Đặt xe.",
    booked: "Xe đã đặt — bấm Bắt đầu xếp hàng khi xe tới kho.",
  },
} as const;

export const SHIPPING_FTL_TOAST_MESSAGES = {
  booked: "Đã ghi nhận đặt xe",
  bookingCancelled: "Đã huỷ đặt xe",
  loadingStarted: "Đã bắt đầu xếp hàng",
  unloaded: "Đã dỡ kiện khỏi xe",
} as const;

/** Lỗi quét kiện sai xe (BE 409 PACKAGE_NOT_IN_LOAD kèm `vehicleSeq`, `loadCode`) — `{seq}` / `{code}` được thay. */
export const SHIPPING_WRONG_VEHICLE_NO_CODE_MESSAGE =
  "Kiện này thuộc xe số {seq} — không xếp lên xe này.";

export const SHIPPING_WRONG_VEHICLE_MESSAGE =
  "Kiện này thuộc xe số {seq} ({code}) — không xếp lên xe này.";
