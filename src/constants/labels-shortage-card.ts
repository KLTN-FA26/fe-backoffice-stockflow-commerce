/**
 * Thẻ "Đơn thiếu N thùng" (docs 17 §4.14, §5.6, BR-33; 16 §4.7, BR-15; BE `ShortageCardController`): Sale gửi thẻ trong chat,
 * khách chọn một trong bốn hướng, Sale bấm "Thực hiện". Tên enum theo BE (`ShortageOption`, `ShortageCardStatus`,
 * `ShortageCardEnd`) — chữ Việt ở đây là nguồn duy nhất cho trang đơn và thẻ trong chat.
 */

export const SHORTAGE_OPTIONS = [
  "WAIT_FOR_PRODUCTION",
  "REDUCE_CARTONS",
  "SHIP_PART_CLOSE_REST",
  "CANCEL_ORDER",
] as const;
export type ShortageOption = (typeof SHORTAGE_OPTIONS)[number];

export const SHORTAGE_CARD_STATUSES = [
  "SENT",
  "ANSWERED",
  "EXECUTED",
  "SUPERSEDED",
  "EXPIRED",
] as const;
export type ShortageCardStatus = (typeof SHORTAGE_CARD_STATUSES)[number];

/** Vì sao thẻ `SUPERSEDED` / `EXPIRED` (BE `ShortageCardEnd`; docs 17 §4.14 bước 60). */
export const SHORTAGE_ENDED_REASONS = [
  "REALLOCATED",
  "HOLD_RESOLVED_ELSEWHERE",
  "ORDER_CANCELLED",
  "REMAINDER_CLOSED",
  "DECIDED_WITHOUT_CARD",
  "REPLACED",
] as const;
export type ShortageEndedReason = (typeof SHORTAGE_ENDED_REASONS)[number];

/** Giới hạn ghi chú: lời nhắn kèm thẻ 500 (BE chat `note`); ghi chú của lệnh Thực hiện 400 (BE `ShortageCardController.NOTE_MAX`, chừa chỗ cho câu hệ thống). */
export const SHORTAGE_NOTE_MAX = { card: 500, execution: 400 } as const;

export const SHORTAGE_OPTION_LABELS = {
  WAIT_FOR_PRODUCTION: "Chờ sản xuất phần thiếu",
  REDUCE_CARTONS: "Giảm số thùng",
  SHIP_PART_CLOSE_REST: "Giao một phần rồi đóng phần còn lại",
  CANCEL_ORDER: "Huỷ đơn",
} as const satisfies Record<ShortageOption, string>;

export const SHORTAGE_STATUS_LABELS = {
  SENT: "Chờ khách chọn",
  ANSWERED: "Khách đã chọn",
  EXECUTED: "Sale đã thực hiện",
  SUPERSEDED: "Đã có thẻ mới thay thế",
  EXPIRED: "Không cần chọn nữa",
} as const satisfies Record<ShortageCardStatus, string>;

/** Khoá status-map (domain order) cho chấm trạng thái; `ANSWERED` là việc Sale phải làm tiếp nên tone cảnh báo. */
export const SHORTAGE_STATUS_TONE_KEY = {
  SENT: "Sent",
  ANSWERED: "Waiting on Internal",
  EXECUTED: "Completed",
  SUPERSEDED: "Superseded",
  EXPIRED: "Expired",
} as const satisfies Record<ShortageCardStatus, string>;

export const SHORTAGE_ENDED_LABELS = {
  REALLOCATED: "Đơn đã đủ hàng",
  HOLD_RESOLVED_ELSEWHERE: "Đơn đã được gỡ treo",
  ORDER_CANCELLED: "Đơn đã huỷ",
  REMAINDER_CLOSED: "Đã đóng phần còn lại của đơn",
  DECIDED_WITHOUT_CARD: "Sale đã xử lý không qua thẻ",
  REPLACED: "Đã có thẻ mới thay thế",
} as const satisfies Record<ShortageEndedReason, string>;

