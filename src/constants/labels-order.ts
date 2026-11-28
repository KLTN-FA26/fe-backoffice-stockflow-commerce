/**
 * Đơn hàng — giá trị wire BE (BE PR #133, SCRUM-239/246/247) + nhãn / thông báo tiếng Việt.
 *
 * `constants/` là tầng thấp nhất: không import gì ngoài chính nó. Mọi enum ở đây lấy nguyên văn từ BE
 * (`order/api/HoldReason`, `DeliveryFailureReason`, `CancellationReasonCode`, `OrderShipmentStatus`).
 */

/* ── Lý do giữ đơn (BE HoldReason) ───────────────────────────────────── */

/** Mọi lý do một đơn có thể đang ON_HOLD (BE `HoldReason`). */
export const ORDER_HOLD_REASONS = [
  "CREDIT",
  "DESIGN_MISMATCH",
  "PAYMENT",
  "ADDRESS",
  "INVENTORY",
  "CUSTOMER",
  "FRAUD",
  "OTHER",
  // Đơn cũ trước BE PR #377: lô hãng mang về giữ đơn tới khi Sale quyết hồ sơ (không gỡ tay — HoldReason#resolvedByNote).
  // Từ #377 lô hoàn về không giữ đơn nữa; mã còn trên đơn cũ (WF-05 Q-13).
  "DELIVERY_FAILED",
] as const;

/**
 * Lý do điều phối viên được tự nêu khi giữ đơn (`POST /orders/{id}/hold`,
 * `HoldReason#raisedByHand`). CREDIT và DESIGN_MISMATCH là của hệ thống — BE từ chối (400).
 */
export const ORDER_MANUAL_HOLD_REASONS = [
  "PAYMENT",
  "ADDRESS",
  "INVENTORY",
  "CUSTOMER",
  "FRAUD",
  "OTHER",
] as const;

export const ORDER_HOLD_REASON_LABELS = {
  // Giữ CREDIT khi ký: khách có nợ quá hạn HOẶC vượt hạn mức (BE CreditCheck OVERDUE / OVER_LIMIT) — đơn không cho
  // biết là cái nào, nên không nói "vượt hạn mức" khi nguyên nhân là nợ quá hạn (WF-02 audit). Màn duyệt công nợ ghi rõ.
  CREDIT: "Chờ duyệt công nợ (khách quá hạn hoặc vượt hạn mức)",
  // Luồng cũ: BE đã bỏ bước kiểm thiết kế lúc đóng gói, nhưng lịch sử giữ đơn cũ còn mã này.
  DESIGN_MISMATCH: "Sai lệch thiết kế (luồng cũ)",
  PAYMENT: "Vấn đề thanh toán",
  ADDRESS: "Sai địa chỉ / hãng vận chuyển không giao tới",
  INVENTORY: "Thiếu hàng / lệch tồn kho",
  CUSTOMER: "Chờ khách xác nhận thay đổi",
  FRAUD: "Nghi ngờ gian lận",
  OTHER: "Lý do khác",
  DELIVERY_FAILED: "Giao thất bại (đơn cũ) — chờ Sale huỷ phần chưa giao",
} as const satisfies Record<(typeof ORDER_HOLD_REASONS)[number], string>;

/**
 * Hướng dẫn thay cho nút "Gỡ giữ" khi đơn bị giữ bởi hệ thống — BE từ chối gỡ tay
 * (`ORDER_CREDIT_HOLD_USE_APPROVAL`, `ORDER_DELIVERY_FAILURE_USE_DECISION`).
 */
export const ORDER_HOLD_GUIDANCE = {
  CREDIT:
    "Đơn bị giữ chờ duyệt công nợ (khách quá hạn hoặc vượt hạn mức) — không gỡ giữ tại đây. Duyệt hoặc từ chối ở màn duyệt công nợ.",
  DELIVERY_FAILED:
    "Đơn cũ bị giữ vì giao thất bại — không gỡ giữ tại đây. Huỷ phần chưa giao ở khối “Lô hàng hoàn về”; muốn gửi lại hàng thì tạo đơn mới.",
  UNRESOLVABLE: "Không xác định được lý do giữ — chưa thể gỡ giữ từ màn này. Tải lại trang.",
} as const;

