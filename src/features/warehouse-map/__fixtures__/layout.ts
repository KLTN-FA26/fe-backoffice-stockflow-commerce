/**
 * Bố cục mẫu cho test — dạng đã parse của `WarehouseLayoutResponse`. Kệ A01 / khu RCV01 lấy theo seed
 * demo BE (kho HCM 60 × 40 m); kệ Z99 INACTIVE để test BR-07 (vị trí ngưng không chặn chỗ).
 */

import type { LayoutBin, WarehouseLayout } from "../types";

const bin = (code: string, x: number, usable: boolean): LayoutBin => ({
  id: `bin-${code}`,
  code,
  footprint: { x, y: 0, width: 5, length: 1.2, rotation: 0 },
  type: "PALLET",
  locationId: `loc-${code}`,
  locationCode: `HCM-A01-1-${code}`,
  storageClass: "OVERSIZE",
  pickable: true,
  putawayTarget: true,
  status: usable ? "ACTIVE" : "BLOCKED",
  effectiveStatus: usable ? "ACTIVE" : "BLOCKED",
  usable,
});

export const LAYOUT: WarehouseLayout = {
  warehouse: {
    id: "wh-hcm",
    prefix: "HCM",
    name: "Kho Hồ Chí Minh",
    mapUnit: "M",
    mapWidth: 60,
    mapHeight: 40,
    status: "ACTIVE",
    version: 0,
  },
  zones: [{ id: "zone-a", name: "Khu A - Sofa", color: "#4F81BD", version: 0 }],
  shelves: [
    {
      id: "shelf-a01",
      zoneId: "zone-a",
      code: "A01",
      name: "Kệ A01",
      footprint: { x: 5, y: 5, width: 10, length: 1.2, rotation: 0 },
      obstacle: true,
      pickFaces: { north: false, east: false, south: true, west: false },
      defaultStorageClass: "OVERSIZE",
      status: "ACTIVE",
      effectiveStatus: "ACTIVE",
      version: 0,
      levels: [
        {
          id: "level-a01-1",
          levelIndex: 1,
          elevation: 0,
          usableHeight: 1.4,
          maxWeight: 500,
          bins: [bin("A", 0, true), bin("B", 5, false)],
        },
        {
          id: "level-a01-2",
          levelIndex: 2,
          elevation: 1.5,
          usableHeight: 1.4,
          bins: [{ ...bin("A", 0, true), id: "bin-A2", locationCode: "HCM-A01-2-A" }],
        },
      ],
    },
    {
      id: "shelf-z99",
      code: "Z99",
      name: "Kệ ngưng",
      footprint: { x: 30, y: 30, width: 2, length: 2, rotation: 0 },
      obstacle: true,
      pickFaces: { north: true, east: false, south: false, west: false },
      defaultStorageClass: "NORMAL",
      status: "INACTIVE",
      effectiveStatus: "INACTIVE",
      version: 3,
      levels: [],
    },
  ],
  areas: [
    {
      id: "area-rcv",
      code: "RCV01",
      type: "RECEIVING",
      name: "Khu nhận hàng",
      footprint: { x: 40, y: 2, width: 15, length: 8, rotation: 0 },
      obstacle: false,
      status: "ACTIVE",
      effectiveStatus: "ACTIVE",
      usable: true,
      version: 0,
      locationId: "loc-rcv",
      locationCode: "HCM-RCV01",
      storageClass: "OVERSIZE",
      pickable: false,
      putawayTarget: false,
    },
  ],
  boundaries: [
    {
      id: "wall-n",
      type: "WALL",
      startX: 0,
      startY: 0,
      endX: 60,
      endY: 0,
      passable: false,
      version: 0,
    },
  ],
};
