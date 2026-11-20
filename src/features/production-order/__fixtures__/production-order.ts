/**
 * Fixture theo hợp đồng BE `ProductionOrderResponse` / `Producer` (brief BE 2026-11-20) — dùng chung cho test đơn vị
 * và test màn hình. Id cố định, không có trong dữ liệu thật.
 */

import {
  DELAY_ALERT_PERMISSIONS,
  ORDER_DELIVERY_BATCH_PERMISSIONS,
  PRODUCER_PERMISSIONS,
  PRODUCTION_ORDER_PERMISSIONS,
  PRODUCTION_SCHEDULE_PERMISSIONS,
} from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { ProductionOrder } from "../types";

export const COORDINATOR_ID = "11111111-1111-4111-8111-111111111111";
export const MANAGER_ID = "22222222-2222-4222-8222-222222222222";
export const PRODUCER_ID = "33333333-3333-4333-8333-333333333333";

const PO = PRODUCTION_ORDER_PERMISSIONS;
// BE V20261124000650: mọi vai đọc hợp đồng (Sale, Sales Manager, Điều phối sản xuất) và vai release đọc lịch giao
const BATCHES = ORDER_DELIVERY_BATCH_PERMISSIONS.read;

/** Mã quyền theo BE PermissionMatrixTest — FE chỉ đọc mã, không đọc tên vai trò. */
export const PRODUCTION_ACTORS = {
  coordinator: [
    PO.viewPage,
    PO.read,
    PO.create,
    PO.update,
    PRODUCER_PERMISSIONS.viewPage,
    PRODUCER_PERMISSIONS.read,
    PRODUCER_PERMISSIONS.create,
    PRODUCER_PERMISSIONS.update,
    PRODUCTION_SCHEDULE_PERMISSIONS.viewPage,
    PRODUCTION_SCHEDULE_PERMISSIONS.read,
    BATCHES,
    // BE V20261209000400: Điều phối sản xuất đọc cảnh báo trễ (BE bỏ DELIVERY_LATE — BR-30)
    DELAY_ALERT_PERMISSIONS.read,
  ] as PermissionCode[],
  // Chốt lại 2026-11-20 (BE V20261211000200): không còn duyệt — Sales Manager chỉ đọc
  salesManager: [
    PO.viewPage,
    PO.read,
    PRODUCER_PERMISSIONS.viewPage,
    PRODUCER_PERMISSIONS.read,
    PRODUCTION_SCHEDULE_PERMISSIONS.viewPage,
    PRODUCTION_SCHEDULE_PERMISSIONS.read,
    BATCHES,
  ] as PermissionCode[],
  sales: [
    PO.viewPage,
    PO.read,
    PRODUCER_PERMISSIONS.viewPage,
    PRODUCER_PERMISSIONS.read,
    BATCHES,
  ] as PermissionCode[],
  warehouseManager: [PO.viewPage, PO.read, PRODUCER_PERMISSIONS.read, BATCHES] as PermissionCode[],
};

export const actorOf = (codes: readonly PermissionCode[]) => (code: PermissionCode) =>
  codes.includes(code);

export function productionOrder(overrides: Partial<ProductionOrder> = {}): ProductionOrder {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    code: "PRD-20261120-0001",
    salesOrderId: "55555555-5555-4555-8555-555555555555",
    deliveryBatchId: "66666666-6666-4666-8666-666666666666",
    customerId: "77777777-7777-4777-8777-777777777777",
    producerId: PRODUCER_ID,
    receivingWarehouseId: "88888888-8888-4888-8888-888888888888",
    needByDate: "2026-12-10",
    status: "DRAFT",
    sampleApprovalRequired: true,
    sampleRequiredByDefault: true,
    drawnUpBy: COORDINATOR_ID,
    capacity: {
      board: {
        warehouseId: "88888888-8888-4888-8888-888888888888",
        warehouseCode: "HCM",
        warehouseName: "Kho HCM",
        projectedFreeM3: 12.5,
        pendingM3: 4,
        freeIfAllApprovedM3: 8.5,
      },
      neededM3: 3.2,
      exceedsProjected: false,
      exceedsIfAllApproved: false,
    },
    lines: [
      {
        id: "line-1",
        orderLineId: "ol-1",
        sku: "CUS-TEE-001",
        cartons: 10,
        unitsPerCarton: 50,
        totalUnits: 500,
        receivedCartons: 0,
      },
      {
        id: "line-2",
        orderLineId: "ol-2",
        sku: "CUS-CUP-002",
        cartons: 4,
        unitsPerCarton: 24,
        totalUnits: 96,
        packingRequirements: "Dán nhãn mặt trước",
        receivedCartons: 0,
      },
    ],
    history: [{ to: "DRAFT", by: COORDINATOR_ID, at: "2026-11-20T02:00:00Z" }],
    version: 3,
    ...overrides,
  };
}

/** Body BE thô (trước parse) — Jackson `non_null` bỏ field null. */
export const producerDto = {
  id: PRODUCER_ID,
  code: "IN-MINHPHAT",
  name: "In Minh Phát",
  contactName: "Chị Lan",
  email: "don@minhphat.vn",
  channel: "EMAIL",
  standardLeadDays: 14,
  status: "ACTIVE",
  version: 1,
};

export function bePage<T>(items: T[]) {
  return {
    items,
    page: 0,
    size: 15,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrevious: false,
  };
}