/** Nhãn lý do giữ khách được đọc (`holdReasonPublic`) — chỉ dùng khi BE không trả `holdReason`. */
export const ORDER_HOLD_PUBLIC_LABELS: Readonly<Record<string, string>> = {
  AWAITING_CREDIT_APPROVAL: "Chờ duyệt hạn mức công nợ",
  UNDER_REVIEW: "Đang được xem xét",
};

/* ── Lý do giao thất bại (BE DeliveryFailureReason) ──────────────────── */

export const ORDER_DELIVERY_FAILURE_REASONS = [
  "CUSTOMER_ABSENT",
  "REFUSED",
  "WRONG_ADDRESS",
  "LOST",
  "DAMAGED",
  "OTHER",
] as const;

export const ORDER_DELIVERY_FAILURE_LABELS = {
  CUSTOMER_ABSENT: "Khách vắng mặt",
  REFUSED: "Khách từ chối nhận",
  WRONG_ADDRESS: "Sai địa chỉ",
  LOST: "Thất lạc hàng",
  DAMAGED: "Hàng hư hỏng",
  OTHER: "Lý do khác",
} as const satisfies Record<(typeof ORDER_DELIVERY_FAILURE_REASONS)[number], string>;

/* ── Lý do đóng phần còn lại (BE CancellationReasonCode) ─────────────── */

/**
 * `POST /orders/{id}/remainder-closure` nhận mọi `CancellationReasonCode`. Danh sách chọn chỉ giữ
 * lý do hợp với việc không giao nổi phần còn lại của đơn đã giao một phần; các mã còn lại
 * (PAYMENT_NOT_RECEIVED, PAYMENT_FAILED, CREDIT_REJECTED) thuộc huỷ trước khi giao.
 */
export const ORDER_REMAINDER_CLOSURE_REASONS = [
  "OUT_OF_STOCK",
  "PRODUCTION_ISSUE",
  "CUSTOMER_REQUEST",
  "DUPLICATE_ORDER",
  "SUSPECTED_FRAUD",
  "OTHER",
] as const;

export const ORDER_REMAINDER_CLOSURE_LABELS = {
  OUT_OF_STOCK: "Hết hàng, không cung cấp được",
  PRODUCTION_ISSUE: "Sự cố sản xuất",
  CUSTOMER_REQUEST: "Khách yêu cầu",
  DUPLICATE_ORDER: "Đơn trùng",
  SUSPECTED_FRAUD: "Nghi ngờ gian lận",
  OTHER: "Lý do khác",
} as const satisfies Record<(typeof ORDER_REMAINDER_CLOSURE_REASONS)[number], string>;

/**
 * Nhãn lý do của mục "Đóng phần còn lại" trong lịch sử đơn (BE `CancellationReasonCode` mà một lần đóng có thể mang).
 * Sáu lý do đầu dùng đúng lời của hộp thoại đóng phần còn lại; mã khác (đóng sau giao thất bại, lý do huỷ cũ) có
 * nhãn riêng. Mã lạ không có nhãn → không hiện mã thô (xem `remainderClosureReasonLabel`).
 */
export const ORDER_REMAINDER_CLOSURE_HISTORY_REASON_LABELS: Readonly<Record<string, string>> = {
  OUT_OF_STOCK: "Hết hàng, không cung cấp được",
  PRODUCTION_ISSUE: "Sự cố sản xuất",
  CUSTOMER_REQUEST: "Khách yêu cầu",
  DUPLICATE_ORDER: "Đơn trùng",
  SUSPECTED_FRAUD: "Nghi ngờ gian lận",
  OTHER: "Lý do khác",
  DELIVERY_FAILED: "Giao hàng không thành công",
  PAYMENT_NOT_RECEIVED: "Chưa nhận được thanh toán",
  PAYMENT_FAILED: "Thanh toán thất bại",
  CREDIT_REJECTED: "Kế toán từ chối duyệt công nợ",
};

/* ── Lô giao (BE OrderShipmentStatus) ────────────────────────────────── */

export const ORDER_SHIPMENT_STATUSES = [
  "HANDED_OVER",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURNED",
] as const;

/** Trạng thái lô sau khi đọc: giá trị BE thêm sau → "UNKNOWN" (hiển thị "Không rõ"). */
export const ORDER_SHIPMENT_READ_STATUSES = [...ORDER_SHIPMENT_STATUSES, "UNKNOWN"] as const;

