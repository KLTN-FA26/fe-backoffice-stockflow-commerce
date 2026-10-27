/**
 * Lịch sử thay đổi sản phẩm của mock (BE `GET /products/{id}/versions`, SCRUM-461): các module mock
 * ghi vào đây khi một thao tác thành công, mới nhất trước — như `product_change_log` của BE.
 * Dữ liệu seed không có lịch sử (BE cũng chỉ ghi từ khi có bảng này), nên bắt đầu rỗng.
 */

import { pageOf } from "./mock-route-utils";

type ChangeType =
  | "CREATED"
  | "UPDATED"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED"
  | "RESUMED"
  | "DISCONTINUED"
  | "VARIANT_ADDED"
  | "VARIANT_UPDATED"
  | "VARIANT_STATUS"
  | "MEDIA"
  | "LOGISTICS"
  | "INVENTORY_CONTROL"
  // BE #121: thông tin mua hàng của một SKU (`SkuPurchasingService.describe`)
  | "PURCHASING";

type Subject = "PRODUCT" | "VARIANT" | "MEDIA" | "LOGISTICS" | "INVENTORY_CONTROL" | "PURCHASING";

const SUBJECT: Record<ChangeType, Subject> = {
  CREATED: "PRODUCT",
  UPDATED: "PRODUCT",
  SUBMITTED: "PRODUCT",
  APPROVED: "PRODUCT",
  REJECTED: "PRODUCT",
  SUSPENDED: "PRODUCT",
  RESUMED: "PRODUCT",
  DISCONTINUED: "PRODUCT",
  VARIANT_ADDED: "VARIANT",
  VARIANT_UPDATED: "VARIANT",
  VARIANT_STATUS: "VARIANT",
  MEDIA: "MEDIA",
  LOGISTICS: "LOGISTICS",
  INVENTORY_CONTROL: "INVENTORY_CONTROL",
  PURCHASING: "PURCHASING",
};

/** BE `ProductWebMapper#auditActionOf`. */
function auditActionOf(type: ChangeType): string {
  switch (type) {
    case "CREATED":
    case "VARIANT_ADDED":
      return "CREATE";
    case "APPROVED":
      return "APPROVE";
    case "REJECTED":
      return "REJECT";
    case "SUBMITTED":
    case "SUSPENDED":
    case "RESUMED":
    case "DISCONTINUED":
    case "VARIANT_STATUS":
      return "TRANSITION";
    default:
      return "UPDATE";
  }
}

/** Mã trạng thái sản phẩm của mock (tên hiển thị) → mã BE ghi trong lịch sử. */
const BE_STATUS: Record<string, string> = {
  Draft: "DRAFT",
  "Pending Approval": "PENDING_APPROVAL",
  Approved: "APPROVED",
  Published: "PUBLISHED",
  Inactive: "INACTIVE",
  Discontinued: "DISCONTINUED",
};
export const beProductStatus = (status: string): string => BE_STATUS[status] ?? status;

interface Entry {
  action: string;
  actorName: string;
  outcome: "SUCCESS";
  occurredAt: string;
  changeType: ChangeType;
  subjectType: Subject;
  subjectId: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  changedFields: string[];
}

const MOCK_ACTOR = "Người dùng mock";
const history = new Map<string, Entry[]>();

export function resetProductHistoryMock(): void {
  history.clear();
}

export function recordMockHistory(
  productId: string,
  changeType: ChangeType,
  detail: {
    subjectId?: string;
    fromStatus?: string;
    toStatus?: string;
    reason?: string;
    changedFields?: string[];
  } = {},
): void {
  const entry: Entry = {
    action: auditActionOf(changeType),
    actorName: MOCK_ACTOR,
    outcome: "SUCCESS",
    occurredAt: new Date().toISOString(),
    changeType,
    subjectType: SUBJECT[changeType],
    subjectId: detail.subjectId ?? null,
    fromStatus: detail.fromStatus ?? null,
    toStatus: detail.toStatus ?? null,
    reason: detail.reason ?? null,
    changedFields: detail.changedFields ?? [],
  };
  history.set(productId, [entry, ...(history.get(productId) ?? [])]);
}

export function clearMockHistory(productId: string): void {
  history.delete(productId);
}

export function mockHistoryPage(productId: string, page: number, size: number) {
  return pageOf(history.get(productId) ?? [], page, size);
}
