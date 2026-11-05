/**
 * Fixture nhỏ, đoán được bằng mắt cho test trình soạn xếp tay: hai xe lòng 1000 (rộng) × 1000 (cao) × 2000 (dài),
 * tải 100 kg, và một kiện ở khay. Số liệu chọn cho tròn: thùng BOX = dài 400 × rộng 500 × cao 300, hai thùng nằm kề
 * nhau theo x ở sàn xe 1; kiện FLAT (không xoay) nằm ở xe 2; kiện TRAY ở khay.
 */

import { gridBlock, makeLayout } from "./build";

import type { CartonType } from "./build";
import type { EditorState, EditVehicle } from "../editor/types";
import type { Layout } from "../types";

export const BOX: CartonType = {
  ref: "BOX",
  source: "package",
  label: "PKG-BOX",
  partName: "Thùng BOX",
  origMm: { l: 400, w: 500, h: 300 },
  weightKg: 10,
};
export const FLAT: CartonType = {
  ref: "FLAT",
  source: "package",
  label: "PKG-FLAT",
  partName: "Thùng FLAT",
  origMm: { l: 600, w: 300, h: 300 },
  weightKg: 5,
  rotatable: false,
};
export const KIT_PART_1: CartonType = {
  ref: "KIT1",
  source: "package",
  label: "PKG-K1",
  partName: "Bàn 1/2",
  kitGroup: "kit-A",
  origMm: { l: 400, w: 400, h: 200 },
  weightKg: 4,
};
export const KIT_PART_2: CartonType = {
  ...KIT_PART_1,
  ref: "KIT2",
  label: "PKG-K2",
  partName: "Bàn 2/2",
};

const INNER = { l: 2000, w: 1000, h: 1000 };

export const layoutOne: Layout = makeLayout({
  seq: 1,
  code: "TRUCK-A",
  innerMm: INNER,
  maxPayloadKg: 100,
  boxes: gridBlock({
    carton: BOX,
    origin: { xMm: 0, yMm: 0, zMm: 0 },
    counts: { nx: 2, ny: 1, nz: 1 },
  }),
});

export const layoutTwo: Layout = makeLayout({
  seq: 2,
  code: "TRUCK-A",
  innerMm: INNER,
  maxPayloadKg: 100,
  boxes: gridBlock({
    carton: FLAT,
    origin: { xMm: 0, yMm: 0, zMm: 0 },
    counts: { nx: 1, ny: 1, nz: 1 },
  }),
});

export const TRAY_PARCEL = {
  ref: "TRAY-1",
  sourceRef: null,
  label: "PKG-T1",
  partName: "Thùng BOX",
  kitGroup: null,
  origMm: { l: 400, w: 500, h: 300 },
  rotatable: true,
  weightKg: 10,
} as const;

export const vehicleOf = (layout: Layout): EditVehicle => ({
  seq: layout.seq,
  code: layout.code,
  vehicleTypeId: "type-A",
  innerMm: layout.innerMm,
  maxPayloadKg: layout.maxPayloadKg,
  gussets: layout.gussets,
  door: null,
  boxes: layout.boxes,
});

export function editorState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    vehicles: [vehicleOf(layoutOne), vehicleOf(layoutTwo)],
    tray: [TRAY_PARCEL],
    ...overrides,
  };
}