/** Lô giao → chuỗi status của `StatusDot` (nhãn + màu dùng chung ở `lib/status-map.ts`). */
export const ORDER_SHIPMENT_STATUS_DISPLAY = {
  HANDED_OVER: "Handed Over",
  DELIVERED: "Delivered",
  DELIVERY_FAILED: "Delivery Failed",
  RETURNED: "Returned",
  UNKNOWN: "UNKNOWN",
} as const satisfies Record<(typeof ORDER_SHIPMENT_READ_STATUSES)[number], string>;

/* ── Cách thu phần còn lại của đơn cọc (BE BalancePolicy / DepositBalancePolicy) ── */

/**
 * `Order.balancePolicy` và `CreditProfile.depositBalancePolicy` (BE PR #150): cách thu phần còn lại
 * của đơn cọc. ON_CREDIT = ghi thành công nợ khi giao, đến hạn sau `creditTermDays`; cần hồ sơ công nợ
 * `allowCredit` (409 BALANCE_POLICY_NOT_ALLOWED / 400 CREDIT_PROFILE_INVALID).
 */
export const ORDER_BALANCE_POLICIES = ["BEFORE_DELIVERY", "ON_DELIVERY", "ON_CREDIT"] as const;

export const ORDER_BALANCE_POLICY_LABELS = {
  BEFORE_DELIVERY: "Chuyển khoản trước khi giao",
  ON_DELIVERY: "Thu hộ khi giao hàng (COD)",
  ON_CREDIT: "Ghi công nợ phần còn lại",
} as const satisfies Record<(typeof ORDER_BALANCE_POLICIES)[number], string>;

/* ── Giao một phần (BE PR #150, PACK-PARTIAL) ────────────────────────── */

/**
 * Sales quyết đơn có được giao từng phần không (`PUT /orders/{id}/partial-shipment`); kho không còn
 * tự quyết. Mỗi quyết định được ghi vào lịch sử đơn.
 */
export const ORDER_PARTIAL_SHIPMENT_LABELS = {
  title: "Giao một phần",
  stateOn: "Đang cho phép",
  stateOff: "Chưa cho phép — đơn giao nguyên cả đơn",
  hintOn:
    "Kho được đóng và bàn giao từng phần của đơn; hàng có sẵn của đơn đang sản xuất được giao trước hàng in.",
  hintOff: "Kho phải đóng đủ cả đơn. Bật khi khách đồng ý nhận hàng từng phần.",
  allowButton: "Cho phép giao một phần",
  stopButton: "Dừng giao một phần",
  allowTitle: "Cho phép giao một phần",
  stopTitle: "Dừng giao một phần",
  allowDescription:
    "Kho được đóng và bàn giao từng phần của đơn. Quyết định được ghi vào lịch sử đơn.",
  stopDescription:
    "Đơn sẽ giao nguyên cả đơn; phần chưa giao của đơn đã giao dở sẽ đi trong một lần bàn giao. Quyết định được ghi vào lịch sử đơn.",
  noteLabel: "Ghi chú (không bắt buộc)",
  notePlaceholder: "Vd: Khách đồng ý nhận hàng sẵn trước, hàng in giao sau",
  allowSubmit: "Cho phép",
  stopSubmit: "Dừng giao một phần",
  allowSuccess: "Đã cho phép giao một phần",
  stopSuccess: "Đã dừng giao một phần",
  failedTitle: "Không cập nhật được giao một phần",
  /** Đơn đã giao dở vì hàng in chưa xong: BE khoá không cho tắt (ORDER_PARTIAL_SHIPMENT_LOCKED). */
  lockedAwaitingPrints:
    "Hàng có sẵn đã đi trước hàng in nên đơn đã tách — chưa dừng giao một phần được cho tới khi hàng in giao xong hoặc phần còn lại được đóng.",
  /** Đơn đã đi / đã đóng: không còn đổi được. */
  lockedClosed: "Đơn đã giao đi hoặc đã đóng — không còn đổi được cách giao.",
} as const;

/**
 * Sale đổi địa chỉ giao của đơn (`PUT /orders/{id}/shipping-address`, docs 17 §4.7 bước 23-24, BR-16; 08 BR-04): chọn
 * một địa chỉ giao khác trong sổ địa chỉ của khách, tới khi thùng đầu tiên của đơn được dán nhãn giao hàng. Mỗi lần đổi
 * được ghi vào lịch sử đơn.
 */
