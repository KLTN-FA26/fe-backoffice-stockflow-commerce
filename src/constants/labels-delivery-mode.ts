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
  description:
    "Chọn kho sẽ xuất hàng và hình thức giao. Đơn có dòng in chuyển sang sản xuất, còn lại sẵn sàng cho kho lấy hàng.",
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
