import { describe, expect, it } from "vitest";

import {
  boxFromDrag,
  footprintFromBox,
  lineFromDrag,
  movedFootprint,
  nudgedFootprint,
  rotatedFootprint,
  snap,
} from "./draft-geometry";

const FRAME = { mapWidth: 60, mapHeight: 40 };

describe("hình học chế độ sửa", () => {
  it("bám lưới 0,5 m và làm tròn tới milimét", () => {
    expect(snap(3.26)).toBe(3.5);
    expect(snap(3.24)).toBe(3);
    expect(snap(1.2345, 0.001)).toBe(1.235);
  });

  it("kéo theo hướng nào cũng ra hộp góc trên-trái; kẹp trong khung; quá nhỏ coi như bấm nhầm", () => {
    expect(boxFromDrag({ x: 10, y: 8 }, { x: 4.1, y: 5.9 }, FRAME)).toEqual({
      x: 4,
      y: 6,
      w: 6,
      h: 2,
    });
    expect(boxFromDrag({ x: 55, y: 35 }, { x: 70, y: 50 }, FRAME)).toEqual({
      x: 55,
      y: 35,
      w: 5,
      h: 5,
    });
    expect(boxFromDrag({ x: 1, y: 1 }, { x: 1.2, y: 6 }, FRAME)).toBeNull();
  });

  it("giữ Shift khi vẽ tường → ép nằm ngang / dọc", () => {
    expect(lineFromDrag({ x: 0, y: 0 }, { x: 10, y: 1 }, FRAME, true)).toEqual({
      startX: 0,
      startY: 0,
      endX: 10,
      endY: 0,
    });
    expect(lineFromDrag({ x: 0, y: 0 }, { x: 0.2, y: 0.2 }, FRAME, false)).toBeNull();
  });

  it("BR-09: hộp → footprint đổi chỗ hai cạnh khi xoay 90 / 270", () => {
    expect(footprintFromBox({ x: 1, y: 2, w: 1.2, h: 10 }, 90)).toEqual({
      x: 1,
      y: 2,
      width: 10,
      length: 1.2,
      rotation: 90,
    });
    expect(rotatedFootprint({ x: 1, y: 2, width: 10, length: 1.2, rotation: 270 }).rotation).toBe(
      0,
    );
  });

  it("BR-06: kéo / dời bằng phím không đưa hình ra khỏi khung", () => {
    const footprint = { x: 50, y: 30, width: 10, length: 1.2, rotation: 0 };
    expect(movedFootprint(footprint, { x: 58, y: 45 }, FRAME)).toMatchObject({ x: 50, y: 38.8 });
    expect(nudgedFootprint(footprint, 0.1, 0, FRAME).x).toBe(50);
    expect(nudgedFootprint(footprint, -0.1, 0, FRAME).x).toBe(49.9);
  });
});