export const ORDER_SHIPPING_ADDRESS_LABELS = {
  button: "Đổi địa chỉ giao",
  title: "Đổi địa chỉ giao",
  description:
    "Chọn địa chỉ giao khác trong sổ địa chỉ của khách. Đổi được tới khi thùng đầu tiên của đơn được dán nhãn giao hàng; lần đổi được ghi vào lịch sử đơn.",
  addressLabel: "Địa chỉ giao mới",
  addressPlaceholder: "Chọn địa chỉ giao",
  addressRequired: "Chọn một địa chỉ giao trong sổ địa chỉ của khách",
  defaultMark: "Mặc định",
  loading: "Đang tải sổ địa chỉ của khách…",
  loadFailed: "Không tải được sổ địa chỉ của khách.",
  noAddress: "Khách chưa có địa chỉ giao nào khác — thêm địa chỉ vào sổ địa chỉ của khách trước.",
  noAddressAccess: "Tài khoản chưa có quyền xem sổ địa chỉ của khách.",
  submit: "Đổi địa chỉ",
  success: "Đã đổi địa chỉ giao của đơn",
  failedTitle: "Không đổi được địa chỉ giao",
} as const;

/* ── Lịch sử đơn (BE GET /orders/{id}/history) ───────────────────────── */

/** BE `OrderStatusChangeResponse.type`. */
export const ORDER_HISTORY_ENTRY_TYPES = [
  "STATUS_CHANGE",
  "PARTIAL_SHIPMENT_DECISION",
  "DELIVERY_MODE_CHANGE",
  "REMAINDER_CLOSURE",
  "ADDRESS_CHANGE",
  // WF-05 BE-52: phiếu hoàn tiền bị huỷ khi đơn còn yêu cầu trả hàng mở — trạng thái không đổi, `reason` = lý do huỷ
  "REFUND_VOIDED",
] as const;

/**
 * Nhãn của mã ghi chú BE ghi ở bước đổi trạng thái do hệ thống / Sale (BE `Order#transitionTo`, dạng `CODE` hoặc
 * `CODE: ghi chú`; tên bước theo docs 17 §5: `Pending Contract` "hợp đồng đã gửi, chờ ký", `Pending Payment` "hợp đồng đã
 * ký, chờ đợt ON_SIGNING", `Awaiting Stock` khi Đơn sản xuất được gửi). Mã giữ đơn (`HoldReason`) và lý do giao thất bại
 * (`DeliveryFailureReason`) dùng nhãn sẵn có của chúng. Mã lạ không có trong bảng → hiện nguyên văn (có thể là ghi chú
 * tự do).
 */
export const ORDER_HISTORY_REASON_LABELS: Readonly<Record<string, string>> = {
  CONTRACT_SENT: "Đã gửi hợp đồng cho khách",
  CONTRACT_SIGNED: "Khách đã ký hợp đồng",
  // Hợp đồng bị huỷ trước khi ký → đơn quay về nháp để lập lại (BE `Order#withdrawContract`)
  CONTRACT_CANCELLED: "Hợp đồng bị huỷ — đơn quay về nháp",
  INSTALLMENT_PAID: "Đã thu đủ các đợt thanh toán khi ký hợp đồng",
  PRODUCTION_ORDER_SENT: "Đã gửi Đơn sản xuất",
  CREDIT_APPROVED: "Kế toán duyệt công nợ",
  // Hàng của lần giao thất bại đã về kho (BE `Order#markReturnedToOrigin`)
  RETURNED_TO_ORIGIN: "Hàng giao thất bại đã về lại kho",
  // Chạy đêm (BE `Order#complete` / `#close`)
  RETURN_WINDOW_CLOSED: "Hết hạn đổi / trả — đơn tự hoàn tất",
  CLOSED_AFTER_SETTLEMENT: "Tự đóng sau khi đã tất toán",
  // Trả hàng (BE `ReturnRequestService`); RETURN_REQUESTED có thể kèm " <số RMA>"
  RETURN_REQUESTED: "Khách yêu cầu trả hàng",
  RETURN_REQUESTED_ON_FULL_DELIVERY: "Đơn giao đủ, còn yêu cầu trả hàng đang mở",
  RETURN_GOODS_ARRIVED: "Hàng trả đã về kho",
  RETURN_GOODS_BACK: "Đã nhận lại hàng trả",
  RETURN_ENDED: "Kết thúc yêu cầu trả hàng, không có hàng về",
  REFUNDED: "Đã hoàn tiền hàng trả",
  // Kế toán huỷ phiếu hoàn tiền → đơn quay về "Đã trả hàng" (BE `Order#refundReopened`)
  REFUND_VOIDED: "Huỷ phiếu hoàn tiền",
  // Giao thất bại đã tất toán tiền (BE `DeliveryFailureService`)
  DELIVERY_FAILED_SETTLED: "Đã tất toán tiền sau giao thất bại",
  // WF-05 Q-2 / Q-7: kho xác nhận phiếu nhập hàng hãng hoàn về — tiền của lô tính lúc này (BE `Order#goodsReceived`)
  RETURN_RECEIVED: "Kho đã nhận lại hàng hoàn của lô giao — đã tính lại tiền của lô",
  // WF-05 Q-12: Sale đóng lô thất lạc có xác nhận của hãng (BE `Order#closeLostShipment`)
  LOST_CLOSED: "Đóng lô giao thất lạc — đã tính lại tiền của lô",
  // WF-05 Q-4 / BE-45: yêu cầu trả hàng xử lý xong mà không hoàn đồng nào (BE `Order#returnSettledWithoutRefund`)
  RETURN_SETTLED_WITHOUT_REFUND: "Đã xử lý yêu cầu trả hàng — không hoàn tiền",
};

