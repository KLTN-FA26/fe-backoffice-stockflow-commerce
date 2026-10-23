/**
 * Hình thức giao của đơn (LP-1/LP-2, BE PR #157): giao lẻ qua hãng vận chuyển (mặc định) hoặc giao nguyên xe
 * (FTL). Điều phối viên chọn khi release và đổi được tới khi bắt đầu đóng gói; FTL không đi cùng thu tiền khi
 * giao (COD). Nhãn tiếng Việt theo docs 09 §3 "Hình thức giao".
 */

/** BE `order/api/DeliveryMode.java` — cùng tên với lô giao (`ck_shipment_delivery_mode`). */
export const ORDER_DELIVERY_MODES = ["PARCEL", "FULL_TRUCKLOAD"] as const;

export const ORDER_DELIVERY_MODE_LABELS = {
  PARCEL: "Giao lẻ",
  FULL_TRUCKLOAD: "Nguyên xe (FTL)",
  UNKNOWN: "Không rõ",
} as const satisfies Record<(typeof ORDER_DELIVERY_MODES)[number] | "UNKNOWN", string>;

export const ORDER_DELIVERY_MODE_UI = {
  fieldLabel: "Hình thức giao",
  hint: {
    PARCEL: "Đóng thành kiện, bàn giao cho hãng vận chuyển.",
    FULL_TRUCKLOAD: "Thuê cả xe hoặc container cho đơn; kho lập kế hoạch xếp xe.",
  },
  /** Người xem thiếu mã quyền `sales-order-delivery-modes:UPDATE`: chỉ đọc, không đổi được. */
  readOnlyNote: "Chỉ điều phối viên đơn hàng mới đổi được hình thức giao.",
  /** Đơn thu tiền khi giao (COD) không giao nguyên xe được (LP-2, BE 409 DELIVERY_MODE_FTL_NO_COD). */
  ftlNoCod: "Đơn thu tiền khi giao (COD) không giao nguyên xe được — Sale đổi cách thu trước.",
  /** 403: release / đổi sang hình thức khác của đơn mà thiếu mã `sales-order-delivery-modes:UPDATE`. */
  forbidden: "Bạn không có quyền đổi hình thức giao của đơn này.",
  /** Hiện trong lịch sử đơn khi hình thức giao đổi (`DELIVERY_MODE_CHANGE`). */
  historyChanged: (from: string, to: string) => `Đổi hình thức giao: ${from} → ${to}`,
  historySet: (to: string) => `Chọn hình thức giao: ${to}`,
  card: {
    title: "Hình thức giao",
    change: "Đổi hình thức giao",
    lockedTitle: "Đã khoá",
    /** BE `deliveryModeLocked`: kiện đầu tiên đã mở, hoặc đơn đã qua đóng gói / huỷ / đóng. */
    lockedReason:
      "Không đổi được nữa: kho đã bắt đầu đóng gói, hoặc đơn đã qua khâu đóng gói, đã huỷ hoặc đã đóng.",
  },
  /** 409 DELIVERY_MODE_LOCKED: đơn đã đổi trạng thái từ lúc mở màn — dữ liệu được tải lại. */
  lockedError:
    "Không đổi được hình thức giao nữa: kho đã bắt đầu đóng gói, hoặc đơn đã qua khâu đóng gói, đã huỷ hoặc đã đóng. Dữ liệu đã được tải lại.",
  dialog: {
    title: "Đổi hình thức giao",
    description: "Hình thức giao được ghi vào lịch sử đơn.",
    noteLabel: "Ghi chú (không bắt buộc)",
    notePlaceholder: "Vd: Khách lấy 2 container, giao nguyên chuyến",
    submit: "Đổi hình thức",
    success: "Đã đổi hình thức giao",
    failedTitle: "Không đổi được hình thức giao",
    sameMode: "Chọn hình thức khác với hình thức hiện tại.",
  },
} as const;

