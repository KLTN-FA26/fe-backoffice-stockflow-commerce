/**
 * Fixture đúng hình dạng response BE `FulfillmentController` (SCRUM-43). Field chưa có giá trị
 * được BỎ khỏi object (Jackson non_null) chứ không gán null.
 */

import type {
  Assignee,
  FulfillmentOrder,
  FulfillmentTaskApiDto,
  IntegrityEvidence,
} from "../types";

export const TASK_ID = "3f2c9a10-7b1d-4e55-9c0a-1d2e3f4a5b6c";
export const ORDER_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
export const PLAIN_LINE_ID = "11111111-aaaa-4bbb-8ccc-000000000001";
export const DESIGN_LINE_ID = "22222222-aaaa-4bbb-8ccc-000000000002";
export const SNAPSHOT_ID = "55555555-aaaa-4bbb-8ccc-000000000005";
export const WAREHOUSE_ID = "wh-hcm-0001";
export const PICKER_ID = "7e1d0c2b-3a4f-4b5c-9d6e-8f7a6b5c4d3e";
export const OTHER_PICKER_ID = "8f2e1d3c-4b5a-4c6d-8e7f-9a8b7c6d5e4f";

export const LOCKED_CHECKSUM = "a".repeat(64);
export const TAMPERED_CHECKSUM = "b".repeat(64);

export function apiEvidence(overrides: Partial<IntegrityEvidence> = {}): IntegrityEvidence {
  return {
    orderLineId: DESIGN_LINE_ID,
    snapshotId: SNAPSHOT_ID,
    expectedChecksum: LOCKED_CHECKSUM,
    actualChecksum: LOCKED_CHECKSUM,
    matching: true,
    verifiedAt: "2026-10-10T03:00:00Z",
    ...overrides,
  };
}

export const mismatchEvidence = (verifiedAt = "2026-10-10T03:00:00Z") =>
  apiEvidence({ actualChecksum: TAMPERED_CHECKSUM, matching: false, verifiedAt });

export function apiTask(overrides: Partial<FulfillmentTaskApiDto> = {}): FulfillmentTaskApiDto {
  return {
    taskId: TASK_ID,
    orderId: ORDER_ID,
    warehouseId: WAREHOUSE_ID,
    assignedUserId: PICKER_ID,
    pickStatus: "PENDING",
    packStatus: "PENDING",
    assignedAt: "2026-10-10T01:00:00Z",
    integrityEvidence: [],
    ...overrides,
  };
}

/** Task đã lấy hàng xong, chờ đóng gói. */
export const pickedTask = (overrides: Partial<FulfillmentTaskApiDto> = {}) =>
  apiTask({
    pickStatus: "PICKED",
    startedAt: "2026-10-10T01:30:00Z",
    pickedAt: "2026-10-10T02:00:00Z",
    ...overrides,
  });

export const fulfillmentOrder: FulfillmentOrder = {
  orderId: ORDER_ID,
  orderNumber: "SO-20261010-000431",
  status: "PICKING",
  warehouseId: WAREHOUSE_ID,
  lines: [
    { lineId: PLAIN_LINE_ID, sku: "TEE-BLK-M", quantity: 3 },
    {
      lineId: DESIGN_LINE_ID,
      sku: "TEE-CUSTOM-L",
      quantity: 2,
      designSnapshotId: SNAPSHOT_ID,
      designChecksum: LOCKED_CHECKSUM,
    },
  ],
};

/** `GET /fulfillment/assignees` — chỉ tên + vai trò (BE `AssigneeResponse`). */
export const assignees: Assignee[] = [
  { userId: PICKER_ID, displayName: "Hoàng Anh Tuấn", roles: ["WAREHOUSE_STAFF"] },
  { userId: OTHER_PICKER_ID, displayName: "Nguyễn Văn Đạt", roles: ["WAREHOUSE_STAFF"] },
];

/** PageResponse BE (trang từ 0). */
export function bePage<T>(items: T[], page = 0, size = 15) {
  return {
    items,
    page,
    size,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrevious: page > 0,
  };
}
