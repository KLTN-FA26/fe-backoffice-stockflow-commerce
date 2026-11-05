/**
 * Bố cục kiểu BE thật (kiểm chứng trực tiếp trên BE PR #161): `label` của mỗi hộp là mã nhãn của TỪNG kiện nên duy nhất
 * (`PKG-SO-…-S1-n`), còn `partName` là SKU. Các fixture khác dùng chung một `label` cho mỗi loại thùng (mã ngắn trên mặt
 * thùng) — bản đó giấu lỗi gom khối theo `label`: 8 kiện ra 8 bước, mỗi bước một trang in.
 */

import { gridBlock, makeLayout } from "./build";

import type { CartonType } from "./build";

const TABLE_BOX: CartonType = {
  ref: "pkg-table",
  source: "package",
  label: "",
  partName: "SKU-TABLE-01",
  origMm: { l: 800, w: 500, h: 300 },
  weightKg: 12,
};
const CHAIR_BOX: CartonType = {
  ref: "pkg-chair",
  source: "package",
  label: "",
  partName: "SKU-CHAIR-02",
  origMm: { l: 600, w: 400, h: 400 },
  weightKg: 7,
};

/** Xe bán tải: 6 thùng bàn (3 × 2 tầng) + 2 thùng ghế, MỖI kiện một nhãn riêng → đúng 2 khối / 2 bước. */
export const LAYOUT_UNIQUE_LABELS = (() => {
  const boxes = [
    ...gridBlock({
      carton: TABLE_BOX,
      origin: { xMm: 0, yMm: 0, zMm: 0 },
      counts: { nx: 3, ny: 2, nz: 1 },
    }),
    ...gridBlock({
      carton: CHAIR_BOX,
      origin: { xMm: 0, yMm: 0, zMm: 800 },
      counts: { nx: 2, ny: 1, nz: 1 },
    }),
  ].map((box, index) => ({ ...box, label: `PKG-SO-20261004-000001-S1-${index + 1}` }));
  return makeLayout({
    seq: 1,
    code: "PICKUP-1T",
    innerMm: { l: 1800, w: 1500, h: 800 },
    maxPayloadKg: 1000,
    boxes,
  });
})();
