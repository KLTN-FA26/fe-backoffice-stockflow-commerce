import type { InventoryPreview } from "./types";

// Synthetic demo records, explicitly authorized for UI-first development.
// Quantities are supplied, never derived as an approved availability rule.
export function createInventoryFixture(): InventoryPreview {
  const context = {
    sku: "DEMO-SKU-001",
    productName: "Sản phẩm minh họa",
    warehouse: { code: "DEMO-WH", name: "Kho minh họa" },
  };
  return {
    stockLevels: [
      { ...context, id: "demo-level-1", onHand: 24, reserved: 4, available: 24, atp: 20 },
      ...Array.from({ length: 23 }, (_, index) => {
        const number = index + 2;
        const warehouse = [
          { code: "DEMO-WH", name: "Kho minh họa" },
          { code: "DEMO-NORTH", name: "Kho miền Bắc" },
          { code: "DEMO-SOUTH", name: "Kho miền Nam" },
        ][index % 3];
        return {
          id: `demo-level-${number}`,
          sku: `DEMO-SKU-${String(number).padStart(3, "0")}`,
          productName: `Sản phẩm minh họa ${number}`,
          warehouse,
          onHand: 10 + number,
          reserved: number % 4,
          available: 8 + number,
          atp: 7 + number,
        };
      }),
    ],
    // Dated lots first, null expiry last: fixture presentation, not an allocation rule.
    stockItems: [
      {
        ...context,
        id: "demo-item-1",
        location: "DEMO-WH-A",
        lot: "DEMO-LOT-1",
        expiry: "2027-01-15",
        onHand: 12,
        reserved: 4,
        available: 8,
        status: null,
        condition: null,
      },
      {
        ...context,
        id: "demo-item-2",
        location: "DEMO-WH-B",
        lot: null,
        expiry: null,
        onHand: 12,
        reserved: 0,
        available: 12,
        status: null,
        condition: null,
      },
    ],
    reservations: [
      {
        ...context,
        id: "demo-reservation-1",
        orderReference: "DEMO-ORDER-001",
        quantity: 4,
        location: "DEMO-WH-A",
        reservedAt: "2026-10-08T02:00:00Z",
        expiresAt: "2026-10-08T02:30:00Z",
        status: null,
      },
    ],
    atp: { sku: context.sku, warehouseCode: context.warehouse.code, quantity: 20 },
  };
}
