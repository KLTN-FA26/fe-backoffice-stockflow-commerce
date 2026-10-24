/**
 * Fixture đúng hình BE `LoadEstimateResponse` (sau khi interceptor bóc envelope; Jackson `non_null` đã bỏ các key
 * null): dựng từ fixture `Layout` của F1 nên hình học đã được `checkLayout` kiểm chứng. Dùng cho test schema,
 * API và ngăn kéo ước tính.
 */

import { KIT_BAN, LAYOUT_40HC, LAYOUT_PICKUP_KIT, UNPLACED_40HC } from "./layouts";

export const ORDER_ID = "0b6f7c1e-4c5d-4f1a-9a77-2f3e6f1d2a10";
export const WAREHOUSE_ID = "wh-hn-01";
export const ITEM_ID = "item-TV-F";

const unplaced = UNPLACED_40HC.map((line, index) => ({
  ...line,
  sourceRef: index === 0 ? "LINE-003" : "LINE-006",
  reason: index === 0 ? "NO_SPACE" : "TOO_LARGE",
  refs: Array.from({ length: line.quantity }, (_, n) => `LINE-00${index === 0 ? 3 : 6}#${n + 1}`),
}));

/** Ước tính hoàn chỉnh: một container 40HC, hai nhóm kiện chưa xếp, một cảnh báo của bộ phân giải đóng gói. */
export function apiEstimate(patch: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-0000000e5001",
    sourceType: "ORDER",
    sourceId: ORDER_ID,
    warehouseId: WAREHOUSE_ID,
    status: "CURRENT",
    selectionMode: "SINGLE_TYPE",
    vehicleTypeIds: [],
    lines: [
      {
        orderLineId: "LINE-001",
        sku: "SF-A",
        inventoryItemId: "item-SF-A",
        quantity: 120,
        rule: "DEFAULT_SHIPPING_UNIT",
        uom: "CTN",
        factor: 4,
        cartons: 30,
        partial: { units: 2, weightKg: 4.75 },
        dimsMm: { l: 600, w: 400, h: 400 },
        weightKg: 9.5,
        rotatable: true,
        kitParts: 1,
      },
      {
        orderLineId: "LINE-004",
        sku: "KS-D",
        inventoryItemId: "item-KS-D",
        quantity: 14,
        rule: "ITEM_BOX",
        uom: "PCS",
        factor: 1,
        cartons: 14,
        dimsMm: { l: 1200, w: 300, h: 1800 },
        weightKg: 22,
        rotatable: false,
        kitParts: 2,
      },
    ],
    missing: [],
    incomplete: false,
    warnings: [
      {
        orderLineId: "LINE-005",
        sku: "PK-E",
        code: "SHIPPING_UNIT_INCOMPLETE",
        unitOfMeasure: "PALLET",
        fields: ["weightKg"],
        message: "The default shipping unit lacks a weight",
      },
    ],
    vehicles: [LAYOUT_40HC],
    unplaced,
    meta: {
      seed: 0,
      budgetMillis: 5000,
      algorithm: "kit-solver",
      setsTotal: 0,
      minVehicles: 1,
      budgetExhausted: false,
      elapsedMillis: 812,
      bestFoundMillis: 640,
      placedBoxes: LAYOUT_40HC.boxes.length,
      unplacedBoxes: 15,
      kitBalance: [],
      kitWarnings: [],
    },
    createdAt: "2026-10-22T03:00:00Z",
    createdBy: "u-coord",
    ...patch,
  };
}

/** Thiếu kích thước (LP2-3): một dòng bị loại, ước tính `incomplete`. */
export function apiIncompleteEstimate() {
  return apiEstimate({
    incomplete: true,
    missing: [
      {
        orderLineId: "LINE-009",
        sku: "TV-F",
        inventoryItemId: ITEM_ID,
        missingFields: ["lengthCm", "weightKg"],
      },
    ],
  });
}

/** Hai xe (FEWEST_VEHICLES) và hết thời gian tính. */
export function apiTwoVehicleEstimate() {
  return apiEstimate({
    selectionMode: "FEWEST_VEHICLES",
    vehicles: [LAYOUT_40HC, { ...LAYOUT_PICKUP_KIT, seq: 2 }],
    meta: {
      ...apiEstimate().meta,
      budgetExhausted: true,
      kitWarnings: [
        { kitName: KIT_BAN.group, type: "SURPLUS_PARTS", partCode: "BAN-CB", count: 2 },
      ],
    },
    unplaced: [{ ...unplaced[0], reason: "SEARCH_CUT_OFF" }],
  });
}

/** Loại xe đang dùng cho ô chọn (`GET /fulfillment/vehicle-types?status=ACTIVE`). */
export const apiVehicleTypePage = {
  items: [
    {
      vehicleTypeId: "vt-40hc",
      code: "40HC",
      name: "Container 40' High Cube",
      kind: "CONTAINER",
      maxPayloadKg: 26500,
      status: "ACTIVE",
    },
    {
      vehicleTypeId: "vt-pickup",
      code: "PICKUP",
      name: "Xe bán tải",
      kind: "PICKUP",
      maxPayloadKg: 800,
      status: "ACTIVE",
    },
  ],
  page: 0,
  size: 200,
  totalElements: 2,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
};