/** Vì sao chưa gửi được thẻ (BE `ShortagePreview.notSendable`). */
export const SHORTAGE_NOT_SENDABLE_LABELS: Readonly<Record<string, string>> = {
  NOT_ON_HOLD: "Đơn không đang treo vì thiếu thùng.",
  NOTHING_SHORT: "Đơn không còn thùng nào thiếu.",
  LIVE_CARD: "Đã có thẻ đang chờ khách chọn — gửi thẻ mới sẽ thay thẻ cũ.",
  NO_BATCH: "Đơn chưa có đợt giao đã xuất kho.",
};

export const SHORTAGE_LABELS = {
  section: "Thiếu thùng",
  cardTitle: (missing: number) => `Đơn thiếu ${missing} thùng`,
  batch: (seq: number) => `Đợt ${seq}`,
  windowOf: (range: string) => `Cửa sổ giao ${range}`,
  windowMoved: "đã dời",
  tableProduct: "Sản phẩm",
  tableInBatch: "Đợt này",
  tableAvailable: "Đã có",
  tableMissing: "Thiếu",
  tableUnit: "thùng",
  offeredTitle: "Các hướng khách được chọn",
  expectedSource: {
    PRODUCTION_ORDER: "Ngày dự kiến theo Đơn sản xuất đang mở.",
    STANDARD_LEAD_TIME: "Ngày dự kiến theo thời gian sản xuất chuẩn.",
  } as Readonly<Record<string, string>>,
  historyTitle: "Các thẻ đã gửi",
  historyEmpty: "Chưa gửi thẻ nào cho đơn này.",
  loading: "Đang tải thẻ thiếu thùng…",
  loadFailed: "Không tải được thông tin thiếu thùng. Tải lại trang để thử lại.",
  waiting: "Chờ khách chọn",
  chosen: (option: string, time: string) => `Khách đã chọn: ${option} lúc ${time}`,
  customerNote: (note: string) => `Lời nhắn của khách: ${note}`,
  salesNote: (note: string) => `Ghi chú của Sale: ${note}`,
  sentBy: (name: string, time: string) => `Gửi bởi ${name} lúc ${time}`,
  executedBy: (name: string, time: string) => `${name} thực hiện lúc ${time}`,
  executedAt: (time: string) => `Thực hiện lúc ${time}`,
  send: "Gửi thẻ thiếu thùng",
  sendDialog: {
    title: "Gửi thẻ thiếu thùng cho khách",
    description:
      "Thẻ hiện số thùng thiếu và bốn hướng xử lý kèm số tiền / ngày giao; khách bấm chọn trong chat. Nội dung do hệ thống lập từ đơn.",
    noteLabel: "Lời nhắn kèm thẻ (không bắt buộc)",
    notePlaceholder: "Ví dụ: Em báo anh/chị phương án xử lý phần thiếu của đơn.",
    submit: "Gửi thẻ",
    replaceTitle: "Gửi thẻ mới thay thẻ cũ?",
    replaceDescription:
      "Đã có thẻ đang chờ khách chọn cho đợt này. Gửi thẻ mới thì thẻ cũ chuyển sang “Đã có thẻ mới thay thế” và lựa chọn của khách (nếu có) được giữ trong lịch sử.",
    replaceConfirm: "Gửi thẻ mới",
  },
  execute: "Thực hiện",
  executeAs: (option: string) => `Thực hiện: ${option}`,
  executedState: "Sale đã thực hiện",
  awaitingPartialCheck: "Chờ kho hoàn tất kiểm thùng một phần",
  closeRest: "Đóng phần còn lại",
  openInOrder: "Thực hiện trên trang đơn",
  blockedNoPermission: "Bạn không có quyền thực hiện hướng này.",
  moveWindow: {
    toggle: (date: string) =>
      `Dời cửa sổ giao tới ngày dự kiến ${date} (bằng chứng: thẻ thiếu thùng)`,
    startLabel: "Ngày bắt đầu mới",
    endLabel: "Ngày kết thúc mới",
    endHint: "Gợi ý theo độ dài cửa sổ hiện tại; sửa được.",
    endRequired: "Chọn ngày kết thúc của cửa sổ mới.",
  },
  confirm: {
    waitTitle: "Thực hiện: chờ sản xuất phần thiếu",
    waitLines: [
      "Gỡ treo đơn và huỷ các dòng thiếu của đợt này.",
      "Báo Quản lý kho và Điều phối sản xuất để lập Đơn sản xuất cho phần thiếu.",
    ],
    reduceTitle: "Thực hiện: giảm số thùng",
    reduceBody: (missing: number, seq: number, amount: string) =>
      `Bỏ ${missing} thùng thiếu của đợt ${seq}; số phải thu giảm ${amount}.`,
    reduceNoContract: "Không cần phụ lục hợp đồng; đơn được gỡ treo và tiếp tục đóng gói.",
    shipPartTitle: "Thực hiện: giao một phần rồi đóng phần còn lại",
    shipPartLines: [
      "Cho phép giao một phần, huỷ các dòng thiếu và gỡ treo đơn.",
      "Kho kiểm thùng phần đã có; xong thì nút “Đóng phần còn lại” hiện ra để đóng phần chưa giao.",
    ],
    cancelTitle: "Thực hiện: huỷ đơn",
    cancelLines: [
      "Huỷ đơn với lý do hết hàng; tiền đã thu hoàn theo quy định.",
      "Thùng đã lấy được đưa vào hàng đợi cất lại kho.",
    ],
    cancelNoteLabel: "Ghi chú",
    cancelNotePrefill: (orderNumber: string) =>
      `Khách chọn huỷ đơn ${orderNumber} trên thẻ thiếu thùng.`,
    submit: "Xác nhận thực hiện",
    back: "Quay lại",
  },
  closeRestDialog: {
    title: "Đóng phần còn lại của đơn",
    description: "Đóng mọi đợt chưa giao theo lựa chọn của khách trên thẻ thiếu thùng.",
    submit: "Đóng phần còn lại",
  },
  success: {
    sent: "Đã gửi thẻ thiếu thùng cho khách.",
    executed: "Đã thực hiện lựa chọn của khách.",
    closed: "Đã đóng phần còn lại của đơn.",
  },
  failedTitle: {
    send: "Không gửi được thẻ thiếu thùng",
    execute: "Không thực hiện được lựa chọn của khách",
  },
  chat: {
    action: "Gửi thẻ thiếu thùng",
    pickOrder: "Đơn của khách",
    pickPlaceholder: "Chọn đơn",
    pickFirst: "Chọn một đơn để xem đơn có gửi được thẻ không.",
    checking: "Đang kiểm tra đơn…",
    readyNote: "Đơn đang treo vì thiếu thùng — gửi được thẻ.",
    openOrder: "Mở đơn",
  },
} as const;

