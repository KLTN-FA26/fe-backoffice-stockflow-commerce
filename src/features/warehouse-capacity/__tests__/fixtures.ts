/**
 * JSON đúng hình BE `WarehouseCapacityService.Board` (`non_null` → trường null vắng mặt) cho test.
 * Số liệu khớp công thức docs 06 §4.6 bước 3: capacity = binVolume × factor; projectedFree = capacity − occupied −
 * incoming; freeIfAllApproved = projectedFree − pending; % trên capacity, 2 số lẻ.
 */

import { capacityBoardDto } from "../schemas";

import type { CapacityBoard } from "../types";

/** Kho còn chỗ: 85% của 1.000 m³ bin. */
export const roomyBoardJson = {
  warehouseId: "wh-hcm",
  warehouseCode: "HCM01",
  warehouseName: "Kho Thủ Đức",
  active: true,
  utilizationFactor: 0.85,
  binVolumeM3: 1000,
  capacityM3: 850,
  occupiedM3: 400,
  occupiedKg: 12500.5,
  incomingM3: 100,
  projectedFreeM3: 350,
  pendingM3: 50,
  freeIfAllApprovedM3: 300,
  outgoingM3: 20,
  occupiedPercent: 47.06,
  projectedFreePercent: 41.18,
  binsWithoutVolume: 0,
  cartonsWithoutSize: 0,
  productionCartonsWithoutSize: 0,
  groups: [
    {
      key: "NO_ZONE",
      kind: "NO_ZONE",
      capacityM3: 50,
      occupiedM3: 10,
      freeM3: 40,
      occupiedPercent: 20,
      freePercent: 80,
      binsWithoutVolume: 0,
    },
    {
      key: "ZONE:z1",
      kind: "ZONE",
      id: "z1",
      name: "Zone A",
      capacityM3: 800,
      occupiedM3: 380,
      freeM3: 420,
      occupiedPercent: 47.5,
      freePercent: 52.5,
      binsWithoutVolume: 2,
    },
    {
      key: "SHELF:s1",
      kind: "SHELF",
      id: "s1",
      code: "A01",
      name: "Kệ A01",
      capacityM3: 800,
      occupiedM3: 380,
      freeM3: 420,
      occupiedPercent: 47.5,
      freePercent: 52.5,
      binsWithoutVolume: 2,
    },
    {
      key: "AREA:a1",
      kind: "AREA",
      id: "a1",
      code: "RCV01",
      name: "Khu nhận hàng",
      occupiedM3: 10,
      binsWithoutVolume: 0,
    },
  ],
};

/** Kho thiếu chỗ: sắp về vượt còn trống; có bin / thùng thiếu kích thước. */
export const fullBoardJson = {
  warehouseId: "wh-hn",
  warehouseCode: "HN01",
  warehouseName: "Kho Long Biên",
  active: true,
  utilizationFactor: "1",
  binVolumeM3: "200.000",
  capacityM3: "200.000",
  occupiedM3: "190.000",
  occupiedKg: "8000.000",
  incomingM3: "30.000",
  projectedFreeM3: "-20.000",
  pendingM3: "5.000",
  freeIfAllApprovedM3: "-25.000",
  outgoingM3: "0.000",
  occupiedPercent: "95.00",
  projectedFreePercent: "-10.00",
  binsWithoutVolume: 3,
  cartonsWithoutSize: 4,
  productionCartonsWithoutSize: 6,
  groups: [],
};

export const roomyBoard: CapacityBoard = capacityBoardDto.parse(roomyBoardJson);
export const fullBoard: CapacityBoard = capacityBoardDto.parse(fullBoardJson);

/** `WarehouseResponse` của kho HCM01 — đủ trường để gửi lại `PUT /warehouses/{id}`. */
export const hcmWarehouseJson = {
  id: "wh-hcm",
  prefix: "HCM01",
  name: "Kho Thủ Đức",
  address: "Thủ Đức, TP. Hồ Chí Minh",
  mapUnit: "M",
  mapWidth: 60,
  mapHeight: 40,
  status: "ACTIVE",
  utilizationFactor: 0.85,
  version: 7,
};