/** Release đơn cho kho (`POST /orders/{id}/release`, BE `OrderReleaseController`, SCRUM-423 + LP-1). */
export const ORDER_RELEASE_LABELS = {
  button: "Release đơn",
  title: "Release đơn cho kho",
  /** Mô tả theo số dòng in: có dòng in → sinh lệnh sản xuất (đơn In Production); chỉ hàng sẵn → Ready to Fulfill. */
  description: (orderNumber: string, printLines: number) =>
    `Chọn kho xuất hàng và hình thức giao cho đơn ${orderNumber}. ${
      printLines > 0
        ? `Đơn có ${printLines} dòng in — mỗi dòng sinh một lệnh sản xuất tại kho đã chọn.`
        : "Đơn chỉ gồm hàng sẵn — chuyển sang Sẵn sàng thực hiện."
    }`,
  /** docs 17 §4.2 bước 4: dòng in chỉ giao cho kho có khu PRODUCTION + trạm in Active; mẫu duyệt do BE kiểm. */
  printHint:
    "Dòng in chỉ release được cho kho có xưởng in. Thiết kế mới cần mẫu được khách duyệt (BR-PRD-08) — máy chủ kiểm khi release.",
  warehousesEmpty: "Chưa có kho nào đang hoạt động.",
  warehouseLabel: "Kho xuất hàng",
  warehousePlaceholder: "Chọn kho",
  warehousesLoading: "Đang tải danh sách kho…",
  warehousesFailed: "Không tải được danh sách kho.",
  /** 403: seed BE chưa cấp `warehouse-warehouses:READ` cho ORDER_COORDINATOR — nói rõ mã quyền thay vì "không tải được". */
  warehousesForbidden:
    "Bạn chưa có quyền xem danh sách kho (warehouse-warehouses:READ) — nhờ quản trị cấp quyền",
  warehouseRequired: "Chọn kho xuất hàng",
  submit: "Release đơn",
  success: "Đã release đơn cho kho",
  failedTitle: "Không release được đơn",
} as const;

/** Lý do biết trước chưa release được (suy từ dữ liệu đơn) — hiện thay cho nút, không chỉ ẩn nút. */
export const ORDER_RELEASE_BLOCKER_LABELS = {
  title: "Chưa release được",
  /** docs 19 BR-09 / BE ORDER_DEPOSIT_NOT_RECEIVED: đơn cọc phải nhận đủ cọc trước khi release. */
  depositNotReceived: "Đơn đặt cọc chưa nhận đủ tiền cọc.",
  depositRule: "BR-PRD-09",
} as const;

/** Lý do máy chủ từ chối release — kèm mã quy tắc để Coordinator đối chiếu docs. */
export const ORDER_RELEASE_REFUSAL_LABELS = {
  ruleLabel: "Quy tắc",
  /** BR-PRD-08 (docs 19 BR-08 / 17 BR-09): dòng in dùng thiết kế mới cần mẫu khách đã duyệt. */
  sampleNotApproved:
    "Đơn có dòng in dùng thiết kế mới chưa có mẫu được khách duyệt. Cần mẫu Approved trước khi sản xuất.",
  sampleRule: "BR-PRD-08",
  missingSamples: (skus: string) => `SKU chưa có mẫu duyệt: ${skus}`,
  /** BR-PRD-09 (docs 19 BR-09 / 15 BR-02). */
  depositNotReceived:
    "Đơn đặt cọc chưa nhận đủ tiền cọc. Chờ kế toán ghi nhận cọc rồi release lại.",
  depositRule: "BR-PRD-09",
  /** BR-02 (docs 14 edge case, 17 BR-02). */
  creditOverdue:
    "Khách đang có công nợ quá hạn. Cần thu phần quá hạn trước khi release đơn công nợ.",
  creditRule: "BR-02",
  /** LP-2: FTL không đi cùng thu tiền khi giao; chưa release gì. */
  ftlNoCodRule: "LP-2",
  /** Đơn đã đổi trạng thái từ lúc mở màn (đã release, đang giữ, đã huỷ): dữ liệu được tải lại. */
  notReleasable:
    "Đơn không còn ở trạng thái được release (đã release, đang tạm giữ hoặc đã huỷ). Dữ liệu đã được tải lại.",
  notReleasableRule: "BR-02",
  /** Tranh chấp đồng thời (BE `ErrorCode.isRetryable`, 409): giữ hộp thoại, không tự gửi lại. */
  optimisticLock:
    "Đơn vừa được người khác cập nhật. Dữ liệu đơn đã được tải lại — kiểm tra lại rồi bấm thử lại nếu vẫn cần.",
  lockTimeout: "Đơn đang được xử lý ở nơi khác. Đợi vài giây rồi bấm thử lại.",
  inProgress: "Yêu cầu vừa gửi vẫn đang được máy chủ xử lý. Đợi vài giây rồi bấm thử lại.",
  /** 422 từ `IdempotencyFilter`: key đã gắn với một yêu cầu khác — yêu cầu này CHƯA được thực hiện. */
  keyReused:
    "Yêu cầu chưa được gửi đi do trùng mã với yêu cầu trước. Kiểm tra lại rồi bấm gửi lần nữa.",
  warehouseField: "Chọn kho xuất hàng.",
} as const;