export const ORDER_HISTORY_LABELS = {
  title: "Lịch sử đơn",
  loading: "Đang tải lịch sử…",
  empty: "Chưa có thay đổi nào được ghi lại",
  loadFailed: "Không tải được lịch sử đơn. Hãy thử tải lại trang.",
  retry: "Tải lại",
  placed: "Đặt đơn",
  partialAllowed: "Bật giao một phần",
  partialStopped: "Tắt giao một phần",
  /** Mục "Đóng phần còn lại" (`REMAINDER_CLOSURE`): đầu mục là `Đóng phần còn lại: <lý do>`. */
  remainderClosed: "Đóng phần còn lại",
  remainderClosedWithReason: (reason: string) => `Đóng phần còn lại: ${reason}`,
  /** Bước gỡ giữ: BE ghi `HOLD_RESOLVED_<lý do giữ>[: ghi chú]`. */
  holdResolved: "Gỡ giữ đơn",
  holdResolvedWithReason: (reason: string) => `Gỡ giữ đơn (${reason})`,
  /** Bước đơn đổi trạng thái vì lô giao hoàn về kho: BE ghi `RETURNED` hoặc `RETURNED_<lý do giao thất bại>` (`Order#recordShipmentReturned`). */
  shipmentReturned: "Lô giao đã hoàn về kho",
  shipmentReturnedWithReason: (reason: string) => `Lô giao đã hoàn về kho (${reason})`,
  /** Ghi chú cũ của mục "Đóng phần còn lại" khi lô hoàn về kho: tiếng Anh kèm mã lô — thay bằng câu tiếng Việt. */
  shipmentReturnedClosureNote:
    "Lô giao bị hoàn về kho: phần hàng của lô không giao lại trên đơn này",
  /** Mục "Đổi địa chỉ giao" (`ADDRESS_CHANGE`, docs 17 BR-16): địa chỉ cũ → mới. */
  addressChanged: "Đổi địa chỉ giao",
  addressFrom: "Từ",
  addressTo: "Thành",
  /** Mục "Huỷ phiếu hoàn tiền" (`REFUND_VOIDED`, WF-05 BE-52 / TT-3): ghi chú là lý do huỷ của Kế toán. */
  refundVoided: "Huỷ phiếu hoàn tiền",
  unknownEntry: "Thay đổi không rõ",
  by: "Bởi",
  noteLabel: "Ghi chú",
  statusMoved: "Chuyển trạng thái",
  /** Bảng lịch sử (dạng bảng như lịch sử sản phẩm): cột "Loại" theo `kind` của mục. */
  kinds: {
    "status-change": "Đổi trạng thái",
    "partial-shipment": "Giao một phần",
    "remainder-closure": "Đóng phần còn lại",
    "delivery-mode": "Hình thức giao",
    "address-change": "Địa chỉ giao",
    "refund-voided": "Phiếu hoàn tiền",
    unknown: "Khác",
  },
  columns: {
    occurredAt: "Thời gian",
    kind: "Loại",
    detail: "Nội dung",
    actor: "Người thực hiện",
    note: "Ghi chú",
  },
} as const;

