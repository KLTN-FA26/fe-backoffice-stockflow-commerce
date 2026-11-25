/**
 * Fixture thực tế cho test: một xe 40HC chở hỗn hợp thùng và một xe bán tải chở bộ khay ly (khay + ống ly).
 * Mặt hàng theo dải của docs README (ly, bao bì mang đi); kệ trưng bày / standee là vật phẩm quảng cáo (POSM) giao kèm đơn
 * — giữ kích thước cũ (kệ cao không xoay, standee 1,9 m) vì hình học xếp xe và các test số dựa trên đúng các kích thước đó.
 * Mọi kiện đã được kiểm chứng hợp lệ hình học bởi `checkLayout` (xem `lib/layout-check.test.ts`).
 */

import { gridBlock, makeLayout } from "./build";

import type { CartonType } from "./build";
import type { KitDef } from "../lib/kit-balance";
import type { UnplacedLine } from "../types";

/** Hai khối gia cố góc trên, sát vách đầu xe, cạnh 150mm (mặc định mọi loại trừ 45'; design §1). */
const GUSSET_MM = 150;

const CUP_PP: CartonType = {
  ref: "LINE-001",
  label: "LP-A",
  partName: "Thùng ly nhựa PP",
  origMm: { l: 600, w: 400, h: 400 },
  weightKg: 9.5,
};
const CUP_PAPER: CartonType = {
  ref: "LINE-002",
  label: "LG-B",
  partName: "Thùng ly giấy",
  origMm: { l: 800, w: 500, h: 300 },
  weightKg: 6.2,
};
const PAPER_BAG: CartonType = {
  ref: "LINE-003",
  label: "TG-C",
  partName: "Thùng túi giấy",
  origMm: { l: 1000, w: 600, h: 500 },
  weightKg: 14,
};
const DISPLAY_RACK: CartonType = {
  ref: "LINE-004",
  label: "KT-D",
  partName: "Kệ trưng bày ly",
  origMm: { l: 1200, w: 300, h: 1800 },
  weightKg: 22,
  // Kệ cao không được xoay nằm/dựng ngược (BR-10: cờ cho phép xoay).
  rotatable: false,
};
const CUP_LID: CartonType = {
  ref: "LINE-005",
  label: "NL-E",
  partName: "Thùng nắp ly",
  origMm: { l: 400, w: 300, h: 200 },
  weightKg: 3,
};

/** 40HC (lòng 12.032 × 2.352 × 2.698 mm): 438 kiện, 5 mặt hàng, Thùng túi giấy xoay ngang (WLH). */
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
      carton: CUP_PP,
      origin: { xMm: 0, yMm: 0, zMm: 0 },
      counts: { nx: 5, ny: 6, nz: 4 },
    }),
    ...gridBlock({
      carton: CUP_PAPER,
      origin: { xMm: 0, yMm: 0, zMm: 2400 },
      counts: { nx: 4, ny: 8, nz: 3 },
    }),
    ...gridBlock({
      carton: PAPER_BAG,
      orientation: "WLH",
      origin: { xMm: 0, yMm: 0, zMm: 4800 },
      counts: { nx: 2, ny: 4, nz: 5 },
    }),
    ...gridBlock({
      carton: DISPLAY_RACK,
      origin: { xMm: 0, yMm: 0, zMm: 7800 },
      counts: { nx: 7, ny: 1, nz: 2 },
    }),
    ...gridBlock({
      carton: CUP_LID,
      origin: { xMm: 0, yMm: 1800, zMm: 7800 },
      counts: { nx: 7, ny: 4, nz: 6 },
    }),
  ],
});

/** Hàng solver không xếp được ở lần giải đó (cho bảng và đối chiếu số kiện). */
export const UNPLACED_40HC: UnplacedLine[] = [
  { label: PAPER_BAG.label, partName: PAPER_BAG.partName, origMm: PAPER_BAG.origMm, quantity: 12 },
  {
    label: "SD-F",
    partName: "Standee quảng cáo",
    origMm: { l: 900, w: 450, h: 1900 },
    quantity: 3,
  },
];

const KIT_GROUP = "KIT-KHAY-01";
const TRAY: CartonType = {
  ref: "PKG-101",
  source: "package",
  label: "KHAY-A",
  partName: "Khay giấy",
  kitGroup: KIT_GROUP,
  origMm: { l: 1200, w: 800, h: 50 },
  weightKg: 18,
};
const CUP_SLEEVE: CartonType = {
  ref: "PKG-102",
  source: "package",
  label: "KHAY-B",
  partName: "Ống ly giấy",
  kitGroup: KIT_GROUP,
  origMm: { l: 700, w: 120, h: 120 },
  weightKg: 2.5,
};
const STRAW_BOX: CartonType = {
  ref: "PKG-103",
  source: "package",
  label: "OH-01",
  partName: "Thùng ống hút",
  origMm: { l: 500, w: 500, h: 400 },
  weightKg: 7,
};

/** Bộ khay ly: 1 thùng khay (A) + 4 ống ly (B) mỗi bộ — phải đi cùng một xe như mọi bộ kiện (design §1 "Kits"). */
export const KIT_KHAY: KitDef = {
  group: KIT_GROUP,
  parts: [
    { partName: TRAY.partName, perSet: 1 },
    { partName: CUP_SLEEVE.partName, perSet: 4 },
  ],
};

/** Xe bán tải (lòng 1.800 × 1.500 × 500 mm, tải 1.000 kg): 4 bộ khay ly (khay + ống ly) + 3 thùng ống hút. */
export const LAYOUT_PICKUP_KIT = makeLayout({
  seq: 1,
  code: "PICKUP-1T",
  innerMm: { l: 1800, w: 1500, h: 500 },
  maxPayloadKg: 1000,
  boxes: [
    ...gridBlock({
      carton: TRAY,
      origin: { xMm: 0, yMm: 0, zMm: 0 },
      counts: { nx: 1, ny: 4, nz: 1 },
    }),
    ...gridBlock({
      carton: CUP_SLEEVE,
      origin: { xMm: 800, yMm: 0, zMm: 0 },
      counts: { nx: 4, ny: 4, nz: 1 },
    }),
    ...gridBlock({
      carton: STRAW_BOX,
      origin: { xMm: 0, yMm: 0, zMm: 1200 },
      counts: { nx: 3, ny: 1, nz: 1 },
    }),
  ],
});
