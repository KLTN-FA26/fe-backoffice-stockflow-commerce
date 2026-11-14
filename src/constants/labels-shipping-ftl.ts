/**
 * Nhãn của chuyến xe (mỗi xe của kế hoạch xếp xe là một chuyến — docs 09 §4.2 bước 6–9, BR-14, BR-15): đặt xe với
 * hãng, bắt đầu xếp hàng, quét kiện của riêng xe đó, dỡ kiện, huỷ có kiểm soát, bàn giao theo xe.
 */

export const SHIPPING_FTL_LABELS = {
  planColumn: "Kế hoạch / xe",
  planCode: "Kế hoạch",
  vehicleSeq: "Xe số",
  vehicleType: "Loại xe",
  planCard: "Xe của kế hoạch xếp xe",
  planCardHint:
    "Chuyến do kế hoạch xếp xe tạo ra: kiện của xe này do kế hoạch xếp. Thay đổi danh sách kiện phải đi qua kế hoạch.",
  /* ── Đặt xe ─────────────────────────────────────────────────────── */
  booking: {
    title: "Đặt xe với hãng",
    hintPlanned:
      "Đặt xe với hãng (gửi hãng mã chuyến nội bộ), rồi ghi nhận hãng, biển số, tài xế ở đây.",
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
    waybill: "Mã vận đơn",
    waybillPending: "Chưa có",
    connection: "Kiểu kết nối hãng",
  },
  bookDialog: {
    title: "Đặt xe",
    rebookTitle: "Sửa thông tin đặt xe",
    description:
      "Ghi lại xe đã đặt với hãng (đặt ngoài hệ thống, gửi hãng mã chuyến nội bộ). Biển số, tài xế, mã vận đơn nhập nếu đã có; bổ sung sau qua webhook, file hoặc nhập tay — nhưng phải có mã vận đơn trước khi ký bàn giao.",
    carrier: "Hãng vận chuyển",
    vehiclePlate: "Biển số xe",
    driverName: "Tên tài xế",
    driverPhone: "SĐT tài xế",
    waybillNo: "Mã vận đơn (nếu hãng đã cấp)",
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
      "Xe đã tới kho. Từ lúc này kế hoạch xếp xe không mở lại hoặc huỷ được nữa (BR-14), và lô còn kiện bị bỏ lại sẽ tách thành lô mới. Đơn chưa được phép đi (chưa thu đợt thanh toán trước khi giao, chưa tới cửa sổ giao) sẽ được cảnh báo — vẫn xếp hàng được, nhưng ký bàn giao sẽ bị chặn.",
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
    /** Xe đã huỷ có kiểm soát: kiện bị khoá tới khi quét dỡ xuống (SCRUM-474 UNLOAD-DESIGN điểm 4-5). */
    controlledTitle: "Kiện còn trên xe đã huỷ — quét dỡ xuống",
    controlledDescription:
      "Xe này đã huỷ có kiểm soát. Kiện bị khoá — không xếp lên xe khác, không đưa vào kế hoạch mới — cho tới khi từng kiện được quét dỡ xuống. Quét mã trên nhãn từng kiện.",
    reasonCode: "Mã lý do",
    action: "Thao tác",
    overrideButton: "Xác nhận không quét",
    overrideTitle: "Xác nhận dỡ kiện không cần quét",
    overrideDescription:
      "Chỉ dùng khi nhãn kiện bị hỏng, không quét được. Kiện được coi là đã dỡ xuống; hệ thống ghi lại người xác nhận, thời điểm và ghi chú.",
    overrideNote: "Ghi chú (tình trạng nhãn)",
    overrideConfirm: "Xác nhận đã dỡ",
    overrideDone: "Đã xác nhận dỡ kiện không quét",
    overrideAria: (labelCode: string) => `Xác nhận dỡ kiện ${labelCode} không cần quét`,
    needsManager: "Nhãn hỏng không quét được? Quản lý kho xác nhận dỡ kiện không cần quét.",
  },
  /* ── Huỷ có kiểm soát sau khi đã xếp hàng (SCRUM-474 UNLOAD-DESIGN, docs 09 BR-14) ─────────── */
  controlledCancel: {
    /** Nhãn của bốn mã lý do (BE `UnloadReasonCode`). */
    reasonCode: {
      XE_HONG: "Xe hỏng",
      SAI_XE: "Sai xe",
      KIEN_KHONG_VUA: "Kiện không vừa",
      KHAC: "Khác",
    },
    reasonCodeLabel: "Lý do",
    reasonCodePlaceholder: "Chọn lý do huỷ",
    noteLabel: "Ghi chú",
    noteHint: "Ghi rõ chuyện gì đã xảy ra (bắt buộc, tối đa 500 ký tự).",
    cancelButton: "Huỷ có kiểm soát",
    vehicle: {
      title: "Huỷ có kiểm soát xe",
      description:
        "Xe hỏng hoặc sai xe: chuyến này bị huỷ ngay, các kiện đã quét lên xe bị khoá cho tới khi từng kiện được quét dỡ xuống. Một chuyến mới (Chưa đặt xe) với cùng sơ đồ xếp được tạo thay thế để đặt xe khác; các xe còn lại của kế hoạch vẫn đi tiếp.",
      confirm: "Huỷ xe này",
      cardTitle: "Xe gặp sự cố?",
      cardHint:
        "Huỷ có kiểm soát xe đang xếp hàng: xe dỡ hết kiện xuống rồi quay về Chưa đặt xe với cùng sơ đồ xếp, để đặt xe khác. Chỉ quản lý kho làm được.",
    },
    plan: {
      title: "Huỷ có kiểm soát kế hoạch",
      description:
        "Kế hoạch bị huỷ ngay, các xe huỷ theo. Kiện đã quét lên xe đang xếp bị khoá cho tới khi từng kiện được quét dỡ xuống; xe chưa xếp được huỷ như thường. Không thể mở lại kế hoạch.",
      confirm: "Huỷ kế hoạch",
      disabledVehicleLeft:
        "Đã có xe rời kho nên không huỷ cả kế hoạch được — huỷ có kiểm soát từng xe còn lại ở màn chuyến của xe đó.",
      pendingTitle: "Kiện còn phải dỡ khỏi xe",
      pendingDescription:
        "Các kiện này còn nằm trên xe (đơn đã huỷ hoặc xe đã huỷ có kiểm soát) và bị khoá cho tới khi được quét dỡ xuống. Mở chuyến của xe để quét từng kiện (hoặc để quản lý kho xác nhận khi nhãn hỏng).",
      pendingLoad: "Chuyến",
      pendingVehicle: "Xe số",
      pendingOpen: "Mở chuyến để dỡ",
      cancelledReason: "Lý do huỷ có kiểm soát",
    },
    /** Bỏ xe chưa xếp khỏi kế hoạch khi mọi xe còn lại đã đi (SCRUM-474 UNLOAD-DROP). */
    drop: {
      button: "Bỏ xe khỏi kế hoạch",
      title: "Bỏ khỏi kế hoạch xe số",
      description:
        "Các xe khác của kế hoạch đã rời kho và không có xe nào đến chở xe này. Chuyến của xe này bị huỷ, xe được bỏ khỏi kế hoạch, các kiện xếp trên xe quay về chờ kế hoạch mới (như kiện chưa lập kế hoạch) và kế hoạch được coi là hoàn tất.",
      confirm: "Bỏ xe khỏi kế hoạch",
    },
    cancelledBanner: {
      title: "Xe đã huỷ có kiểm soát",
      replacement: "Chuyến thay thế (Chưa đặt xe, cùng sơ đồ xếp):",
      reason: "Lý do:",
    },
  },
  /* ── Biên bản theo xe ───────────────────────────────────────────── */
  manifest: {
    vehicle: "Xe của kế hoạch",
    vehicleValue: (planCode: string | null | undefined, seq: number | null | undefined) =>
      [planCode, seq != null ? `xe số ${seq}` : null].filter(Boolean).join(" · ") || "—",
    vehicleType: "Loại xe",
    perVehicleNote: "Biên bản của riêng xe này — chỉ gồm kiện kế hoạch xếp lên xe.",
    waybill: "Mã vận đơn",
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
  controlledCancelled: "Đã huỷ xe có kiểm soát — chuyến thay thế đã sẵn sàng để đặt xe",
  controlledCancelledNoReplacement:
    "Đã huỷ xe có kiểm soát — xe không còn gì để chở nên không có chuyến thay thế",
  planControlledCancelled: "Đã huỷ có kiểm soát kế hoạch",
  unloadOverridden: "Đã xác nhận dỡ kiện không quét",
} as const;

/** Lỗi quét kiện sai xe (BE 409 PACKAGE_NOT_IN_LOAD kèm `vehicleSeq`, `loadCode`) — `{seq}` / `{code}` được thay. */
export const SHIPPING_WRONG_VEHICLE_NO_CODE_MESSAGE =
  "Kiện này thuộc xe số {seq} — không xếp lên xe này.";

export const SHIPPING_WRONG_VEHICLE_MESSAGE =
  "Kiện này thuộc xe số {seq} ({code}) — không xếp lên xe này.";
