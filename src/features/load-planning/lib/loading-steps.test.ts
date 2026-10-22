import { describe, expect, it } from "vitest";

import { gridBlock, makeLayout } from "../__fixtures__/build";
import { LAYOUT_40HC, LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";

import { buildLoadingSteps } from "./loading-steps";

import type { CartonType } from "../__fixtures__/build";

const CARTON: CartonType = {
  ref: "R",
  label: "SKU",
  partName: "Hàng",
  origMm: { l: 600, w: 400, h: 400 },
  weightKg: 5,
};
const INNER = { l: 6000, w: 2400, h: 2600 };

/** "seq part ×count @ z/y/x (mm)" — gọn để so thứ tự bước. */
const project = (steps: ReturnType<typeof buildLoadingSteps>) =>
  steps.map((s) => `${s.seq}. ${s.partName} ×${s.count} @ z${s.zMm} y${s.yMm} x${s.xMm}`);

describe("buildLoadingSteps", () => {
  it("40HC: one block per item, back (z) → bottom (y) → left (x), shelf before the fittings on top of it", () => {
    expect(project(buildLoadingSteps([LAYOUT_40HC]))).toMatchInlineSnapshot(`
      [
        "1. Thùng sofa ×120 @ z0 y0 x0",
        "2. Ghế ăn ×96 @ z2400 y0 x0",
        "3. Bàn trà ×40 @ z4800 y0 x0",
        "4. Kệ sách ×14 @ z7800 y0 x0",
        "5. Phụ kiện ×168 @ z7800 y1800 x0",
      ]
    `);
  });

  it("pickup kit: tops and legs both start at the front wall, the legs sit to the right (x), stools last", () => {
    expect(project(buildLoadingSteps([LAYOUT_PICKUP_KIT]))).toEqual([
      "1. Mặt bàn ×4 @ z0 y0 x0",
      "2. Chân bàn ×16 @ z0 y0 x800",
      "3. Ghế bar ×3 @ z1200 y0 x0",
    ]);
  });

  it("every box lands in exactly one step", () => {
    const steps = buildLoadingSteps([LAYOUT_40HC]);
    expect(steps.reduce((n, s) => n + s.boxes.length, 0)).toBe(LAYOUT_40HC.boxes.length);
    expect(new Set(steps.flatMap((s) => s.boxes)).size).toBe(LAYOUT_40HC.boxes.length);
  });

  it("numbers steps continuously across vehicles and keeps each vehicle's own order", () => {
    const steps = buildLoadingSteps([
      LAYOUT_PICKUP_KIT,
      { ...LAYOUT_PICKUP_KIT, seq: 2, code: "PICKUP-1T-B" },
    ]);
    expect(steps.map((s) => s.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(steps.map((s) => s.vehicleSeq)).toEqual([1, 1, 1, 2, 2, 2]);
    expect(steps[3].vehicleCode).toBe("PICKUP-1T-B");
  });

  it("returns the block bounding box in mm", () => {
    const [sofa] = buildLoadingSteps([LAYOUT_40HC]);
    expect(sofa).toMatchObject({ xMm: 0, yMm: 0, zMm: 0, wMm: 2000, hMm: 2400, dMm: 2400 });
  });

  it("loads a supporting block first even when the block on top starts closer to the front", () => {
    const boxes = [
      // đỡ: nằm sàn, bắt đầu ở z=500
      ...gridBlock({
        carton: { ...CARTON, ref: "LOW", partName: "Đỡ" },
        origin: { xMm: 0, yMm: 0, zMm: 500 },
        counts: { nx: 1, ny: 1, nz: 2 },
      }),
      // trên: tựa lên khối đỡ nhưng z0=0 nhỏ hơn
      ...gridBlock({
        carton: { ...CARTON, ref: "UP", partName: "Trên", origMm: { l: 1000, w: 400, h: 400 } },
        origin: { xMm: 0, yMm: 400, zMm: 0 },
        counts: { nx: 1, ny: 1, nz: 1 },
      }),
    ];
    const steps = buildLoadingSteps([
      makeLayout({ seq: 1, code: "X", innerMm: INNER, maxPayloadKg: 1000, boxes }),
    ]);
    expect(steps.map((s) => s.partName)).toEqual(["Đỡ", "Trên"]);
  });

  it("keeps a rotated placement of the same carton in one block", () => {
    const boxes = [
      ...gridBlock({
        carton: CARTON,
        origin: { xMm: 0, yMm: 0, zMm: 0 },
        counts: { nx: 1, ny: 1, nz: 1 },
      }),
      ...gridBlock({
        carton: CARTON,
        orientation: "WLH",
        origin: { xMm: 400, yMm: 0, zMm: 0 },
        counts: { nx: 1, ny: 1, nz: 1 },
      }),
    ];
    const steps = buildLoadingSteps([
      makeLayout({ seq: 1, code: "X", innerMm: INNER, maxPayloadKg: 1000, boxes }),
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0].count).toBe(2);
  });

  it("splits the same code in two nominal sizes into two blocks", () => {
    const big = { ...CARTON, origMm: { l: 800, w: 400, h: 400 } };
    const boxes = [
      ...gridBlock({
        carton: CARTON,
        origin: { xMm: 0, yMm: 0, zMm: 0 },
        counts: { nx: 1, ny: 1, nz: 1 },
      }),
      ...gridBlock({
        carton: big,
        origin: { xMm: 400, yMm: 0, zMm: 0 },
        counts: { nx: 1, ny: 1, nz: 1 },
      }),
    ];
    const steps = buildLoadingSteps([
      makeLayout({ seq: 1, code: "X", innerMm: INNER, maxPayloadKg: 1000, boxes }),
    ]);
    expect(steps).toHaveLength(2);
  });

  it("splits same-item boxes that do not touch into separate blocks", () => {
    const boxes = [
      ...gridBlock({
        carton: CARTON,
        origin: { xMm: 0, yMm: 0, zMm: 0 },
        counts: { nx: 1, ny: 1, nz: 1 },
      }),
      ...gridBlock({
        carton: CARTON,
        origin: { xMm: 1000, yMm: 0, zMm: 0 },
        counts: { nx: 1, ny: 1, nz: 1 },
      }),
    ];
    const steps = buildLoadingSteps([
      makeLayout({ seq: 1, code: "X", innerMm: INNER, maxPayloadKg: 1000, boxes }),
    ]);
    expect(steps.map((s) => s.xMm)).toEqual([0, 1000]);
  });

  it("returns no steps for an empty vehicle", () => {
    expect(
      buildLoadingSteps([
        makeLayout({ seq: 1, code: "X", innerMm: INNER, maxPayloadKg: 1, boxes: [] }),
      ]),
    ).toEqual([]);
    expect(buildLoadingSteps([])).toEqual([]);
  });

  it("orders a vertical stack bottom-up whatever the order of the input array", () => {
    const at = (partName: string, yMm: number) =>
      gridBlock({
        carton: { ...CARTON, ref: partName, partName },
        origin: { xMm: 0, yMm, zMm: 0 },
        counts: { nx: 1, ny: 1, nz: 1 },
      });
    const boxes = [...at("B", 800), ...at("A", 400), ...at("C", 0)];
    const steps = buildLoadingSteps([
      makeLayout({ seq: 1, code: "X", innerMm: INNER, maxPayloadKg: 1000, boxes }),
    ]);
    expect(steps.map((s) => s.partName)).toEqual(["C", "A", "B"]);
  });

  it("does not hang on a circular support graph (corrupt data) and still lists every block", () => {
    // Hai tấm mỏng chồng lên nhau trong dung sai: mỗi tấm "tựa" tấm kia. Không thể xảy ra thật,
    // nhưng dữ liệu hỏng phải xử lý xong chứ không lặp vô hạn.
    const slab = (partName: string) =>
      gridBlock({
        carton: { ...CARTON, ref: partName, partName, origMm: { l: 100, w: 100, h: 1 } },
        origin: { xMm: 0, yMm: 10, zMm: 0 },
        counts: { nx: 1, ny: 1, nz: 1 },
      });
    const boxes = [...slab("P"), ...slab("Q")];
    const steps = buildLoadingSteps([
      makeLayout({ seq: 1, code: "X", innerMm: INNER, maxPayloadKg: 1000, boxes }),
    ]);
    expect(steps.map((s) => s.partName).sort()).toEqual(["P", "Q"]);
  });
});