/* ── Đóng phần còn lại kèm phí thoả thuận (BE PR #150) ───────────────── */

export const ORDER_REMAINDER_FEE_LABELS = {
  toggle: "Giữ một khoản phí đã thoả thuận với khách",
  toggleHint:
    "Chỉ khi hàng in đã bắt đầu in. Tiền khách đã trả vượt giá trị đơn mới trả phí này trước (kể cả tiền cọc), phần dư được hoàn; thiếu thì ghi thành khoản phải thu. Tối đa bằng giá trị phần hàng in bị đóng.",
  amount: "Số tiền phí (VND)",
  reason: "Lý do giữ phí",
  detail: "Chi tiết đã thoả thuận với khách",
  amountInvalid: "Nhập số tiền nguyên lớn hơn 0",
  /** Số đã đọc được từ ô nhập — để người dùng soát lại trước khi gửi. */
  amountPreview: (formatted: string) => `Sẽ ghi nhận: ${formatted}`,
  reasonRequired: "Nhập lý do giữ phí",
  detailRequired: "Nhập chi tiết đã thoả thuận",
  reasonTooLong: "Lý do tối đa 500 ký tự",
  detailTooLong: "Chi tiết tối đa 2000 ký tự",
} as const;

/* ── Nhãn UI thao tác trạng thái ─────────────────────────────────────── */

export const ORDER_ACTION_LABELS = {
  hold: {
    button: "Giữ đơn",
    title: "Giữ đơn hàng",
    description:
      "Tạm dừng xử lý đơn này. Đơn quay lại đúng bước đang làm khi gỡ giữ. Hàng đã giữ chỗ vẫn được giữ.",
    reasonLabel: "Lý do giữ",
    // Đã có thùng dán nhãn (BE `firstLabeledAt`): địa chỉ in trên nhãn nên không đổi được nữa (docs 08 BR-04, 17 BR-16)
    addressLockedWarning:
      "Đơn đã có thùng dán nhãn nên địa chỉ giao đã khoá, không đổi được. Giữ đơn lý do này chỉ chặn dán nhãn tiếp và hoàn tất kiểm thùng, và chỉ Sale gỡ giữ được.",
    noteLabel: "Ghi chú",
    submit: "Giữ đơn",
    success: "Đã giữ đơn hàng",
    failedTitle: "Không giữ được đơn",
  },
  resolveHold: {
    button: "Gỡ giữ",
    title: "Gỡ giữ đơn hàng",
    description: "Ghi lại cách đã xử lý — đơn quay lại bước trước khi bị giữ.",
    noteLabel: "Cách đã xử lý",
    submit: "Gỡ giữ",
    success: "Đã gỡ giữ đơn hàng",
    failedTitle: "Không gỡ giữ được đơn",
  },
  deliveryFailure: {
    button: "Ghi giao thất bại",
    title: "Ghi nhận giao thất bại",
    description: "Hãng vận chuyển báo không giao được đơn này.",
    reasonLabel: "Lý do giao thất bại",
    noteLabel: "Ghi chú",
    submit: "Ghi giao thất bại",
    success: "Đã ghi nhận giao thất bại",
    failedTitle: "Không ghi được giao thất bại",
  },
  remainderClosure: {
    button: "Đóng phần còn lại",
    title: "Đóng phần còn lại của đơn",
    description:
      "Số lượng chưa giao sẽ không được giao nữa. Đơn chuyển theo kết quả các lô giao, và tiền đã nhận vượt giá trị hàng đã giao sẽ được tạo yêu cầu hoàn.",
    reasonLabel: "Lý do đóng",
    noteLabel: "Ghi chú",
    submit: "Đóng phần còn lại",
    success: "Đã đóng phần còn lại của đơn",
    failedTitle: "Không đóng được phần còn lại",
  },
  reasonPlaceholder: "Chọn lý do",
  requiredNoteHint: "Bắt buộc ghi chú khi chọn “Lý do khác”.",
  /** Giải thích vì sao không có nút "Ghi giao thất bại" khi đơn đã chia lô. */
  shipmentsHint: "Đơn đã chia lô giao — kết quả giao được ghi theo từng lô, không ghi ở cấp đơn.",
} as const;

/* ── Thông báo lỗi theo mã BE ────────────────────────────────────────── */

/**
 * Mã lỗi nghiệp vụ đơn hàng của BE (`common/error/ErrorCode.java`, PR #133) → câu tiếng Việt.
 * Branch theo `error.code`, KHÔNG theo `message` (tiếng Anh, có thể đổi).
 */
