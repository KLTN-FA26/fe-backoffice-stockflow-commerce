import { describe, expect, it } from "vitest";

import { warehouseLayoutDto } from "./schemas";

/**
 * Hợp đồng `GET /warehouses/{id}/layout` sau khi BE bỏ storage class khỏi domain kho (kltn-docs 06, 2026-11-05;
 * BE commit 0afa7c5d): kệ không còn `defaultStorageClass`, bin không còn `storageClass` / `capacityUnits` mà có
 * `capacityVolumeM3` tính sẵn (06 BR-19). Fixture rút gọn từ response thật của kho BDG.
 */
const beLayout = {
  warehouse: {
    id: "8b9f6fa3-78fc-b552-930b-01d5daf5a0c2",
    prefix: "BDG",
    name: "Kho Bình Dương",
    mapUnit: "M",
    mapWidth: 60,
    mapHeight: 40,
    status: "ACTIVE",
    version: 0,
  },
  zones: [
    {
      id: "9172c5c2-dea6-99db-adb6-8df1ea81b487",
      warehouseId: "8b9f6fa3-78fc-b552-930b-01d5daf5a0c2",
      name: "Dãy A",
      color: "#4F81BD",
      version: 0,
    },
  ],
  shelves: [
    {
      id: "21fa5c1e-34f2-a048-bb32-4459dce9ad8f",
      zoneId: "9172c5c2-dea6-99db-adb6-8df1ea81b487",
      code: "A01",
      name: "Kệ A01",
      footprint: { x: 16, y: 4, width: 1.2, length: 5, rotation: 0 },
      obstacle: true,
      pickFaces: { north: false, east: true, south: false, west: true },
      status: "ACTIVE",
      effectiveStatus: "ACTIVE",
      version: 0,
      levels: [
        {
          id: "3da624f7-7a5a-05b9-5600-82a104e6c108",
          levelIndex: 1,
          elevation: 0,
          usableHeight: 1.6,
          maxWeight: 800,
          bins: [
            {
              id: "ae7d7d73-6a67-df79-6155-8aabda849856",
              code: "A",
              footprint: { x: 16, y: 4, width: 1.2, length: 1.2, rotation: 0 },
              type: "PALLET",
              locationId: "98deee74-f263-5c24-687e-699dd4eed686",
              locationCode: "BDG-A01-1-A",
              capacityVolumeM3: 2.304,
              maxWeight: 800,
              pickable: true,
              putawayTarget: true,
              status: "ACTIVE",
              effectiveStatus: "ACTIVE",
              usable: true,
            },
          ],
        },
      ],
    },
  ],
  areas: [
    {
      id: "c73f6c79-1939-abe1-fad9-e88656e868b8",
      code: "CHOXUAT01",
      type: "STAGING",
      name: "Khu chờ xuất",
      footprint: { x: 14, y: 30, width: 12, length: 6, rotation: 0 },
      obstacle: false,
      status: "ACTIVE",
      effectiveStatus: "ACTIVE",
      usable: true,
      version: 0,
      locationId: "187e0618-ca8c-1110-134a-6eb7af062114",
      locationCode: "BDG-CHOXUAT01",
      pickable: false,
      putawayTarget: false,
    },
    {
      id: "3ec5960d-d901-9305-cae4-3efa4e35968e",
      code: "OFFICE",
      type: "NON_STORAGE",
      name: "Văn phòng kho",
      footprint: { x: 2, y: 30, width: 8, length: 6, rotation: 0 },
      obstacle: true,
      status: "ACTIVE",
      effectiveStatus: "ACTIVE",
      version: 0,
    },
  ],
  boundaries: [
    {
      id: "9fffb128-625e-8885-8315-d30e12523fc5",
      warehouseId: "8b9f6fa3-78fc-b552-930b-01d5daf5a0c2",
      type: "WALL",
      startX: 0,
      startY: 0,
      endX: 60,
      endY: 0,
      passable: false,
      version: 0,
    },
    {
      id: "e5fd9893-f81f-af78-b01c-4cf9c1ab69bb",
      warehouseId: "8b9f6fa3-78fc-b552-930b-01d5daf5a0c2",
      type: "DOOR",
      startX: 60,
      startY: 2,
      endX: 60,
      endY: 8,
      passable: true,
      operationalStatus: "OPEN",
      version: 0,
    },
  ],
};

describe("warehouseLayoutDto — hợp đồng BE không còn storage class (docs 06, 2026-11-05)", () => {
  it("parse được layout thật: kệ thiếu defaultStorageClass, bin thiếu storageClass", () => {
    const result = warehouseLayoutDto.safeParse(beLayout);
    expect(result.error?.issues).toBeUndefined();
  });

  it("giữ capacityVolumeM3 của bin (06 BR-19)", () => {
    const layout = warehouseLayoutDto.parse(beLayout);
    expect(layout.shelves[0]?.levels[0]?.bins[0]?.capacityVolumeM3).toBe(2.304);
  });
});
