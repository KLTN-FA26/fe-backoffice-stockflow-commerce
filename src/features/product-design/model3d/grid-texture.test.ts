// Ported from stockflow-storefront components/model-check/__tests__/grid-texture.test.ts
// (kept in docs/superpowers/patches/2026-11-13-glb-do-kiem.patch). The tokens read are this repository's.
import { afterEach, describe, expect, it, vi } from "vitest";

import { cupSector } from "./cup-sector";
import { readGridColors } from "./grid-colors";
import { drawGridTexture, gridPxPerMm, GRID_CELL_MM } from "./grid-texture";
import { createSurfaces } from "./surfaces";
import { templateFromModel } from "./template-from-model";

import type { GridColors } from "./grid-texture";
import type { BagModel, CupModel, PrintAreaCode } from "./model-types";
import type { PrintSurface } from "./surface-types";

const COLORS: GridColors = {
  paper: "paper",
  minor: "minor",
  major: "major",
  number: "number",
  trim: "trim",
  safe: "safe",
  bleed: "bleed",
  top: "top",
  left: "left",
};

type Call = { name: string; args: unknown[]; strokeStyle: unknown; lineWidth: unknown };

/** A 2D context that records its calls with the stroke style and width in force at the time. */
function recordingContext() {
  const calls: Call[] = [];
  const props: Record<string, unknown> = {};
  const context = new Proxy(props, {
    get: (target, name: string) =>
      name in target
        ? target[name]
        : (...args: unknown[]) => {
            calls.push({
              name,
              args,
              strokeStyle: target.strokeStyle,
              lineWidth: target.lineWidth,
            });
          },
    set: (target, name: string, value) => {
      target[name] = value;
      return true;
    },
  });
  // A Proxy is the only way to record every canvas call; `as unknown as` is the cast it needs.
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

function paint(surface: PrintSurface, seamAtMm: number | null) {
  const { context, calls } = recordingContext();
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getContext").mockReturnValue(context as never);
  drawGridTexture(canvas, surface, {
    pxPerMm: gridPxPerMm(surface.flatBounds),
    colors: COLORS,
    seamAtMm,
  });
  return { canvas, calls };
}

type Point = [number, number];

/** The first point of each stroked path, grouped by the colour it was stroked with. */
function strokedPaths(calls: Call[]) {
  const paths: { color: unknown; width: unknown; from: Point; to: Point }[] = [];
  let points: Point[] = [];
  for (const call of calls) {
    if (call.name === "beginPath") points = [];
    else if (call.name === "moveTo" || call.name === "lineTo") points.push(call.args as Point);
    else if (call.name === "stroke") {
      const [from] = points;
      const to = points[points.length - 1];
      if (from && to) paths.push({ color: call.strokeStyle, width: call.lineWidth, from, to });
    }
  }
  return paths;
}

/** Each label with the translation and turn in force when it was filled. */
function labels(calls: Call[]) {
  const out: { text: string; at: Point; turn: number }[] = [];
  let at: Point = [0, 0];
  let turn = 0;
  for (const call of calls) {
    if (call.name === "save") {
      at = [0, 0];
      turn = 0;
    } else if (call.name === "translate") at = call.args as Point;
    else if (call.name === "rotate") turn = call.args[0] as number;
    else if (call.name === "fillText") out.push({ text: String(call.args[0]), at, turn });
  }
  return out;
}

const bag: BagModel = {
  kind: "parametric-bag",
  widthMm: 120,
  gussetMm: 60,
  heightMm: 70,
  topFoldMm: 0,
  handle: "twisted",
  material: "kraft-brown",
};

const cup: CupModel = {
  kind: "parametric-cup",
  topDiameterMm: 90,
  bottomDiameterMm: 60,
  heightMm: 110,
  rimMm: 3,
  seamMm: 8,
  bandTopOffsetMm: 6,
  bandBottomOffsetMm: 8,
  material: "paper-white",
};

/** `!` in the storefront test; a throw here. */
function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
}

const surfaceOf = (model: BagModel | CupModel, code: PrintAreaCode) =>
  defined(
    createSurfaces(templateFromModel(model, [{ printAreaCode: code }])).byCode[code],
    `${code} surface`,
  );
const frontOf = () => surfaceOf(bag, "FRONT");
const bodyOf = () => surfaceOf(cup, "BODY");
const numeric = <T extends { text: string }>(list: T[]) =>
  list.filter(({ text }) => /^\d+$/.test(text));

afterEach(() => vi.restoreAllMocks());