/** BE `ErrorCode` của thẻ thiếu thùng → câu Việt ngắn, nói việc cần làm (docs 17 §4.14 bước 58). */
export const SHORTAGE_ERROR_MESSAGES = {
  SHORTAGE_CARD_NOT_SENDABLE:
    "Chưa gửi được thẻ: đơn không còn treo vì thiếu thùng, không thiếu thùng nào, hoặc đã có thẻ đang chờ khách chọn.",
  SHORTAGE_CARD_NOT_FOUND: "Không tìm thấy thẻ thiếu thùng này. Tải lại trang để xem thẻ mới nhất.",
  SHORTAGE_CARD_STATE_CONFLICT:
    "Thẻ đã có lựa chọn hoặc không còn hiệu lực — tải lại để xem trạng thái mới.",
  SHORTAGE_OPTION_NOT_AVAILABLE: "Hướng này không còn trên thẻ hoặc khách đã chọn hướng khác.",
  SHORTAGE_NO_CONVERSATION:
    "Chưa có hội thoại với khách này — mở hội thoại từ trang Chat trước khi gửi thẻ.",
  CHAT_NOT_ASSIGNEE: "Chỉ người đang được giao hội thoại với khách mới gửi được thẻ.",
  CHAT_CONTEXT_NOT_FOUND: "Đơn này không thuộc khách của hội thoại.",
} as const satisfies Record<string, string>;