export const ORDER_ERROR_MESSAGES = {
  ORDER_INVALID_TRANSITION:
    "Đơn hàng không thể chuyển sang trạng thái này lúc này — trạng thái đơn đã đổi. Dữ liệu đã được tải lại.",
  ORDER_NOT_ON_HOLD: "Đơn hàng không ở trạng thái tạm giữ. Dữ liệu đã được tải lại.",
  ORDER_CREDIT_HOLD_USE_APPROVAL: ORDER_HOLD_GUIDANCE.CREDIT,
  ORDER_DELIVERY_VIA_SHIPMENT: ORDER_ACTION_LABELS.shipmentsHint,
  ORDER_BALANCE_NOT_PAID: "Đơn hàng phải được thanh toán đủ trước khi xuất hàng.",
  ORDER_SHIPMENT_NOT_FOUND: "Đơn hàng không có lô giao này.",
  ORDER_SHIPMENT_CONFLICT: "Lô giao này đã được bàn giao cùng hàng khác.",
  ORDER_SHIPMENT_QUANTITY_EXCEEDED: "Vượt quá số lượng còn lại cần giao của dòng đơn.",
  ORDER_SHIPMENT_INVALID_TRANSITION: "Lô giao không thể chuyển sang trạng thái này lúc này.",
  // BE trả cùng mã cho đơn đã huỷ / đã đóng sổ / đã đóng gói hoặc qua bước không còn cạnh → CANCELLED
  // (Order#cancel, requireNotPacked) — không được đoán là "đã đóng gói".
  ORDER_NOT_CANCELLABLE:
    "Không thể huỷ đơn ở trạng thái hiện tại — đơn có thể đã được huỷ, đã đóng gói hoặc đã sang bước không cho huỷ.",
  ORDER_CANCELLED: "Đơn hàng đã bị huỷ.",
  // BE PR #150 — giao một phần do Sales quyết trên đơn
  ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED:
    "Đơn chưa được phép giao một phần — nhờ Sale bật “Cho phép giao một phần” trên đơn.",
  ORDER_PARTIAL_SHIPMENT_LOCKED:
    "Không đổi được cách giao nữa: đơn đã giao đi hoặc đóng, hoặc hàng có sẵn đã đi trước hàng in nên đơn đã tách.",
  // Đổi địa chỉ giao (docs 17 §4.7 bước 24, BR-16; 08 BR-04): khoá từ thùng đầu tiên dán nhãn, hoặc đơn ở bước không đổi được
  ORDER_ADDRESS_LOCKED:
    "Không đổi được địa chỉ giao nữa: thùng đầu tiên của đơn đã được dán nhãn giao hàng, hoặc đơn đang ở bước không cho đổi địa chỉ (hợp đồng đã gửi chờ ký thì huỷ hợp đồng để sửa).",
  ADDRESS_NOT_FOUND: "Địa chỉ đã chọn không còn trong sổ địa chỉ của khách. Chọn lại địa chỉ.",
  // Sale chọn kho xuất (docs 17 §4.2 bước 2-3, BR-22; BE `ShippingWarehouseService` / `Order#chooseShippingWarehouse`)
  ORDER_SHIPPING_WAREHOUSE_NOT_ALLOWED:
    "Chỉ chọn được kho xuất cho đơn của hợp đồng đã ký, khi đơn đã xác nhận hoặc đang chờ hàng. Dữ liệu đã được tải lại.",
  ORDER_SHIPPING_WAREHOUSE_LOCKED:
    "Không đổi được kho xuất nữa: đơn đã giữ hàng ở kho hiện tại, hoặc đã có Đơn sản xuất gửi về kho đó. Dữ liệu đã được tải lại.",
  // BE PR #150 — thu phần còn lại ghi công nợ; huỷ / đóng phần còn lại có phí
  BALANCE_CREDIT_LIMIT_EXCEEDED:
    "Phần còn lại ghi công nợ làm công nợ của khách vượt hạn mức. Chọn cách thu khác hoặc nhờ Kế toán nâng hạn mức.",
  CUSTOMER_CREDIT_OVERDUE:
    "Khách đang có công nợ quá hạn — chưa ghi công nợ thêm được. Chọn cách thu khác hoặc xử lý khoản quá hạn trước.",
  BALANCE_POLICY_NOT_ALLOWED:
    "Khách này chưa được phép ghi công nợ phần còn lại — chọn cách thu khác hoặc bật công nợ cho khách.",
  CREDIT_PROFILE_INVALID:
    "Điều khoản của khách chưa hợp lệ: “Ghi công nợ phần còn lại” cần bật công nợ (allowCredit) cùng hạn mức và số ngày nợ.",
  CANCELLATION_FEE_BEFORE_PRINTING:
    "Đơn chưa bắt đầu in nên hoàn tiền đủ, không giữ phí — bỏ khoản phí rồi gửi lại.",
  // Release đơn (BE `OrderReleaseService`)
  WAREHOUSE_NOT_FOUND: "Không tìm thấy kho đã chọn. Chọn lại kho.",
  WAREHOUSE_INACTIVE: "Kho đã chọn không còn hoạt động. Chọn kho khác.",
  DESIGN_SAMPLE_NOT_APPROVED:
    "Đơn có thiết kế mới chưa có mẫu thử khách đã duyệt — chưa release được (BR-PRD-08).",
  ORDER_DEPOSIT_NOT_RECEIVED: "Tiền cọc của đơn chưa về — chưa release được (BR-PRD-09).",
} as const;

