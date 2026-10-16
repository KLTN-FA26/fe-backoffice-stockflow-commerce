/**
 * Fixture lệnh chuyển kho đúng hình dạng BE `TransferOrderResponse` (SCRUM-326/327).
 */

import type { TransferOrder } from "../types";

export const TRANSFER_ID = "9b1f7c1e-1111-4c1a-9a51-0000000000a1";
export const FROM_WH = "d99123fd-2997-4751-6bb9-e10a2e6d9949";
export const TO_WH = "a1b2c3d4-0000-4000-8000-0000000000b2";
export const OTHER_USER = "00000000-0000-4000-8000-0000000000a1";

export function apiTransfer(patch: Partial<TransferOrder> = {}): TransferOrder {
  return {
    transferId: TRANSFER_ID,
    number: "TO-20261012-0001",
    fromWarehouseId: FROM_WH,
    toWarehouseId: TO_WH,
    status: "DRAFT",
    reason: "REBALANCING",
    expectedDate: "2026-10-20",
    lines: [
      {
        lineId: "l-1",
        lineNo: 1,
        sku: "CUP-PP-500",
        lotNumber: "LOT-01",
        requested: 40,
        shipped: 0,
      },
      { lineId: "l-2", lineNo: 2, sku: "TSHIRT-WHT-L", lotNumber: null, requested: 20, shipped: 0 },
    ],
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    dispatchedBy: null,
    dispatchedAt: null,
    cancelReason: null,
    createdAt: "2026-10-12T02:00:00Z",
    version: 3,
    ...patch,
  };
}

export const warehouses = {
  items: [
    { id: FROM_WH, prefix: "HCM", name: "Kho Hồ Chí Minh" },
    { id: TO_WH, prefix: "HN", name: "Kho Hà Nội" },
  ],
  page: 0,
  size: 200,
  totalElements: 2,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
};