describe("drawGridTexture on a bag face (120 x 70 mm, bleed 3 mm)", () => {
  it("numbers the cells 1 to 6, row by row, each at the middle of its cell", () => {
    const { canvas, calls } = paint(frontOf(), null);
    expect(GRID_CELL_MM).toBe(50);
    const cells = numeric(labels(calls));
    expect(cells.map(({ text }) => text)).toEqual(["1", "2", "3", "4", "5", "6"]);
    // flat x = u + 3, flat y = v + 3; the last column is 20 mm wide and the last row 20 mm high
    expect(defined(cells[0], "cell 1").at).toEqual([3 + 25, 3 + 25]);
    expect(defined(cells[1], "cell 2").at).toEqual([3 + 75, 3 + 25]);
    expect(defined(cells[2], "cell 3").at).toEqual([3 + 110, 3 + 25]);
    expect(defined(cells[3], "cell 4").at).toEqual([3 + 25, 3 + 60]);
    const scale = gridPxPerMm(frontOf().flatBounds);
    expect(canvas.width).toBe(Math.ceil(126 * scale));
    expect(canvas.height).toBe(Math.ceil(76 * scale));
  });

  it("draws a line every 10 mm and a heavy one every 50 mm, at the right places", () => {
    const { calls } = paint(frontOf(), null);
    const paths = strokedPaths(calls);
    const vertical = (color: string) =>
      paths.filter((p) => p.color === color && p.from[0] === p.to[0]).map((p) => p.from[0]);
    const horizontal = (color: string) =>
      paths.filter((p) => p.color === color && p.from[1] === p.to[1]).map((p) => p.from[1]);
    expect(vertical("major")).toEqual([3, 53, 103]);
    expect(vertical("minor")).toEqual([13, 23, 33, 43, 63, 73, 83, 93, 113, 123]);
    expect(horizontal("major")).toEqual([3, 53]);
    expect(horizontal("minor")).toEqual([13, 23, 33, 43, 63, 73]);
    const widths = new Map(paths.map((p) => [p.color, p.width]));
    expect(widths.get("major") as number).toBeGreaterThan(widths.get("minor") as number);
  });

  it("marks the top edge and the left edge with heavy lines and their notes", () => {
    const { calls } = paint(frontOf(), null);
    const paths = strokedPaths(calls);
    const top = defined(
      paths.find((p) => p.color === "top"),
      "top edge",
    );
    const left = defined(
      paths.find((p) => p.color === "left"),
      "left edge",
    );
    // along the top of the print (y = bleed), and down its left side (x = bleed)
    expect(top.from[1]).toBe(3);
    expect(top.to[1]).toBe(3);
    expect(top.to[0]).toBeGreaterThan(top.from[0]);
    expect(left.from[0]).toBe(3);
    expect(left.to[0]).toBe(3);
    expect(left.to[1]).toBeGreaterThan(left.from[1]);
    const major = defined(
      paths.find((p) => p.color === "major"),
      "major line",
    );
    expect(top.width as number).toBeGreaterThan(major.width as number);

    const notes = labels(calls);
    expect(notes.find(({ text }) => text === "Mép trên của phần in")?.turn).toBe(0);
    // the left note runs up the edge: a quarter turn anticlockwise
    expect(notes.find(({ text }) => text === "Mép trái")?.turn).toBeCloseTo(-Math.PI / 2);
    expect(notes.map(({ text }) => text)).not.toContain("Phần dán");
  });

  it("draws every number upright: no turn on a flat face", () => {
    const { calls } = paint(frontOf(), null);
    for (const { turn } of numeric(labels(calls))) expect(turn).toBe(0);
  });
});

describe("drawGridTexture on a cup body", () => {
  it("turns each number by the direction up has on the sheet there, so it reads upright on the cup", () => {
    const surface = bodyOf();
    const sector = cupSector(cup);
    const seamAt = sector.sweepRad * sector.midRadiusMm;
    const { calls } = paint(surface, seamAt);
    const cells = numeric(labels(calls));
    // the printed part is 236.5 mm of arc (5 columns) by 97 mm (2 rows)
    expect(cells).toHaveLength(10);
    const [v0] = surface.vRange;
    const first = surface.toFlat(25, v0 + 25);
    const last = surface.toFlat(seamAt - (seamAt - 200) / 2, v0 + 25);
    const [firstCell, lastCell] = [defined(cells[0], "cell 1"), defined(cells[4], "cell 5")];
    expect(firstCell.at[0]).toBeCloseTo(first.x, 6);
    expect(firstCell.at[1]).toBeCloseTo(first.y, 6);
    expect(firstCell.turn).toBeCloseTo(first.uprightRad, 9);
    expect(lastCell.turn).toBeCloseTo(last.uprightRad, 9);
    // left of the front the sheet leans one way, right of it the other: not mirrored, not flipped
    expect(firstCell.turn).toBeLessThan(0);
    expect(lastCell.turn).toBeGreaterThan(0);
    expect(Math.abs(firstCell.turn)).toBeLessThan(sector.sweepRad / 2);
  });

  it("marks the seam at the left edge and the glue flap past the printed width", () => {
    const surface = bodyOf();
    const sector = cupSector(cup);
    const { calls } = paint(surface, sector.sweepRad * sector.midRadiusMm);
    const texts = labels(calls).map(({ text }) => text);
    expect(texts).toContain("Mép trái / đường nối");
    expect(texts).toContain("Phần dán");
    expect(texts).toContain("Mép trên của phần in");
  });
});

describe("drawGridTexture without a 2D context", () => {
  it("paints nothing and does not throw", () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    expect(() =>
      drawGridTexture(canvas, frontOf(), { pxPerMm: 4, colors: COLORS, seamAtMm: null }),
    ).not.toThrow();
  });
});

describe("readGridColors", () => {
  it("reads the theme tokens, and gives empty strings where nothing is styled", () => {
    expect(readGridColors().trim).toBe("");
    document.documentElement.style.setProperty("--accent", "#123456");
    document.documentElement.style.setProperty("--danger", "#654321");
    try {
      const colors = readGridColors();
      expect(colors.trim).toBe("#123456");
      expect(colors.top).toBe("#123456");
      expect(colors.bleed).toBe("#654321");
    } finally {
      document.documentElement.style.removeProperty("--accent");
      document.documentElement.style.removeProperty("--danger");
    }
  });
});
