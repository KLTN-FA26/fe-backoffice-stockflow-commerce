import { describe, expect, it } from "vitest";

import { LOAD_PLANNING_LIMITS, VIEW_KINDS, VIEWER_PALETTE } from "@/constants";

import { gridBlock, makeLayout } from "../__fixtures__/build";
import { LAYOUT_40HC, LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";

import { buildColorMap } from "./palette";
import {
  blockToScene,
  faceCode,
  hoverLabel,
  prepareScene,
  sceneScale,
  truncateLabel,
} from "./scene";
import { cameraPosition } from "./view-presets";

describe("prepareScene", () => {
  const scene = prepareScene(LAYOUT_40HC);

  it("scales the longest side (the 12 m length) to 10 world units", () => {
    expect(scene.depth).toBeCloseTo(10, 6);
    expect(scene.width).toBeCloseTo((2352 * 10) / 12032, 6);
    expect(scene.height).toBeCloseTo((2698 * 10) / 12032, 6);
    expect(scene.cameraDistance).toBeCloseTo(13.5, 6);
  });

  it("centres the scene on the vehicle: x/y/z are offsets from the middle of the load space", () => {
    // Kiện đầu: x 0..400, y 0..400, z 0..600 → tâm (200, 200, 300) so với tâm xe (1176, 1349, 6016)
    const [x, y, z] = scene.boxes[0].position;
    expect(x).toBeCloseTo(((200 - 1176) * 10) / 12032, 6);
    expect(y).toBeCloseTo(((200 - 1349) * 10) / 12032, 6);
    expect(z).toBeCloseTo(((300 - 6016) * 10) / 12032, 6);
  });

  it("puts the door end at positive z: later boxes sit at larger z than the first", () => {
    const last = scene.boxes[scene.boxes.length - 1];
    expect(last.position[2]).toBeGreaterThan(scene.boxes[0].position[2]);
  });

  it("builds one scene box per layout box, with the boxes' sizes scaled", () => {
    expect(scene.boxes).toHaveLength(LAYOUT_40HC.boxes.length);
    expect(scene.boxes[0].size[0]).toBeCloseTo((400 * 10) / 12032, 6);
    expect(scene.boxes[0].size[2]).toBeCloseTo((600 * 10) / 12032, 6);
  });

  it("gives every scene box a unique id even when many boxes share one ref", () => {
    expect(new Set(scene.boxes.map((b) => b.id)).size).toBe(scene.boxes.length);
  });

  it("carries the two gusset blocks of the 40HC", () => {
    expect(scene.gussets).toHaveLength(2);
    expect(scene.gussets[0].size[1]).toBeCloseTo((150 * 10) / 12032, 6);
  });

  it("colours by part with the caller's map when given, else by its own sorted map", () => {
    expect(scene.boxes[0].color).toBe(
      buildColorMap(LAYOUT_40HC.boxes.map((b) => b.partName)).get("Thùng sofa"),
    );
    const forced = prepareScene(LAYOUT_PICKUP_KIT, new Map([["Mặt bàn", "#123456"]]));
    expect(forced.boxes[0].color).toBe("#123456");
    // tên không có trong map của người gọi → ô đầu của bảng màu, không ném lỗi
    expect(forced.boxes.at(-1)?.color).toBe(VIEWER_PALETTE[0]);
  });

  it("is deterministic", () => {
    expect(prepareScene(LAYOUT_40HC)).toEqual(scene);
  });

  it("reports no truncation for a normal load", () => {
    expect(scene.truncated).toBeNull();
  });

  it("caps the drawn boxes and says how many were dropped", () => {
    const max = LOAD_PLANNING_LIMITS.renderBoxesMax;
    const carton = LAYOUT_PICKUP_KIT.boxes[0];
    const boxes = gridBlock({
      carton: { ref: "R", label: "L", partName: "P", origMm: carton.origMm, weightKg: 1 },
      origin: { xMm: 0, yMm: 0, zMm: 0 },
      counts: { nx: 1, ny: 1, nz: max + 5 },
    });
    const big = prepareScene(
      makeLayout({
        seq: 1,
        code: "X",
        innerMm: { l: 400000, w: 2000, h: 2000 },
        maxPayloadKg: 1,
        boxes,
      }),
    );
    expect(big.boxes).toHaveLength(max);
    expect(big.truncated).toEqual({ shown: max, total: max + 5 });
  });
});

describe("blockToScene", () => {
  const extent = { wMm: 1000, hMm: 1000, dMm: 1000 };

  it("places a block at the container's min corner at (-half) + its own half size", () => {
    const { position, size } = blockToScene(
      { xMm: 0, yMm: 0, zMm: 0, wMm: 100, hMm: 100, dMm: 100 },
      extent,
      0.01,
    );
    expect(position).toEqual([-4.5, -4.5, -4.5]);
    expect(size).toEqual([1, 1, 1]);
  });

  it("shrinks the size, not the position, so neighbours keep a visible seam", () => {
    const { position, size } = blockToScene(
      { xMm: 0, yMm: 0, zMm: 0, wMm: 100, hMm: 100, dMm: 100 },
      extent,
      0.01,
      0.9,
    );
    expect(position).toEqual([-4.5, -4.5, -4.5]);
    expect(size[0]).toBeCloseTo(0.9, 9);
  });

  it("never returns a zero-size mesh", () => {
    expect(
      blockToScene({ xMm: 0, yMm: 0, zMm: 0, wMm: 1, hMm: 1, dMm: 1 }, extent, 0.0001).size,
    ).toEqual([0.01, 0.01, 0.01]);
  });
});

describe("sceneScale", () => {
  it("falls back to 1 for a degenerate extent", () => {
    expect(sceneScale({ wMm: 0, hMm: 0, dMm: 0 })).toBe(1);
  });
});

describe("labels", () => {
  it("hover label shows the AS-PLACED size in D×R×C", () => {
    expect(hoverLabel(LAYOUT_40HC.boxes[0])).toBe("Thùng sofa · 600×400×400mm");
    // Bàn trà xoay WLH: dài(z)=600, rộng(x)=1000, cao=500
    const rotated = LAYOUT_40HC.boxes.find((b) => b.partName === "Bàn trà");
    expect(rotated && hoverLabel(rotated)).toBe("Bàn trà · 600×1000×500mm");
  });

  it("falls back to the face code and then to the unnamed label", () => {
    const base = LAYOUT_40HC.boxes[0];
    expect(hoverLabel({ ...base, partName: "" })).toBe("SF-A · 600×400×400mm");
    expect(hoverLabel({ ...base, partName: "", label: "" })).toBe("(chưa đặt tên) · 600×400×400mm");
  });

  it("truncates long face codes to 14 characters with an ellipsis", () => {
    expect(truncateLabel("ABCDEFGHIJKLMN")).toBe("ABCDEFGHIJKLMN");
    expect(truncateLabel("ABCDEFGHIJKLMNO")).toBe("ABCDEFGHIJKLM…");
    expect(faceCode({ ...LAYOUT_40HC.boxes[0], label: "  SF-A  " })).toBe("SF-A");
  });
});

describe("cameraPosition", () => {
  const dist = 13.5;
  const h = 2;

  it("looks into the vehicle from the door end (positive z) for the end view", () => {
    const [x, y, z] = cameraPosition("end", dist, h);
    expect(x).toBe(0);
    expect(z).toBeGreaterThan(0);
    expect(y).toBeCloseTo(h * 0.6, 9);
  });

  it("top is almost straight above but never exactly on the axis (avoids gimbal flip)", () => {
    const [x, y, z] = cameraPosition("top", dist, h);
    expect(x).toBe(0);
    expect(y).toBeGreaterThan(dist);
    expect(z).not.toBe(0);
    expect(Math.abs(z)).toBeLessThan(0.001);
  });

  it("side views the long side along x", () => {
    const [x, , z] = cameraPosition("side", dist, h);
    expect(x).toBeGreaterThan(dist);
    expect(z).toBe(0);
  });

  it("iso is a diagonal from above", () => {
    expect(cameraPosition("iso", dist, h)).toEqual([dist, dist * 0.75, dist]);
  });

  it("has a position for every view kind", () => {
    for (const kind of VIEW_KINDS) expect(cameraPosition(kind, dist, h)).toHaveLength(3);
  });
});