export type OrderErrorCode = keyof typeof ORDER_ERROR_MESSAGES;

/**
 * Khối "Thanh toán" ở chi tiết đơn, phần các đợt thanh toán (docs 15 §5.2; BE `GET /installments/orders/{id}` —
 * `paymentStatus`, `paid`, `outstanding`, `dueBeforeHandover`).
 */
export const ORDER_INSTALLMENTS_LABELS = {
  paymentStatus: "Tình trạng thanh toán",
  unknownStatus: "Không rõ",
  count: "Số đợt thanh toán",
  collected: "Đã thu / tổng",
  /** Đơn huỷ mà mọi đợt đã huỷ: không còn "tổng / còn phải thu", chỉ số tiền khách đã trả. */
  paidWhenCancelled: "Đã thanh toán",
  outstanding: "Còn phải thu",
  dueBeforeHandover: "Phải thu trước khi xuất",
  list: "Các đợt",
  countValue: (n: number) => `${n} đợt`,
  /** BO-UX-24: hạn trả của đợt và số ngày quá hạn. */
  dueOn: (date: string) => `hạn ${date}`,
  overdueDays: (days: number) => `quá hạn ${days} ngày`,
  viewAll: "Xem các đợt",
} as const;

/**
 * Khối "Thanh toán" ở chi tiết đơn — số tiền BE `OrderResponse` có (4B-3): tổng, tạm tính trước thuế, dòng phí, VAT, giá
 * trị sau khi đóng phần còn lại. Tiến độ thu tiền đọc từ các đợt (`ORDER_INSTALLMENTS_LABELS`).
 */
export const ORDER_FINANCE_LABELS = {
  title: "Thanh toán",
  total: "Tổng thanh toán",
  net: "Tạm tính (trước thuế)",
  tax: "Thuế GTGT",
  effectiveTotal: "Giá trị sau khi đóng phần còn lại",
  /** bo-18: đơn chưa có hợp đồng ký thì chưa có đợt thanh toán / hoá đơn — không hiện khối trống. */
  settlementBeforeContract:
    "Đợt thanh toán, hoá đơn điện tử và điều kiện hoàn tất hiện ở đây sau khi khách ký hợp đồng.",
  feeKinds: {
    PLATE_FEE: "Phí khuôn / bản in",
    SHIPPING_FEE: "Phí vận chuyển",
    UNKNOWN: "Phí khác",
  },
  feeOfSku: (label: string, sku: string) => `${label} · ${sku}`,
} as const;

/**
 * BO-UX-22: "Bước tiếp theo" trong thẻ trạng thái của đơn, cho các trạng thái mà việc tiếp theo nằm ở khối khác của
 * trang (hợp đồng, các đợt). `anchor` = neo cuộn tới trên trang chi tiết.
 */
export const ORDER_NEXT_STEP_LABELS = {
  prefix: "Bước tiếp theo:",
  Draft: { text: "Lập hợp đồng", anchor: "#contract" },
  "Pending Contract": { text: "Ghi nhận hợp đồng khách đã ký", anchor: "#contract" },
  "Pending Payment": { text: "Chờ khách trả đợt khi ký", anchor: "#contract" },
} as const;
