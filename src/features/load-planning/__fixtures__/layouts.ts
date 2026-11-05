/**
 * Fixture thực tế cho test: một xe 40HC chở hỗn hợp thùng và một xe bán tải chở bộ bàn A+B.
 * Mọi kiện đã được kiểm chứng hợp lệ hình học bởi `checkLayout` (xem `lib/layout-check.test.ts`).
 */

import { gridBlock, makeLayout } from "./build";

import type { CartonType } from "./build";
import type { KitDef } from "../lib/kit-balance";
import type { UnplacedLine } from "../types";

/** Hai khối gia cố góc trên, sát vách đầu xe, cạnh 150mm (mặc định mọi loại trừ 45'; design §1). */
const GUSSET_MM = 150;

const SOFA: CartonType = {
  ref: "LINE-001",
  label: "SF-A",
  partName: "Thùng sofa",
  origMm: { l: 600, w: 400, h: 400 },
  weightKg: 9.5,
};
const CHAIR: CartonType = {
  ref: "LINE-002",
  label: "GA-B",
  partName: "Ghế ăn",
  origMm: { l: 800, w: 500, h: 300 },
  weightKg: 6.2,
};
const TABLE: CartonType = {
  ref: "LINE-003",
  label: "BT-C",
  partName: "Bàn trà",
  origMm: { l: 1000, w: 600, h: 500 },
  weightKg: 14,
};
const SHELF: CartonType = {
  ref: "LINE-004",
  label: "KS-D",
  partName: "Kệ sách",
  origMm: { l: 1200, w: 300, h: 1800 },
  weightKg: 22,
  // Kệ cao không được xoay nằm/dựng ngược (BR-10: cờ cho phép xoay).
  rotatable: false,
};
const FITTING: CartonType = {
  ref: "LINE-005",
  label: "PK-E",
  partName: "Phụ kiện",
  origMm: { l: 400, w: 300, h: 200 },
  weightKg: 3,
};

/** 40HC (lòng 12.032 × 2.352 × 2.698 mm): 438 kiện, 5 mặt hàng, Bàn trà xoay ngang (WLH). */
export const LAYOUT_40HC = makeLayout({
  seq: 1,
  code: "40HC",
  innerMm: { l: 12032, w: 2352, h: 2698 },
  maxPayloadKg: 26380,
  gussets: [0, 2352 - GUSSET_MM].map((xMm) => ({
    xMm,
    yMm: 2698 - GUSSET_MM,
    zMm: 0,
    wMm: GUSSET_MM,
    hMm: GUSSET_MM,
    dMm: GUSSET_MM,
  })),
  boxes: [
    ...gridBlock({
      carton: SOFA,
      origin: { xMm: 0, yMm: 0, zMm: 0 },
      counts: { nx: 5, ny: 6, nz: 4 },
    }),
    ...gridBlock({
      carton: CHAIR,
      origin: { xMm: 0, yMm: 0, zMm: 2400 },
      counts: { nx: 4, ny: 8, nz: 3 },
    }),
    ...gridBlock({
      carton: TABLE,
      orientation: "WLH",
      origin: { xMm: 0, yMm: 0, zMm: 4800 },
      counts: { nx: 2, ny: 4, nz: 5 },
    }),
    ...gridBlock({
      carton: SHELF,
      origin: { xMm: 0, yMm: 0, zMm: 7800 },
      counts: { nx: 7, ny: 1, nz: 2 },
    }),
    ...gridBlock({
      carton: FITTING,
      origin: { xMm: 0, yMm: 1800, zMm: 7800 },
      counts: { nx: 7, ny: 4, nz: 6 },
    }),
  ],
});

/** Hàng solver không xếp được ở lần giải đó (cho bảng và đối chiếu số kiện). */
export const UNPLACED_40HC: UnplacedLine[] = [
  { label: TABLE.label, partName: TABLE.partName, origMm: TABLE.origMm, quantity: 12 },
  { label: "TV-F", partName: "Tủ vải", origMm: { l: 900, w: 450, h: 1900 }, quantity: 3 },
];

const KIT_GROUP = "KIT-BAN-01";
const TABLE_TOP: CartonType = {
  ref: "PKG-101",
  source: "package",
  label: "BAN-MB",
  partName: "Mặt bàn",
  kitGroup: KIT_GROUP,
  origMm: { l: 1200, w: 800, h: 50 },
  weightKg: 18,
};
const TABLE_LEG: CartonType = {
  ref: "PKG-102",
  source: "package",
  label: "BAN-CB",
  partName: "Chân bàn",
  kitGroup: KIT_GROUP,
  origMm: { l: 700, w: 120, h: 120 },
  weightKg: 2.5,
};
const STOOL: CartonType = {
  ref: "PKG-103",
  source: "package",
  label: "GB-01",
  partName: "Ghế bar",
  origMm: { l: 500, w: 500, h: 400 },
  weightKg: 7,
};

/** Bộ bàn: 1 mặt (A) + 4 chân (B) mỗi bộ. */
export const KIT_BAN: KitDef = {
  group: KIT_GROUP,
  parts: [
    { partName: TABLE_TOP.partName, perSet: 1 },
    { partName: TABLE_LEG.partName, perSet: 4 },
  ],
};

/** Xe bán tải (lòng 1.800 × 1.500 × 500 mm, tải 1.000 kg): 4 bộ bàn A+B + 3 ghế bar. */
export const LAYOUT_PICKUP_KIT = makeLayout({
  seq: 1,
  code: "PICKUP-1T",
  innerMm: { l: 1800, w: 1500, h: 500 },
  maxPayloadKg: 1000,
  boxes: [
    ...gridBlock({
      carton: TABLE_TOP,
      origin: { xMm: 0, yMm: 0, zMm: 0 },
      counts: { nx: 1, ny: 4, nz: 1 },
    }),
    ...gridBlock({
      carton: TABLE_LEG,
      origin: { xMm: 800, yMm: 0, zMm: 0 },
      counts: { nx: 4, ny: 4, nz: 1 },
    }),
    ...gridBlock({
      carton: STOOL,
      origin: { xMm: 0, yMm: 0, zMm: 1200 },
      counts: { nx: 3, ny: 1, nz: 1 },
    }),
  ],
});
