/**
 * Status map — nguồn sự thật: (status string) → semantic tone.
 * Sinh từ object TONE trong components-preview.html (đã auto-gen từ mock-data.ts).
 * 101 giá trị distinct, phủ đủ 26 domain union.
 *
 * Priority: special > danger > positive > warning > info > muted > neutral
 * (CLAUDE.md + FRONTEND-AI-RULES.md §6.1)
 */

import { STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import type { SemanticTone, StatusDomain } from "@/lib/mock-data";

export type { SemanticTone };

const TONE: Record<SemanticTone, readonly string[]> = {
  positive: [
    // Dòng báo giá đã có mẫu khách duyệt (BE QuoteLine.sample.satisfied)
    "Sample Approved",
    // Stock adjustment (BE StockAdjustmentStatus, SCRUM-424)
    STOCK_ADJUSTMENT_STATUS.POSTED,
    "DELIVERED",
    "CONFIRMED",
    "RECEIVED",
    "Confirmed",
    "Approved",
    "APPROVED",
    "Completed",
    "Delivered",
    "Packed",
    // Kiện đã cân, đo, niêm phong (BE PackageStatus.SEALED, PR #136)
    "Sealed",
    "Received",
    "Active",
    // Biến thể (BE VariantStatus, PR #71)
    "ACTIVE",
    "Paid",
    "Matched",
    "Accepted",
    "Pass",
    "In stock",
    "Reviewed",
    "Converted",
    "Authorized",
    "Captured",
    "Available",
    "Occupied",
    "Resolved",
    "Refund Issued",
    "Exchange Shipped",
    "Item Received",
    "Partially Received",
    "Handed to Shipping",
    "Ready to Dispatch",
    "Staged",
    "Picked",
    "Allocated",
    "ACCEPTED",
    "RECEIVED_COMPLETED",
    // Chuyển kho (BE TransferStatus) + chuyến xe (LoadStatus, BE 03-state-machines §11)
    "COMPLETED",
    "DISPATCHED",
  ],
  info: [
    // Bán hàng B2B & sản xuất (BE d215f6e)
    "Sent",
    "Repeat Design",
    "Preparing",
    "Shipping",
    "Submitted",
    "Material Issued",
    "Sent to Customer",
    "QUEUED",
    "SENT",
    "In Progress",
    "In Transit",
    "Picking",
    // Phiên đóng gói đang làm (BE PackStatus.PACKING) và kiện đang mở (PackageStatus.OPEN, PR #136)
    "Packing",
    "Package Open",
    "Shipped",
    "Assigned",
    "Released",
    "Published",
    "In Putaway",
    "Partially Completed",
    "IN_PRODUCTION",
    "Printing",
    "QC",
    "Out for Delivery",
    "Pending (COD)",
    "Reserved",
    "Ready",
    "Locked",
    "Handed Over",
    "Queued",
    "Approved for Payment",
    "Initiated",
    // Chuyển kho: đang lấy hàng ở kho nguồn / đang trên đường (docs 10 §5)
    "PICKING",
    "IN_TRANSIT",
    // Chuyến xe: đã đặt xe / đang xếp hàng lên xe
    "VEHICLE_BOOKED",
    "LOADING",
  ],
  warning: [
    // Bán hàng B2B & sản xuất (BE d215f6e)
    "Pending Activation",
    "Sample Required",
    "Subcontractor Late",
    "Not Reconciled",
    "Under Review",
    "RETRYING",
    "PENDING",
    "PARTIALLY_RECEIVED",
    "PENDING_APPROVAL",
    "Pending Approval",
    "On Hold",
    "Exception",
    "Short",
    "Discrepancy",
    "Quarantine",
    "Blocked",
    "BLOCKED",
    "Low stock",
    "Awaiting Confirmation",
    "Verification Failed",
    "Escalated",
    "Inbound",
    "Reopened",
    "Waiting on Customer",
    "Waiting on Internal",
    "Partially Paid",
    "Warning",
    "Pending Payment",
    "Ready to Fulfill",
    // Order giao một phần (BE PARTIALLY_FULFILLED): còn phần chưa tới tay khách, cần nhân viên xử lý
    "Partially Fulfilled",
    "Return Requested",
    "Pending Verification",
    "Draft Proposal",
    "RECEIVED_PARTIAL",
    "Pending Prepress",
    "Hold",
    // Receipt — còn dòng cần QC chưa kết luận, chặn putaway (docs 03 §5.1)
    "In QC",
  ],
  danger: [
    "Blacklisted",
    "FAILED",
    "REJECTED",
    "CANCELLED",
    "Cancelled",
    "Rejected",
    "Failed",
    "Disputed",
    "Delivery Failed",
    "Returned",
    "Returning",
    "Suspended",
    "SUSPENDED",
    "Out of stock",
    "Fail",
    "Obsolete",
    "OBSOLETE",
    "Payment Failed",
    "Unpaid",
    "Timeout",
    "Changes Requested",
    "CHANGES_REQUESTED",
    "EXPIRED",
  ],
  neutral: [
    "NOT_SENT",
    "DRAFT",
    "Draft",
    "Created",
    "Pending",
    "Label Created",
    "Suggested",
    "Guest",
    "New",
    "Requested",
    "INVITED",
    "PENDING_ACTIVATION",
    // Chuyến xe mới lập kế hoạch, chưa đặt xe
    "PLANNED",
  ],
  muted: [
    // Bán hàng B2B & sản xuất (BE d215f6e)
    "Expired",
    "UNKNOWN",
    "SUPPRESSED",
    // BE #36 cancellationDeliveryStatus: PO huỷ trước khi gửi NCC → không cần báo huỷ.
    "NOT_REQUIRED",
    "CLOSED",
    STOCK_ADJUSTMENT_STATUS.WITHDRAWN,
    "Closed",
    "Inactive",
    "Hidden",
    "Unpublished",
    "Anonymized",
    "Merged",
    "Voided",
    "Superseded",
    "Empty",
    "Full",
    "Disabled",
    "Archived",
    "Discontinued",
    "Abandoned",
    // QC dòng nhận — SKU không bật cờ Yêu cầu QC, đi luồng 2 bước (docs 03 §5.2)
    "Not Required",
  ],
  special: [
    "Refunded",
    "Partially Refunded",
    "In Production",
    "SAMPLE",
    // Gia công ngoài — tách khỏi in tại xưởng (BE d215f6e)
    "Subcontracted",
  ],
};

/** Thứ tự ưu tiên khi status trùng nhiều tone (CLAUDE.md). */
const PRIORITY: readonly SemanticTone[] = [
  "special",
  "danger",
  "positive",
  "warning",
  "info",
  "muted",
  "neutral",
];

/** Tra tone cho một status string. Fallback = neutral. */
export function toneOf(status: string): SemanticTone {
  for (const t of PRIORITY) {
    if ((TONE[t] as readonly string[]).includes(status)) return t;
  }
  return "neutral";
}

/** Nhãn tiếng Việt cho status (song ngữ hiển thị trong tooltip/title). */
export const STATUS_LABEL_VI: Record<string, string> = {
  // PO — BE D4 (PR #71). CONFIRMED = đã chốt và gửi NCC; dùng chung nhãn với phản hồi NCC.
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  PARTIALLY_RECEIVED: "Nhận một phần",
  RECEIVED: "Đã nhận đủ",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã huỷ",
  // Lần gửi NCC (DeliveryAttempt.status). Trạng thái PO cũ (SENT, CLOSED_SHORT) BE PR #71 đã
  // chuyển sang D4 cả trong lịch sử — đóng thiếu là CLOSED + closeKind SHORT_CLOSE.
  SENT: "Đã gửi NCC",
  // PO — trạng thái gửi NCC (BE deliveryStatus / DeliveryAttempt.status) + NCC phản hồi
  // (BE supplierConfirmationStatus). PENDING dùng chung cho "chờ gửi" và "chờ NCC phản hồi".
  NOT_SENT: "Chưa gửi",
  QUEUED: "Đang chờ gửi",
  RETRYING: "Đang gửi lại",
  FAILED: "Gửi thất bại",
  DELIVERED: "Đã gửi tới NCC",
  UNKNOWN: "Không rõ",
  SUPPRESSED: "Đã chặn gửi",
  NOT_REQUIRED: "Không cần báo huỷ",
  PENDING: "Đang chờ",
  CONFIRMED: "Đã xác nhận",
  REJECTED: "NCC từ chối",
  // Stock adjustment (SCRUM-424). PENDING_APPROVAL dùng chung nhãn ở trên; REJECTED ghi đè theo
  // domain ở STATUS_LABEL_VI_BY_DOMAIN vì nhãn chung là của phản hồi NCC.
  [STOCK_ADJUSTMENT_STATUS.POSTED]: "Đã ghi sổ",
  [STOCK_ADJUSTMENT_STATUS.WITHDRAWN]: "Đã rút yêu cầu",
  // Chuyển kho liên kho (BE TransferStatus, docs 10 §5)
  PICKING: "Đang lấy hàng",
  IN_TRANSIT: "Đang vận chuyển",
  COMPLETED: "Hoàn tất",
  // Chuyến xe (BE 03-state-machines §11)
  PLANNED: "Đã lập kế hoạch",
  VEHICLE_BOOKED: "Đã đặt xe",
  LOADING: "Đang xếp hàng",
  DISPATCHED: "Đã bàn giao",
  // Positive
  Confirmed: "Đã xác nhận",
  Approved: "Đã duyệt",
  Completed: "Hoàn tất",
  Delivered: "Đã giao",
  Packed: "Đã đóng gói",
  Sealed: "Đã niêm phong",
  Received: "Đã nhận",
  Active: "Hoạt động",
  ACTIVE: "Đang dùng",
  Paid: "Đã thanh toán",
  Matched: "Khớp",
  Accepted: "Chấp nhận",
  Pass: "Đạt",
  "In stock": "Còn hàng",
  Reviewed: "Đã xem xét",
  Converted: "Đã chuyển đổi",
  Authorized: "Đã ủy quyền",
  Captured: "Đã thu tiền",
  Available: "Khả dụng",
  Occupied: "Đang chiếm",
  Resolved: "Đã giải quyết",
  "Refund Issued": "Đã hoàn tiền",
  "Exchange Shipped": "Đã gửi hàng đổi",
  "Item Received": "Đã nhận hàng",
  "Partially Received": "Nhận một phần",
  "Handed to Shipping": "Bàn giao vận chuyển",
  "Ready to Dispatch": "Sẵn sàng xuất",
  Staged: "Tập kết",
  Picked: "Đã lấy",
  Allocated: "Đã phân bổ",
  // Info
  "In Progress": "Đang xử lý",
  "In Transit": "Đang vận chuyển",
  Picking: "Đang lấy hàng",
  Packing: "Đang đóng gói",
  "Package Open": "Đang mở",
  Shipped: "Đã gửi",
  Assigned: "Đã gán",
  Released: "Đã release",
  Published: "Đã xuất bản",
  "In Putaway": "Đang cất",
  "In QC": "Đang kiểm QC",
  "Not Required": "Không cần QC",
  "Partially Fulfilled": "Thực hiện một phần",
  "Partially Completed": "Hoàn thành một phần",
  "Out for Delivery": "Đang giao",
  "Pending (COD)": "Chờ COD",
  Reserved: "Đã giữ",
  Ready: "Sẵn sàng",
  Locked: "Đã khóa",
  "Handed Over": "Đã bàn giao",
  Queued: "Trong hàng đợi",
  "Approved for Payment": "Duyệt thanh toán",
  Initiated: "Đã khởi tạo",
  "In Production": "Đang sản xuất",
  // Warning
  "Pending Approval": "Chờ duyệt",
  "On Hold": "Tạm giữ",
  Exception: "Ngoại lệ",
  Short: "Thiếu",
  Discrepancy: "Chênh lệch",
  Quarantine: "Cách ly",
  Blocked: "Bị chặn",
  BLOCKED: "Tạm chặn",
  "Low stock": "Sắp hết hàng",
  "Awaiting Confirmation": "Chờ xác nhận",
  "Verification Failed": "Xác minh thất bại",
  Escalated: "Đã leo thang",
  Inbound: "Hàng vào",
  Reopened: "Mở lại",
  "Waiting on Customer": "Chờ khách",
  "Waiting on Internal": "Chờ nội bộ",
  "Partially Paid": "Thanh toán một phần",
  Warning: "Cảnh báo",
  "Pending Payment": "Chờ thanh toán",
  "Ready to Fulfill": "Sẵn sàng thực hiện",
  "Return Requested": "Yêu cầu trả hàng",
  "Pending Verification": "Chờ xác minh",
  "Draft Proposal": "Đề xuất nháp",
  // Danger
  Cancelled: "Đã huỷ",
  Rejected: "Từ chối",
  Failed: "Thất bại",
  Disputed: "Tranh chấp",
  "Delivery Failed": "Giao thất bại",
  Returned: "Đã trả",
  Returning: "Đang trả",
  Suspended: "Tạm ngưng",
  "Out of stock": "Hết hàng",
  Fail: "Không đạt",
  Obsolete: "Lỗi thời",
  OBSOLETE: "Ngừng dùng",
  "Payment Failed": "Thanh toán thất bại",
  Unpaid: "Chưa thanh toán",
  Timeout: "Hết thời gian",
  // Neutral
  Draft: "Nháp",
  Created: "Đã tạo",
  Pending: "Chờ xử lý",
  "Label Created": "Đã tạo nhãn",
  Suggested: "Gợi ý",
  Guest: "Khách vãng lai",
  New: "Mới",
  Requested: "Đã yêu cầu",
  // Muted
  Closed: "Đã đóng",
  Inactive: "Không hoạt động",
  Blacklisted: "Danh sách đen",
  Hidden: "Ẩn",
  Unpublished: "Chưa xuất bản",
  Anonymized: "Đã ẩn danh",
  Merged: "Đã gộp",
  Voided: "Đã vô hiệu",
  // Print & Packaging Production
  "Pending Prepress": "Chờ Prepress",
  Printing: "Đang in",
  QC: "Kiểm tra QC",
  Hold: "Tạm dừng (Hold)",
  "Changes Requested": "Yêu cầu sửa",
  // Bán hàng B2B & sản xuất (BE d215f6e)
  Sent: "Đã gửi khách",
  Expired: "Hết hiệu lực",
  Submitted: "Đã gửi sản xuất",
  "Sent to Customer": "Đã gửi mẫu cho khách",
  "Material Issued": "Đã xuất phôi",
  Subcontracted: "Gia công ngoài",
  "Pending Activation": "Chờ kích hoạt",
  // Nhóm trạng thái đơn khách thấy (BE CustomerOrderCardResponse.statusGroup)
  "Under Review": "Đang xem xét",
  Preparing: "Đang chuẩn bị hàng",
  Shipping: "Đang giao",
  "Sample Approved": "Mẫu đã duyệt",
  "Sample Required": "Cần duyệt mẫu",
  "Repeat Design": "In lại thiết kế cũ",
  "Subcontractor Late": "Nhà gia công trễ hạn",
  "Not Reconciled": "Chưa đối soát phôi",
  IN_PRODUCTION: "Đang gia công",
  RECEIVED_PARTIAL: "Nhận một phần",
  RECEIVED_COMPLETED: "Hoàn tất nhận",
  EXPIRED: "Hết hiệu lực",
  ACCEPTED: "Khách đã duyệt",
  CHANGES_REQUESTED: "Yêu cầu sửa giá",
  INVITED: "Đã mời",
  PENDING_ACTIVATION: "Chờ kích hoạt",
  SAMPLE: "Mẫu thử",
  "ĐƠN HÀNG": "Đơn hàng",
  ORDER: "Đơn hàng",
  Superseded: "Đã thay thế",
  Empty: "Trống",
  Full: "Đầy",
  Disabled: "Vô hiệu hóa",
  Archived: "Lưu trữ",
  Discontinued: "Ngừng kinh doanh",
  Abandoned: "Bỏ dở",
  // Special
  Refunded: "Đã hoàn tiền",
  "Partially Refunded": "Hoàn tiền một phần",
};

/**
 * Nhãn ghi đè theo domain khi cùng một wire value mang nghĩa khác nhau giữa các module
 * (vd REJECTED: PO = "NCC từ chối", điều chỉnh tồn = "Từ chối"). Tone không đổi.
 */
const STATUS_LABEL_VI_BY_DOMAIN: Partial<Record<StatusDomain, Record<string, string>>> = {
  // BE `ProductStatus.INACTIVE` = tạm ngưng (kltn-docs 01 §5.1); NCC cũng có Inactive nhưng là "Không hoạt động".
  product: {
    Inactive: "Tạm ngưng",
  },
  stock: {
    [STOCK_ADJUSTMENT_STATUS.REJECTED]: "Từ chối",
  },
  // Đơn hàng (BE OrderStatus, PR #133): nhãn sát nghĩa nghiệp vụ hơn nhãn dùng chung với module khác
  order: {
    "Ready to Fulfill": "Sẵn sàng xuất kho",
    "Partially Fulfilled": "Giao một phần",
    Shipped: "Đang vận chuyển",
    Returned: "Đã nhận hàng trả",
  },
};

/** Nhãn tiếng Việt của status, ưu tiên nhãn riêng của domain nếu có. */
export function statusLabelVi(status: string, domain?: StatusDomain): string | undefined {
  return (domain && STATUS_LABEL_VI_BY_DOMAIN[domain]?.[status]) ?? STATUS_LABEL_VI[status];
}
