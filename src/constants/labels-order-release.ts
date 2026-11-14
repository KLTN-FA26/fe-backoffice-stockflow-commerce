/**
 * Release đơn cho kho xuất (`POST /orders/{id}/release`, BE `OrderReleaseController`, docs 17 §4.2 bước 5, §4.5, BR-03):
 * quản lý kho của kho xuất release; hàng giữ được phân bổ vào các thùng LPN cụ thể. Không còn chọn hình thức giao
 * (mọi đơn giao nguyên chuyến, docs 17 BR-16).
 */
export const ORDER_RELEASE_LABELS = {
  button: "Release đơn",
  title: "Release đơn cho kho",
  description: (orderNumber: string) =>
    `Chọn kho xuất hàng của đơn ${orderNumber}. Hàng đã giữ được phân bổ vào các thùng (LPN) cụ thể ở kho này và đơn chuyển sang Sẵn sàng thực hiện.`,
  warehousesEmpty: "Chưa có kho nào đang hoạt động.",
  warehouseLabel: "Kho xuất hàng",
  warehousePlaceholder: "Chọn kho",
  warehousesLoading: "Đang tải danh sách kho…",
  warehousesFailed: "Không tải được danh sách kho.",
  /** 403: seed BE chưa cấp `warehouse-warehouses:READ` cho vai trò này — nói rõ mã quyền thay vì "không tải được". */
  warehousesForbidden:
    "Bạn chưa có quyền xem danh sách kho (warehouse-warehouses:READ) — nhờ quản trị cấp quyền",
  warehouseRequired: "Chọn kho xuất hàng",
  submit: "Release đơn",
  success: "Đã release đơn cho kho",
  failedTitle: "Không release được đơn",
  /** Đợt giao của lịch giao (docs 17 §4.5, BR-29): release theo từng đợt, chỉ đợt kế tiếp. */
  batch: {
    label: "Đợt giao",
    hint: "Chỉ release được đợt giao kế tiếp — máy chủ kiểm khi release.",
    loading: "Đang tải lịch giao…",
    failed: "Không tải được lịch giao — để trống, máy chủ sẽ release đợt giao kế tiếp.",
    option: (
      seq: number,
      windowStart: string | null | undefined,
      windowEnd: string | null | undefined,
    ) =>
      `Đợt ${seq}${windowStart || windowEnd ? ` · ${windowStart ?? "…"} → ${windowEnd ?? "…"}` : ""}`,
    released: "đã release",
    states: {
      AWAITING_STOCK: "Đang chờ hàng",
      READY: "Sẵn sàng",
      IN_DELIVERY: "Đang giao",
      DELIVERED: "Đã giao",
      CLOSED: "Đã đóng",
      UNKNOWN: "Không rõ",
    },
    held: (held: number, total: number) => `Đã giữ ${held}/${total} thùng`,
  },
} as const;

/** Lý do biết trước chưa release được (suy từ dữ liệu đơn) — hiện thay cho nút, không chỉ ẩn nút. */
export const ORDER_RELEASE_BLOCKER_LABELS = {
  title: "Chưa release được",
  /** docs 19 BR-09 / BE ORDER_DEPOSIT_NOT_RECEIVED: đơn cọc phải nhận đủ cọc trước khi release. */
  depositNotReceived: "Đơn đặt cọc chưa nhận đủ tiền cọc.",
  depositRule: "BR-PRD-09",
} as const;

/** Lý do máy chủ từ chối release — kèm mã quy tắc để quản lý kho đối chiếu docs. */
export const ORDER_RELEASE_REFUSAL_LABELS = {
  ruleLabel: "Quy tắc",
  /** docs 17 BR-02 / 15 §4.3: khách có đợt thu sau khi giao đã quá hạn thì không release thêm đơn công nợ. */
  creditOverdue:
    "Khách đang có công nợ quá hạn. Cần thu phần quá hạn trước khi release đơn công nợ.",
  creditRule: "BR-02",
  /** 409 ORDER_SHIPPING_WAREHOUSE_MISMATCH (docs 17 BR-22): mỗi đơn đúng một kho xuất, chỉ release ở kho đó. */
  warehouseMismatch:
    "Đơn này xuất từ kho khác — chọn đúng kho xuất của đơn (kho đang giữ hàng cho đơn).",
  warehouseMismatchRule: "BR-22",
  /** 409 ORDER_STOCK_NOT_HELD (docs 17 §4.2 bước 3, 5): chỉ release khi hàng của đợt đã giữ đủ thùng ở kho xuất. */
  stockNotHeld:
    "Hàng của đơn chưa được giữ đủ thùng ở kho xuất. Sale chọn kho xuất và giữ hàng trước, rồi mới release.",
  stockNotHeldRule: "BR-21",
  /** 409 DELIVERY_BATCH_NOT_NEXT (docs 17 BR-29): chỉ release đợt giao kế tiếp. */
  batchNotNext: "Đây không phải đợt giao kế tiếp của đơn — chỉ release được đợt kế tiếp.",
  batchRule: "BR-29",
  /** 404 DELIVERY_BATCH_NOT_FOUND: đợt không thuộc đơn này. */
  batchNotFound: "Đợt giao này không thuộc đơn. Dữ liệu đã được tải lại.",
  /** 409 ORDER_PRINT_GOODS_NOT_RECEIVED: dòng in cũ (mẫu + thiết kế) chưa nhập kho thì chưa release. */
  printGoodsNotReceived:
    "Đơn có dòng in theo thiết kế mà hàng in chưa nhập kho. Nhập kho hàng in rồi mới release.",
  printGoodsRule: "docs 07 / 11",
  /** 403 OUT_OF_DATA_SCOPE: người gọi chỉ release cho kho mình được gán (docs 17 BR-03). */
  outOfScope:
    "Kho này nằm ngoài phạm vi kho bạn phụ trách — chỉ quản lý kho của kho xuất mới release được.",
  outOfScopeRule: "BR-03",
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

/** Thẻ "Xếp xe" của đơn đã release: chỗ cắm nút "Ước tính xếp xe" (SCRUM-287 F3) — trước đây nằm trong thẻ hình thức giao. */
export const ORDER_ESTIMATE_CARD_LABELS = {
  title: "Xếp xe",
} as const;
