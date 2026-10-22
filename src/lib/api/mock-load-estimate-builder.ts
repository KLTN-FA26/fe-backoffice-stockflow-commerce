/**
 * Dựng một ước tính giả cho mock (BE PR #160), từ fixture `Layout` của F1 (`features/load-planning/__fixtures__`):
 * SINGLE_TYPE → một container 40HC; FEWEST_VEHICLES → thêm một xe bán tải chở bộ bàn và dừng do hết thời gian tính (để
 * màn chạm được "Dừng do hết thời gian tính"). Đơn có từ hai dòng thì dòng cuối bị coi là chưa đo kích thước (LP2-3):
 * vào `missing[]`, ước tính `incomplete`. Tách khỏi `mock-routes-load-estimates.ts` (giới hạn 200 dòng / file).
 */

import {
  KIT_BAN,
  LAYOUT_40HC,
  LAYOUT_PICKUP_KIT,
  UNPLACED_40HC,
} from "@/features/load-planning/__fixtures__/layouts";

import { mockInventoryItemRows } from "./mock-routes-variants";

import type { Layout, LayoutBox } from "@/features/load-planning";
import type { Order } from "@/lib/mock-data";

export type MockEstimate = Record<string, unknown>;

const MISSING_FIELDS = ["lengthCm", "widthCm", "heightCm", "weightKg"];

/** Dòng ước tính của một xe: gom thùng theo `sourceRef`, đúng như BE gom thùng ước tính theo dòng đơn. */
function linesOf(layouts: readonly Layout[]) {
  const groups = new Map<string, LayoutBox[]>();
  for (const box of layouts.flatMap((layout) => layout.boxes)) {
    if (box.sourceRef) groups.set(box.sourceRef, [...(groups.get(box.sourceRef) ?? []), box]);
  }
  return [...groups].map(([orderLineId, boxes]) => {
    const [first] = boxes;
    return {
      orderLineId,
      sku: first.label,
      inventoryItemId: `item-${first.label}`,
      quantity: boxes.length,
      rule: "ITEM_BOX",
      uom: "CTN",
      factor: 1,
      cartons: boxes.length,
      dimsMm: first.origMm,
      weightKg: first.weightKg,
      rotatable: first.rotatable,
      kitParts: 1,
    };
  });
}

/** Chỗ bán tải cho bộ bàn: một xe thứ hai, đánh số lại để seq liên tục. */
const secondVehicle = (): Layout => ({ ...LAYOUT_PICKUP_KIT, seq: 2 });

async function missingLinesOf(order: Order) {
  if (order.lines.length < 2) return [];
  const last = order.lines[order.lines.length - 1];
  const items = await mockInventoryItemRows();
  return [
    {
      orderLineId: last.lineId,
      sku: last.skuId,
      inventoryItemId:
        items.find((item) => item.row.sku === last.skuId)?.id ?? `item-${last.skuId}`,
      missingFields: MISSING_FIELDS,
    },
  ];
}

export async function buildMockEstimate(
  order: Order,
  body: Record<string, unknown>,
  warehouseId: string,
  sequence: number,
): Promise<MockEstimate> {
  const fewest = body.selectionMode === "FEWEST_VEHICLES";
  const vehicles = fewest ? [LAYOUT_40HC, secondVehicle()] : [LAYOUT_40HC];
  const missing = await missingLinesOf(order);
  return {
    id: `00000000-0000-4000-8000-0000000e5${String(sequence).padStart(3, "0")}`,
    sourceType: "ORDER",
    sourceId: order.orderId,
    warehouseId,
    status: "CURRENT",
    selectionMode: fewest ? "FEWEST_VEHICLES" : "SINGLE_TYPE",
    vehicleTypeIds: Array.isArray(body.vehicleTypeIds) ? body.vehicleTypeIds : [],
    lines: linesOf(vehicles),
    missing,
    incomplete: missing.length > 0,
    warnings: [
      {
        orderLineId: "LINE-005",
        sku: "PK-E",
        code: "SHIPPING_UNIT_INCOMPLETE",
        unitOfMeasure: "PALLET",
        fields: ["weightKg"],
      },
    ],
    vehicles,
    unplaced: UNPLACED_40HC.map((line, index) => ({
      ...line,
      sourceRef: index === 0 ? "LINE-003" : "LINE-006",
      reason: index === 0 ? (fewest ? "SEARCH_CUT_OFF" : "NO_SPACE") : "TOO_LARGE",
      refs: Array.from(
        { length: line.quantity },
        (_, n) => `${index === 0 ? "LINE-003" : "LINE-006"}#${n + 1}`,
      ),
    })),
    meta: {
      seed: 0,
      budgetMillis: 5000,
      algorithm: "kit-solver",
      budgetExhausted: fewest,
      elapsedMillis: fewest ? 5003 : 812,
      placedBoxes: vehicles.reduce((sum, v) => sum + v.boxes.length, 0),
      unplacedBoxes: UNPLACED_40HC.reduce((sum, line) => sum + line.quantity, 0),
      kitBalance: [{ [KIT_BAN.parts[0].partName]: 4 }],
      kitWarnings: fewest
        ? [{ kitName: KIT_BAN.group, type: "SURPLUS_PARTS", partCode: "BAN-CB", count: 2 }]
        : [],
    },
    createdAt: new Date().toISOString(),
    createdBy: "mock-coordinator",
  };
}
