// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { BufferAttribute, BufferGeometry, Group, Mesh, type Object3D } from "three";
import { describe, expect, it } from "vitest";

import { MODEL3D_LIMITS } from "@/constants/numbers";

import { compareWithNominal } from "./issues";
import { loadGlb } from "./load";
import { measureModel } from "./measure";
import { DEFAULT_MODEL_DEFAULTS } from "./measure-types";
import { bagModelSchema, cupModelSchema } from "./model-types";

const { maxFileBytes: MAX_FILE_BYTES, maxTriangles: MAX_TRIANGLES } = MODEL3D_LIMITS;

type Vec = [number, number, number];

type ConeOptions = {
  topR: number;
  bottomR: number;
  height: number;
  segments?: number;
  y0?: number;
  rings?: number;
  bulge?: number;
  /** angular sweep of the band; below 360 the ring is open */
  sweepDeg?: number;
  /** one extra vertex at the seam, as Blender exports at a UV seam */
  seamDuplicate?: boolean;
  /** centre of the rings in x */
  shiftX?: number;
  /** angular offset (radians) of each ring, top-down, as in a triangulated or CAD mesh */
  ringOffsets?: number[];
  /** leave out the quad of this segment index */
  skipQuad?: number;
  /** wind the triangles inward */
  inward?: boolean;
};

/** A band of a truncated cone around Y, rings top-down. */
function coneBand(o: ConeOptions): BufferGeometry {
  const segments = o.segments ?? 64;
  const rings = o.rings ?? 2;
  const y0 = o.y0 ?? 0;
  const sweep = ((o.sweepDeg ?? 360) * Math.PI) / 180;
  const open = (o.sweepDeg ?? 360) < 360;
  const perRing = open || o.seamDuplicate ? segments + 1 : segments;
  const positions: number[] = [];
  const index: number[] = [];
  for (let j = 0; j < rings; j++) {
    const t = j / (rings - 1);
    const y = y0 + o.height * (1 - t);
    const r = o.topR + (o.bottomR - o.topR) * t;
    for (let i = 0; i < perRing; i++) {
      const a = (i / segments) * sweep + (o.ringOffsets?.[j] ?? 0);
      // `bulge` pushes one vertex of the middle ring outwards
      const extra = o.bulge && j > 0 && j < rings - 1 && i === 0 ? o.bulge : 0;
      positions.push(-(r + extra) * Math.sin(a) + (o.shiftX ?? 0), y, -(r + extra) * Math.cos(a));
    }
  }
  const wraps = perRing === segments;
  for (let j = 0; j < rings - 1; j++) {
    for (let i = 0; i < (wraps ? perRing : perRing - 1); i++) {
      const a = j * perRing + i;
      const b = j * perRing + ((i + 1) % perRing);
      if (j === 0 && i === o.skipQuad) continue;
      // outward winding: the geometric normal points away from the axis
      if (o.inward) index.push(a, b, a + perRing, b, b + perRing, a + perRing);
      else index.push(a, a + perRing, b, b, a + perRing, b + perRing);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  g.setIndex(index);
  return g;
}

function quad(corners: [Vec, Vec, Vec, Vec]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(corners.flat()), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

function named(name: string, geometry: BufferGeometry): Mesh {
  const mesh = new Mesh(geometry);
  mesh.name = name;
  return mesh;
}

function rootOf(...meshes: Object3D[]): Group {
  const root = new Group();
  root.add(...meshes);
  return root;
}

/** measureModel, plus: every model it returns satisfies the zod model schema. */
function measure(...args: Parameters<typeof measureModel>) {
  const r = measureModel(...args);
  if (r.model) {
    const schema = r.model.kind === "parametric-cup" ? cupModelSchema : bagModelSchema;
    expect(schema.safeParse(r.model).success).toBe(true);
  }
  return r;
}

const defaultCone: ConeOptions = { topR: 45, bottomR: 30, height: 80 };
const cupBody = (o: ConeOptions = defaultCone) => named("print:BODY", coneBand(o));
const cupOf = (o: Partial<ConeOptions> = {}) => measure(rootOf(cupBody({ ...defaultCone, ...o })));

type FaceSpec = { w: number; g: number; h: number };
type BagCode = "FRONT" | "BACK" | "LEFT" | "RIGHT";
/** Four bag faces: FRONT at +z, BACK at -z, LEFT at -x, RIGHT at +x. */
function bagFaces({ w, g, h }: FaceSpec): Record<BagCode, Mesh> {
  return {
    FRONT: named(
      "print:FRONT",
      quad([
        [-w / 2, h, g / 2],
        [-w / 2, 0, g / 2],
        [w / 2, 0, g / 2],
        [w / 2, h, g / 2],
      ]),
    ),
    BACK: named(
      "print:BACK",
      quad([
        [w / 2, h, -g / 2],
        [w / 2, 0, -g / 2],
        [-w / 2, 0, -g / 2],
        [-w / 2, h, -g / 2],
      ]),
    ),
    LEFT: named(
      "print:LEFT",
      quad([
        [-w / 2, h, -g / 2],
        [-w / 2, 0, -g / 2],
        [-w / 2, 0, g / 2],
        [-w / 2, h, g / 2],
      ]),
    ),
    RIGHT: named(
      "print:RIGHT",
      quad([
        [w / 2, h, g / 2],
        [w / 2, 0, g / 2],
        [w / 2, 0, -g / 2],
        [w / 2, h, -g / 2],
      ]),
    ),
  };
}

const allBag = (spec: FaceSpec = { w: 120, g: 80, h: 160 }) => Object.values(bagFaces(spec));
const codes = (r: ReturnType<typeof measureModel>) => r.issues.map((i) => i.code);

/** A mesh with `triangles` triangles that is not a print mesh. */
function decor(triangles: number): Mesh {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(9), 3));
  g.setIndex(new Array<number>(triangles * 3).fill(0));
  return named("decor", g);
}

/** A cone of the 90 / 60 / 110 cup: radius at height y (the sample cup). */
const radiusAt = (y: number) => (60 + (30 * y) / 110) / 2;
const part = (name: string, y0: number, y1: number) =>
  named(name, coneBand({ topR: radiusAt(y1), bottomR: radiusAt(y0), height: y1 - y0, y0 }));

describe("measureModel: the whole cup", () => {
  it("describes the whole cup for a tree shaped like the sample cup", () => {
    const r = measure(rootOf(part("print:BODY", 7.927, 104.055), part("wall", 0, 110)));
    expect(r.issues).toEqual([]);
    expect(r.model).toMatchObject({
      topDiameterMm: expect.closeTo(90, 1),
      bottomDiameterMm: expect.closeTo(60, 1),
      heightMm: expect.closeTo(110, 1),
      bandTopOffsetMm: expect.closeTo(6, 1),
      bandBottomOffsetMm: expect.closeTo(8, 1),
      rimMm: DEFAULT_MODEL_DEFAULTS.rimMm,
    });
    // the band's own shape stays what the band is
    expect(r.printMeshes[0]?.shape).toMatchObject({ topYMm: expect.closeTo(104.055, 1) });
  });

  it("derives the same cup from the band alone, the height being the band's top", () => {
    const r = measure(rootOf(part("print:BODY", 7.927, 104.055)));
    expect(r.model).toMatchObject({
      heightMm: expect.closeTo(104.06, 1),
      bandTopOffsetMm: 0,
      bandBottomOffsetMm: expect.closeTo(8, 1),
      bottomDiameterMm: expect.closeTo(60, 1),
      topDiameterMm: expect.closeTo(88.38, 1),
    });
  });

  it("gives offsets 0 for a band that spans the whole cup", () => {
    const r = measure(rootOf(part("print:BODY", 0, 110), part("rim", 109, 110)));
    expect(r.model).toMatchObject({
      heightMm: expect.closeTo(110, 1),
      bandTopOffsetMm: 0,
      bandBottomOffsetMm: 0,
    });
  });

  it("a straight band on a taller cylinder: equal diameters, offsets are the Y distances", () => {
    const band = named("print:BODY", coneBand({ topR: 40, bottomR: 40, height: 80, y0: 10 }));
    const wall = named("wall", coneBand({ topR: 40, bottomR: 40, height: 100, y0: 0 }));
    const r = measure(rootOf(band, wall));
    expect(r.model).toMatchObject({
      topDiameterMm: expect.closeTo(80, 1),
      bottomDiameterMm: expect.closeTo(80, 1),
      heightMm: expect.closeTo(100, 1),
      bandTopOffsetMm: expect.closeTo(10, 1),
      bandBottomOffsetMm: expect.closeTo(10, 1),
    });
  });

  it("INVALID_GEOMETRY when the cone closes before the base", () => {
    const body = named("print:BODY", coneBand({ topR: 30, bottomR: 5, height: 50, y0: 50 }));
    const r = measure(rootOf(body));
    const issue = r.issues.find((i) => i.code === "INVALID_GEOMETRY");
    expect(issue?.meshName).toBe("print:BODY");
    expect(issue?.message).toMatch(/đáy/);
    expect(r.model).toBeNull();
  });

  it("INVALID_GEOMETRY when the cone closes before the rim", () => {
    const body = named("print:BODY", coneBand({ topR: 5, bottomR: 30, height: 50, y0: 0 }));
    const r = measure(
      rootOf(body, named("wall", coneBand({ topR: 5, bottomR: 30, height: 50, y0: 50 }))),
    );
    expect(codes(r)).toContain("INVALID_GEOMETRY");
    expect(r.model).toBeNull();
  });

  it("measures the real sample file as the 12 oz cup: 90 / 60 / 110 with band offsets 6 and 8", async () => {
    const file = readFileSync(
      path.resolve(process.cwd(), "public/mock/models/sample-cup-12oz.glb"),
    );
    const bytes = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer;
    const r = measure(await loadGlb(bytes));
    // the rim tube's top is at Y 110, the highest point, so the file measures as the template
    const wanted = {
      topDiameterMm: 90,
      bottomDiameterMm: 60,
      heightMm: 110,
      bandTopOffsetMm: 6,
      bandBottomOffsetMm: 8,
    } as const;
    // `r.model` is a plain object of figures; read each as a number (a missing one is NaN and fails).
    const figures: Record<string, unknown> = { ...r.model };
    for (const [key, value] of Object.entries(wanted)) {
      expect(Math.abs(Number(figures[key]) - value), key).toBeLessThan(0.02);
    }
    expect(cupModelSchema.safeParse(r.model).success).toBe(true);
  });
});

describe("measureModel: cup", () => {
  it("measures a correct cup band to 0.1 mm and satisfies the cup schema", () => {
    const r = measure(rootOf(cupBody()));
    expect(r.issues).toEqual([]);
    expect(r.kind).toBe("cup");
    expect(r.model).toMatchObject({
      kind: "parametric-cup",
      topDiameterMm: expect.closeTo(90, 1),
      bottomDiameterMm: expect.closeTo(60, 1),
      heightMm: expect.closeTo(80, 1),
      rimMm: DEFAULT_MODEL_DEFAULTS.rimMm,
      bandTopOffsetMm: 0,
      bandBottomOffsetMm: 0,
      seamMm: DEFAULT_MODEL_DEFAULTS.seamMm,
      material: DEFAULT_MODEL_DEFAULTS.cupMaterial,
    });
    expect(cupModelSchema.safeParse(r.model).success).toBe(true);
  });

  it("reports the print mesh with its own shape", () => {
    const body = cupBody({ ...defaultCone, y0: 5 });
    const r = measure(rootOf(body));
    expect(r.printMeshes).toHaveLength(1);
    expect(r.printMeshes[0]).toMatchObject({
      printAreaCode: "BODY",
      meshName: "print:BODY",
      mesh: body,
      shape: {
        kind: "band",
        topDiameterMm: expect.closeTo(90, 1),
        bottomDiameterMm: expect.closeTo(60, 1),
        topYMm: expect.closeTo(85, 1),
        bottomYMm: expect.closeTo(5, 1),
      },
    });
  });

  it("reads vertices through the world matrix (rotation and scale)", () => {
    // geometry in metres, the parent group rotates and scales it to millimetres
    const body = named("print:BODY", coneBand({ topR: 0.045, bottomR: 0.03, height: 0.08 }));
    const parent = new Group();
    parent.scale.setScalar(1000);
    parent.rotation.y = 0.7;
    parent.add(body);
    const r = measure(rootOf(parent));
    expect(r.issues).toEqual([]);
    expect(r.model).toMatchObject({
      topDiameterMm: expect.closeTo(90, 1),
      heightMm: expect.closeTo(80, 1),
    });
  });

  it("takes caller defaults for what a model cannot tell", () => {
    const r = measure(rootOf(cupBody()), undefined, { seamMm: 7, cupMaterial: "kraft" });
    expect(r.model).toMatchObject({ seamMm: 7, material: "kraft" });
  });

  it("accepts a cylinder and intermediate rings", () => {
    const r = cupOf({ topR: 40, bottomR: 40, height: 100, rings: 5 });
    expect(r.issues).toEqual([]);
    expect(r.model).toMatchObject({ topDiameterMm: expect.closeTo(80, 1) });
  });

  it("accepts a ring with a duplicated seam column (Blender UV seam)", () => {
    const r = cupOf({ topR: 45, bottomR: 45, seamDuplicate: true });
    expect(codes(r)).not.toContain("NOT_REVOLVED");
    expect(r.model).not.toBeNull();
  });

  it("NOT_REVOLVED when the cup is off the Y axis", () => {
    const r = cupOf({ shiftX: 2 });
    expect(codes(r)).toContain("NOT_REVOLVED");
    expect(r.model).toBeNull();
  });

  it("a missing segment fails the ring-closed check at any density, a closed ring never does", () => {
    for (const segments of [32, 64]) {
      expect(codes(cupOf({ segments, sweepDeg: 330 }))).toContain("NOT_REVOLVED");
      expect(codes(cupOf({ segments }))).not.toContain("NOT_REVOLVED");
    }
    expect(codes(cupOf({ segments: 64, seamDuplicate: true }))).not.toContain("NOT_REVOLVED");
    // one segment of a 32-segment ring removed: 32 distinct angles, one gap of 22.5 degrees
    expect(codes(cupOf({ segments: 31, sweepDeg: 337.5 }))).toContain("NOT_REVOLVED");
  });

  it("reads the numeric shape of a band under rotation, scale and a Y translation", () => {
    const body = named("print:BODY", coneBand({ topR: 0.045, bottomR: 0.03, height: 0.08 }));
    const parent = new Group();
    parent.scale.setScalar(1000);
    parent.rotation.y = 0.7;
    parent.position.y = 10;
    parent.add(body);
    const r = measure(rootOf(parent));
    expect(r.printMeshes[0]?.shape).toMatchObject({
      kind: "band",
      topDiameterMm: expect.closeTo(90, 1),
      bottomDiameterMm: expect.closeTo(60, 1),
      topYMm: expect.closeTo(90, 1),
      bottomYMm: expect.closeTo(10, 1),
    });
  });

  it("NOT_REVOLVED for an open band, with a message that says the ring must be closed", () => {
    const r = cupOf({ sweepDeg: 330 });
    const issue = r.issues.find((i) => i.code === "NOT_REVOLVED");
    expect(issue?.message).toMatch(/khép kín/);
    expect(r.model).toBeNull();
  });

  it("NOT_REVOLVED when a vertex leaves the cone by more than 0.5 mm, not by 0.4", () => {
    const base = { rings: 3 };
    expect(codes(cupOf({ ...base, bulge: 0.6 }))).toContain("NOT_REVOLVED");
    expect(codes(cupOf({ ...base, bulge: 0.4 }))).not.toContain("NOT_REVOLVED");
    const bumpy = cupOf({ ...base, bulge: 1 });
    expect(bumpy.issues.find((i) => i.code === "NOT_REVOLVED")?.meshName).toBe("print:BODY");
    expect(bumpy.model).toBeNull();
  });

  it("NOT_REVOLVED when the cup is shifted by more than 0.5 mm, not by 0.4", () => {
    expect(codes(cupOf({ shiftX: 0.6 }))).toContain("NOT_REVOLVED");
    expect(codes(cupOf({ shiftX: 0.4 }))).not.toContain("NOT_REVOLVED");
  });

  it("NO_PRINT_MESH when no print mesh exists", () => {
    const r = measure(rootOf(named("body", coneBand(defaultCone))));
    expect(codes(r)).toEqual(["NO_PRINT_MESH"]);
    expect(r.kind).toBeNull();
    expect(r.model).toBeNull();
  });

  it("MIXED_KINDS when BODY meets bag faces", () => {
    const r = measure(rootOf(cupBody(), bagFaces({ w: 120, g: 80, h: 160 }).FRONT));
    expect(codes(r)).toContain("MIXED_KINDS");
    expect(r.kind).toBeNull();
    expect(r.model).toBeNull();
  });

  it("BAD_UNITS at the edges of the 20 to 400 mm range", () => {
    expect(codes(cupOf({ height: 19.9 }))).toContain("BAD_UNITS");
    expect(codes(cupOf({ height: 20 }))).not.toContain("BAD_UNITS");
    expect(codes(cupOf({ height: 400 }))).not.toContain("BAD_UNITS");
    expect(codes(cupOf({ height: 400.1 }))).toContain("BAD_UNITS");
    const metres = measure(
      rootOf(named("print:BODY", coneBand({ topR: 0.045, bottomR: 0.03, height: 0.08 }))),
    );
    expect(codes(metres)).toContain("BAD_UNITS");
    expect(metres.model).toBeNull();
  });

  it("TOO_COARSE at 31 distinct angles, fine at 32", () => {
    expect(codes(cupOf({ segments: 31 }))).toContain("TOO_COARSE");
    expect(codes(cupOf({ segments: 32 }))).not.toContain("TOO_COARSE");
  });

  it("BASE_NOT_AT_ZERO is a warning at 0.6 mm, quiet at 0.4 mm, and keeps the model", () => {
    const high = cupOf({ y0: 0.6 });
    expect(high.issues).toEqual([
      expect.objectContaining({ code: "BASE_NOT_AT_ZERO", level: "warning" }),
    ]);
    expect(high.model).not.toBeNull();
    expect(cupOf({ y0: 0.4 }).issues).toEqual([]);
  });
});

describe("measureModel: bag", () => {
  it("measures a correct bag to 0.1 mm and satisfies the bag schema", () => {
    const r = measure(rootOf(...allBag()));
    expect(r.issues).toEqual([]);
    expect(r.kind).toBe("bag");
    expect(r.printMeshes.map((m) => m.printAreaCode).sort()).toEqual([
      "BACK",
      "FRONT",
      "LEFT",
      "RIGHT",
    ]);
    expect(r.model).toMatchObject({
      kind: "parametric-bag",
      widthMm: expect.closeTo(120, 1),
      gussetMm: expect.closeTo(80, 1),
      heightMm: expect.closeTo(160, 1),
      topFoldMm: 0,
      handle: DEFAULT_MODEL_DEFAULTS.handle,
      material: DEFAULT_MODEL_DEFAULTS.bagMaterial,
    });
    expect(bagModelSchema.safeParse(r.model).success).toBe(true);
  });

  it("gives each face its own shape", () => {
    const r = measure(rootOf(...allBag()));
    const shapeOf = (code: string) => r.printMeshes.find((m) => m.printAreaCode === code)?.shape;
    expect(shapeOf("FRONT")).toMatchObject({
      kind: "face",
      widthMm: expect.closeTo(120, 1),
      heightMm: expect.closeTo(160, 1),
      bottomYMm: expect.closeTo(0, 1),
      offsetMm: expect.closeTo(40, 1),
    });
    expect(shapeOf("BACK")).toMatchObject({ offsetMm: expect.closeTo(-40, 1) });
    expect(shapeOf("LEFT")).toMatchObject({
      widthMm: expect.closeTo(80, 1),
      offsetMm: expect.closeTo(-60, 1),
    });
    expect(shapeOf("RIGHT")).toMatchObject({ offsetMm: expect.closeTo(60, 1) });
  });

  it("takes the gusset from the distance between FRONT and BACK when no side face exists", () => {
    const f = bagFaces({ w: 120, g: 80, h: 160 });
    const r = measure(rootOf(f.FRONT, f.BACK));
    expect(r.issues).toEqual([]);
    expect(r.model).toMatchObject({
      widthMm: expect.closeTo(120, 1),
      gussetMm: expect.closeTo(80, 1),
    });
  });

  it("measures from BACK and a single side", () => {
    const f = bagFaces({ w: 120, g: 80, h: 160 });
    const r = measure(rootOf(f.BACK, f.LEFT));
    expect(r.issues).toEqual([]);
    expect(r.model).toMatchObject({
      widthMm: expect.closeTo(120, 1),
      gussetMm: expect.closeTo(80, 1),
    });
  });

  it("GUSSET_MISMATCH when the side face and the FRONT-BACK distance differ by more than 0.5 mm", () => {
    const f = bagFaces({ w: 120, g: 80, h: 160 });
    const wide = bagFaces({ w: 120, g: 90, h: 160 });
    const r = measure(rootOf(f.FRONT, f.BACK, wide.LEFT));
    expect(r.issues).toEqual([
      expect.objectContaining({ code: "GUSSET_MISMATCH", level: "warning" }),
    ]);
    expect(r.model).toMatchObject({ gussetMm: expect.closeTo(90, 1) });
    const near = bagFaces({ w: 120, g: 80.4, h: 160 });
    expect(codes(measure(rootOf(f.FRONT, f.BACK, near.LEFT)))).not.toContain("GUSSET_MISMATCH");
  });

  it("BAG_MODEL_INCOMPLETE (warning) with FRONT alone, and still reports the face shape", () => {
    const front = bagFaces({ w: 120, g: 80, h: 160 }).FRONT;
    const r = measure(rootOf(front));
    expect(r.issues).toEqual([
      expect.objectContaining({ code: "BAG_MODEL_INCOMPLETE", level: "warning" }),
    ]);
    expect(r.kind).toBe("bag");
    expect(r.model).toBeNull();
    expect(r.printMeshes[0]).toMatchObject({
      printAreaCode: "FRONT",
      mesh: front,
      shape: {
        kind: "face",
        widthMm: expect.closeTo(120, 1),
        heightMm: expect.closeTo(160, 1),
        offsetMm: expect.closeTo(40, 1),
      },
    });
  });

  it("NOT_RECTANGULAR for a face that is a line, never a model with width 0", () => {
    const line = named(
      "print:FRONT",
      quad([
        [0, 160, 40],
        [0, 0, 40],
        [0, 0, 40],
        [0, 160, 40],
      ]),
    );
    const f = bagFaces({ w: 120, g: 80, h: 160 });
    const r = measure(rootOf(line, f.BACK, f.LEFT));
    expect(codes(r)).toContain("NOT_RECTANGULAR");
    expect(r.model).toBeNull();
    expect(r.printMeshes.find((m) => m.printAreaCode === "FRONT")?.shape).toBeNull();
  });

  it("accepts a flat rectangular face with vertices inside it (loop cuts)", () => {
    const f = bagFaces({ w: 120, g: 80, h: 160 });
    const g = new BufferGeometry();
    const grid: number[] = [];
    for (let j = 0; j <= 4; j++)
      for (let i = 0; i <= 4; i++) grid.push(-60 + i * 30, 160 - j * 40, 40);
    g.setAttribute("position", new BufferAttribute(new Float32Array(grid), 3));
    const index: number[] = [];
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const a = j * 5 + i;
        index.push(a, a + 5, a + 6, a, a + 6, a + 1);
      }
    g.setIndex(index);
    const r = measure(rootOf(named("print:FRONT", g), f.BACK, f.LEFT, f.RIGHT));
    expect(r.issues).toEqual([]);
    expect(r.model).toMatchObject({ widthMm: expect.closeTo(120, 1) });
  });

  it("reads a FRONT offset under a parent translated in z", () => {
    const front = bagFaces({ w: 120, g: 80, h: 160 }).FRONT;
    const parent = new Group();
    parent.position.z = 20;
    parent.add(front);
    const r = measure(rootOf(parent));
    expect(r.printMeshes[0]?.shape).toMatchObject({
      kind: "face",
      offsetMm: expect.closeTo(60, 1),
    });
  });

  it("BAD_UNITS for a bag with a single face", () => {
    const front = bagFaces({ w: 0.12, g: 0.08, h: 0.16 }).FRONT;
    const r = measure(rootOf(front));
    expect(codes(r)).toContain("BAD_UNITS");
    expect(r.printMeshes[0]?.shape).toBeNull();
    expect(r.model).toBeNull();
  });

  it("BASE_NOT_AT_ZERO comes with BAG_MODEL_INCOMPLETE", () => {
    const front = bagFaces({ w: 120, g: 80, h: 160 }).FRONT;
    front.geometry.translate(0, 5, 0);
    const r = measure(rootOf(front));
    expect(codes(r).sort()).toEqual(["BAG_MODEL_INCOMPLETE", "BASE_NOT_AT_ZERO"]);
    expect(r.model).toBeNull();
  });

  it("BAD_UNITS at the edges of the bag height range", () => {
    expect(codes(measure(rootOf(...allBag({ w: 120, g: 80, h: 600 }))))).not.toContain("BAD_UNITS");
    expect(codes(measure(rootOf(...allBag({ w: 120, g: 80, h: 600.1 }))))).toContain("BAD_UNITS");
    expect(codes(measure(rootOf(...allBag({ w: 120, g: 80, h: 19.9 }))))).toContain("BAD_UNITS");
    const metres = measure(rootOf(...allBag({ w: 0.12, g: 0.08, h: 0.16 })));
    expect(codes(metres)).toContain("BAD_UNITS");
    expect(metres.model).toBeNull();
  });

  it("NOT_PLANAR above 0.5 mm, not at 0.4 mm", () => {
    const bent = (dz: number) => {
      const f = bagFaces({ w: 120, g: 80, h: 160 });
      const pos = f.FRONT.geometry.getAttribute("position");
      pos.setZ(0, pos.getZ(0) + dz);
      return measure(rootOf(f.FRONT, f.BACK, f.LEFT, f.RIGHT));
    };
    expect(codes(bent(0.4))).not.toContain("NOT_PLANAR");
    const bad = bent(0.6);
    expect(codes(bad)).toContain("NOT_PLANAR");
    expect(bad.issues.find((i) => i.code === "NOT_PLANAR")?.meshName).toBe("print:FRONT");
    expect(bad.model).toBeNull();
    expect(bad.printMeshes.find((m) => m.printAreaCode === "FRONT")?.shape).toBeNull();
    expect(bad.printMeshes.find((m) => m.printAreaCode === "BACK")?.shape).not.toBeNull();
  });

  it("NOT_PLANAR when a face lies in the wrong plane (FRONT turned sideways)", () => {
    const f = bagFaces({ w: 120, g: 80, h: 160 });
    f.FRONT.geometry.rotateY(Math.PI / 4);
    expect(codes(measure(rootOf(f.FRONT, f.BACK, f.LEFT, f.RIGHT)))).toContain("NOT_PLANAR");
  });

  it("NOT_RECTANGULAR for a corner pulled in by 0.6 mm, not by 0.4 mm", () => {
    const pulled = (dx: number) => {
      const f = bagFaces({ w: 120, g: 80, h: 160 });
      const pos = f.FRONT.geometry.getAttribute("position");
      pos.setX(0, pos.getX(0) + dx);
      return measure(rootOf(f.FRONT, f.BACK, f.LEFT, f.RIGHT));
    };
    expect(codes(pulled(0.4))).not.toContain("NOT_RECTANGULAR");
    const bad = pulled(10);
    expect(codes(bad)).toContain("NOT_RECTANGULAR");
    expect(bad.model).toBeNull();
    expect(codes(pulled(0.6))).toContain("NOT_RECTANGULAR");
  });

  it("NOT_FACING_FRONT is a warning when FRONT sits at -z", () => {
    const root = rootOf(...allBag());
    root.rotation.y = Math.PI;
    const r = measure(root);
    // turned round, every face also looks against its expected direction
    expect(codes(r).sort()).toEqual([
      "FACES_INWARD",
      "FACES_INWARD",
      "FACES_INWARD",
      "FACES_INWARD",
      "NOT_FACING_FRONT",
    ]);
    expect(r.issues.every((i) => i.level === "warning")).toBe(true);
    expect(r.model).not.toBeNull();
  });

  it("NOT_FACING_FRONT for a BACK-only bag when BACK sits at +z, quiet at -z", () => {
    const back = bagFaces({ w: 120, g: 80, h: 160 }).BACK;
    expect(codes(measure(rootOf(back)))).not.toContain("NOT_FACING_FRONT");
    const turned = bagFaces({ w: 120, g: 80, h: 160 }).BACK;
    turned.rotation.y = Math.PI;
    expect(codes(measure(rootOf(turned)))).toContain("NOT_FACING_FRONT");
  });
});

describe("measureModel: finding print objects", () => {
  /** What GLTFLoader builds: sanitised names, the author's name kept in userData. */
  function loaded(name: string, sanitised: string, child: Mesh | Object3D): Object3D {
    child.userData = { name };
    child.name = sanitised;
    return child;
  }

  it("matches userData.name and reports it as the mesh name", () => {
    const mesh = loaded("print:BODY", "printBODY", new Mesh(coneBand(defaultCone))) as Mesh;
    const r = measure(rootOf(mesh));
    expect(r.issues).toEqual([]);
    expect(r.printMeshes[0]).toMatchObject({ printAreaCode: "BODY", meshName: "print:BODY", mesh });
  });

  it("userData.name wins over the node name", () => {
    const mesh = named("print:BODY", coneBand(defaultCone));
    mesh.userData = { name: "Cube" };
    expect(codes(measure(rootOf(mesh)))).toEqual(["NO_PRINT_MESH"]);
  });

  it("falls back to the loose node name when there is no userData.name", () => {
    expect(measure(rootOf(named("printBODY", coneBand(defaultCone)))).kind).toBe("cup");
    expect(measure(rootOf(named("print_BODY", coneBand(defaultCone)))).kind).toBe("cup");
  });

  it("DUPLICATE_PRINT_MESH for GLTFLoader's renamed repeat (printBODY, printBODY_1)", () => {
    const a = loaded("print:BODY", "printBODY", new Mesh(coneBand(defaultCone)));
    const b = loaded("print:BODY", "printBODY_1", new Mesh(coneBand(defaultCone)));
    const r = measure(rootOf(a, b));
    expect(codes(r)).toContain("DUPLICATE_PRINT_MESH");
    expect(r.model).toBeNull();
  });

  it("uses the single mesh below a matched group", () => {
    const child = new Mesh(coneBand(defaultCone));
    child.name = "Cylinder";
    const group = loaded("print:BODY", "printBODY", new Group());
    group.add(child);
    const r = measure(rootOf(group));
    expect(r.issues).toEqual([]);
    expect(r.printMeshes[0]).toMatchObject({ meshName: "print:BODY", mesh: child });
  });

  it("INVALID_GEOMETRY for a print name on a parent of other print objects; the objects below are still measured", () => {
    const parent = new Group();
    parent.name = "print:BODY";
    const body = named("print:BODY", coneBand(defaultCone));
    parent.add(body);
    const r = measure(rootOf(parent));
    const issue = r.issues.find((i) => i.code === "INVALID_GEOMETRY");
    expect(issue?.message).toMatch(/print:BODY/);
    expect(issue?.message).toMatch(/mesh/);
    expect(codes(r)).not.toContain("DUPLICATE_PRINT_MESH");
    expect(codes(r)).not.toContain("MULTI_MATERIAL_PRINT_MESH");
    const measured = r.printMeshes.find((m) => m.mesh === body);
    expect(measured?.shape).toMatchObject({ kind: "band" });
    expect(r.model).toBeNull(); // the error blocks it
  });

  it("a print-named group with only ordinary meshes keeps the one-mesh / several-meshes rules", () => {
    const one = new Group();
    one.name = "print:BODY";
    one.add(named("Cylinder", coneBand(defaultCone)));
    expect(measure(rootOf(one)).issues).toEqual([]);
    const several = new Group();
    several.name = "print:BODY";
    several.add(named("A", coneBand(defaultCone)), named("B", coneBand(defaultCone)));
    expect(codes(measure(rootOf(several)))).toEqual(["MULTI_MATERIAL_PRINT_MESH"]);
  });

  it("the loose node name only counts when there is no userData.name", () => {
    const cube = named("printBODY", coneBand(defaultCone));
    cube.userData = { name: "Cube" };
    expect(codes(measure(rootOf(cube)))).toEqual(["NO_PRINT_MESH"]);
    expect(measure(rootOf(named("printBODY", coneBand(defaultCone)))).kind).toBe("cup");
  });

  it("lists both objects that share a print name, only the first measured", () => {
    const a = named("print:BODY", coneBand(defaultCone));
    const b = named("print:BODY", coneBand(defaultCone));
    const r = measure(rootOf(a, b));
    expect(r.printMeshes.map((m) => m.mesh)).toEqual([a, b]);
    expect(r.printMeshes[0]?.shape).toMatchObject({ kind: "band" });
    expect(r.printMeshes[1]?.shape).toBeNull();
    expect(codes(r).filter((c) => c === "DUPLICATE_PRINT_MESH")).toHaveLength(1);
  });

  it("MULTI_MATERIAL_PRINT_MESH for a matched group with several meshes", () => {
    const group = loaded("print:BODY", "printBODY", new Group());
    group.add(new Mesh(coneBand(defaultCone)), new Mesh(coneBand(defaultCone)));
    const r = measure(rootOf(group));
    const issue = r.issues.find((i) => i.code === "MULTI_MATERIAL_PRINT_MESH");
    expect(issue?.level).toBe("error");
    expect(issue?.message).toMatch(/print:BODY/);
    expect(r.model).toBeNull();
  });

  it("INVALID_GEOMETRY for a matched object with no mesh below it", () => {
    const group = loaded("print:BODY", "printBODY", new Group());
    const r = measure(rootOf(group));
    expect(codes(r)).toContain("INVALID_GEOMETRY");
    expect(r.printMeshes[0]).toMatchObject({ mesh: null, shape: null });
  });
});

describe("measureModel: robustness", () => {
  it("an empty tree gives NO_PRINT_MESH and does not throw", () => {
    const r = measure(new Group());
    expect(codes(r)).toEqual(["NO_PRINT_MESH"]);
    expect(r.printMeshes).toEqual([]);
  });

  it("INVALID_GEOMETRY for a print mesh without positions", () => {
    const r = measure(rootOf(named("print:BODY", new BufferGeometry())));
    expect(codes(r)).toEqual(["INVALID_GEOMETRY"]);
    expect(r.issues[0]?.meshName).toBe("print:BODY");
    expect(r.model).toBeNull();
  });

  it("skips a non-print mesh without positions silently", () => {
    const r = measure(rootOf(cupBody(), named("decor", new BufferGeometry())));
    expect(r.issues).toEqual([]);
    expect(r.model).not.toBeNull();
  });

  it("INVALID_GEOMETRY for a print mesh with zero triangles", () => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(9), 3));
    g.setIndex([]);
    expect(codes(measure(rootOf(named("print:FRONT", g))))).toEqual(["INVALID_GEOMETRY"]);
  });

  it("INVALID_GEOMETRY for a NaN coordinate, never a NaN model", () => {
    for (const body of [cupBody(), bagFaces({ w: 120, g: 80, h: 160 }).FRONT]) {
      body.geometry.getAttribute("position").setX(0, Number.NaN);
      const r = measure(rootOf(body));
      expect(codes(r)).toContain("INVALID_GEOMETRY");
      expect(r.model).toBeNull();
    }
  });

  it("handles a body of 150,000 vertices: TOO_MANY_TRIANGLES, no throw", () => {
    const r = measure(rootOf(cupBody({ ...defaultCone, segments: 75_000 })));
    expect(codes(r)).toContain("TOO_MANY_TRIANGLES");
    expect(r.model).toBeNull();
  });
});

describe("measureModel: size limits", () => {
  it("TOO_MANY_TRIANGLES at 100,001, not at exactly 100,000", () => {
    expect(codes(measure(rootOf(decor(MAX_TRIANGLES))))).not.toContain("TOO_MANY_TRIANGLES");
    expect(codes(measure(rootOf(decor(MAX_TRIANGLES + 1))))).toContain("TOO_MANY_TRIANGLES");
  });

  it("FILE_TOO_LARGE above 10 MB, fine at exactly 10 MB", () => {
    expect(codes(measure(rootOf(cupBody()), { byteLength: MAX_FILE_BYTES + 1 }))).toContain(
      "FILE_TOO_LARGE",
    );
    expect(codes(measure(rootOf(cupBody()), { byteLength: MAX_FILE_BYTES }))).not.toContain(
      "FILE_TOO_LARGE",
    );
  });

  it("writes Vietnamese messages that name the mesh", () => {
    const issue = cupOf({ segments: 24 }).issues.find((i) => i.code === "TOO_COARSE");
    expect(issue?.level).toBe("error");
    expect(issue?.message).toMatch(/print:BODY/);
    expect(issue?.message).toMatch(/[ạảãàáâấầẩẫậăắằẳẵặẹẻẽêếềểễệịọỏôốồổỗộơớờởỡợụủưứừửữựỳýỷỹđ]/i);
  });
});

describe("compareWithNominal", () => {
  const cup = measure(rootOf(cupBody())).model;
  if (!cup || cup.kind !== "parametric-cup") throw new Error("fixture cup failed");

  it("warns for each figure off by more than 1 mm", () => {
    const issues = compareWithNominal(cup, {
      topDiameterMm: 91.5,
      bottomDiameterMm: 60,
      heightMm: 78,
    });
    expect(issues.map((i) => i.code)).toEqual(["NOMINAL_MISMATCH", "NOMINAL_MISMATCH"]);
    expect(issues.every((i) => i.level === "warning")).toBe(true);
  });

  it("stays quiet for 0.5 mm, 1 mm and absent numbers", () => {
    expect(compareWithNominal(cup, { topDiameterMm: 90.5, heightMm: 81 })).toEqual([]);
    expect(compareWithNominal(cup, {})).toEqual([]);
  });

  it("compares bag figures", () => {
    const bag = measure(rootOf(...allBag())).model;
    if (!bag || bag.kind !== "parametric-bag") throw new Error("fixture bag failed");
    expect(compareWithNominal(bag, { widthMm: 121.5, gussetMm: 80 })).toHaveLength(1);
  });
});

describe("measureModel: the glue seam default", () => {
  it("is 8 mm, the seam every cup of the design mock uses", () => {
    expect(DEFAULT_MODEL_DEFAULTS.seamMm).toBe(8);
    expect(cupOf().model).toMatchObject({ seamMm: 8 });
  });
});

describe("measureModel: where a face sits (centreMm)", () => {
  const shapeOf = (r: ReturnType<typeof measureModel>, code: string) =>
    r.printMeshes.find((m) => m.printAreaCode === code)?.shape;

  it("is 0 for a centred face, and 5 for a FRONT shifted +5 mm on x", () => {
    expect(shapeOf(measure(rootOf(...allBag())), "FRONT")).toMatchObject({ centreMm: 0 });
    const f = bagFaces({ w: 120, g: 80, h: 160 });
    f.FRONT.geometry.translate(5, 0, 0);
    expect(shapeOf(measure(rootOf(f.FRONT, f.BACK, f.LEFT, f.RIGHT)), "FRONT")).toMatchObject({
      centreMm: expect.closeTo(5, 1),
    });
  });

  it("is -3 for a LEFT shifted -3 mm on z", () => {
    const f = bagFaces({ w: 120, g: 80, h: 160 });
    f.LEFT.geometry.translate(0, 0, -3);
    expect(shapeOf(measure(rootOf(f.FRONT, f.BACK, f.LEFT, f.RIGHT)), "LEFT")).toMatchObject({
      centreMm: expect.closeTo(-3, 1),
    });
  });

  it("is read through a translated parent", () => {
    const f = bagFaces({ w: 120, g: 80, h: 160 });
    const parent = new Group();
    parent.position.x = 30;
    parent.add(f.FRONT);
    expect(shapeOf(measure(rootOf(parent)), "FRONT")).toMatchObject({
      centreMm: expect.closeTo(30, 1),
    });
  });
});

describe("measureModel: FACES_INWARD", () => {
  const inward = (r: ReturnType<typeof measureModel>) =>
    r.issues.filter((i) => i.code === "FACES_INWARD");

  it("is quiet for a correct cup and bag", () => {
    expect(inward(measure(rootOf(cupBody())))).toEqual([]);
    expect(inward(measure(rootOf(...allBag())))).toEqual([]);
  });

  it("warns for a cup body wound inward, naming the mesh and the Blender fix", () => {
    const r = cupOf({ inward: true });
    const [issue] = inward(r);
    expect(issue).toMatchObject({ level: "warning", meshName: "print:BODY" });
    expect(issue?.message).toMatch(/print:BODY/);
    expect(issue?.message).toMatch(/Recalculate Outside/);
    expect(r.model).not.toBeNull();
  });

  it("warns for each bag face wound inward", () => {
    for (const code of ["FRONT", "BACK", "LEFT", "RIGHT"] as const) {
      const f = bagFaces({ w: 120, g: 80, h: 160 });
      f[code].geometry.setIndex([0, 2, 1, 0, 3, 2]);
      const r = measure(rootOf(f.FRONT, f.BACK, f.LEFT, f.RIGHT));
      expect(inward(r).map((i) => i.meshName)).toEqual([`print:${code}`]);
      expect(r.model).not.toBeNull();
    }
  });

  it("warns when a mirrored parent turns the world-space winding inward", () => {
    const body = cupBody();
    const parent = new Group();
    parent.scale.x = -1;
    parent.add(body);
    expect(inward(measure(rootOf(parent)))).toHaveLength(1);
    const front = bagFaces({ w: 120, g: 80, h: 160 }).FRONT;
    const mirrored = new Group();
    mirrored.scale.x = -1;
    mirrored.add(front);
    expect(inward(measure(rootOf(mirrored)))).toHaveLength(1);
  });
});

describe("measureModel: closed rings decided from the triangles", () => {
  it("accepts a closed 64-gon whose rings are offset by 0, 0.02 and 0.05 rad", () => {
    const r = cupOf({ rings: 3, ringOffsets: [0, 0.02, 0.05] });
    expect(r.issues).toEqual([]);
    expect(r.model).not.toBeNull();
  });

  it("a 330 degree band fails at 32 and at 64 segments, with the closed-ring message", () => {
    for (const segments of [32, 64]) {
      const issue = cupOf({ segments, sweepDeg: 330 }).issues.find(
        (i) => i.code === "NOT_REVOLVED",
      );
      expect(issue?.message).toMatch(/khép kín/);
    }
  });

  it("a band with one missing quad fails", () => {
    expect(codes(cupOf({ segments: 64, skipQuad: 10 }))).toContain("NOT_REVOLVED");
  });

  it("a hole under 0.5 degrees is ignored, a duplicated seam column passes", () => {
    expect(codes(cupOf({ segments: 64, seamDuplicate: true }))).not.toContain("NOT_REVOLVED");
  });

  it("a closed 16-gon gets TOO_COARSE only", () => {
    expect(codes(cupOf({ segments: 16 }))).toEqual(["TOO_COARSE"]);
  });

  it("TOO_COARSE counts the top and bottom ring separately and takes the smaller", () => {
    // 24-gon rings offset by half a step: 48 distinct directions altogether, 24 in each ring
    const r = cupOf({ segments: 24, rings: 2, ringOffsets: [0, Math.PI / 24] });
    expect(codes(r)).toContain("TOO_COARSE");
  });
});

describe("measureModel: units of a cup come from the whole model", () => {
  it("a 110 mm cup with a 15 mm band passes", () => {
    const r = measure(rootOf(part("print:BODY", 50, 65), part("wall", 0, 110)));
    expect(codes(r)).not.toContain("BAD_UNITS");
    expect(r.model).not.toBeNull();
  });

  it("a cup 110 units tall in metres-as-mm or 1000 times too small still fails", () => {
    const big = measure(rootOf(part("print:BODY", 50, 65), part("wall", 0, 110_000)));
    expect(codes(big)).toContain("BAD_UNITS");
    const small = measure(rootOf(part("print:BODY", 0.05, 0.065), part("wall", 0, 0.11)));
    expect(codes(small)).toContain("BAD_UNITS");
  });
});

describe("measureModel: near-miss names", () => {
  const nearMisses = (r: ReturnType<typeof measureModel>) =>
    r.issues.filter((i) => i.code === "PRINT_NAME_NEAR_MISS");

  it.each([
    ["print:BODY.001", "print:BODY"],
    ["Print:Body", "print:BODY"],
    ["print: BODY", "print:BODY"],
    ["print-BODY", "print:BODY"],
    ["PRINT:FRONT", "print:FRONT"],
  ])("warns for %s and quotes the exact name", (name, expected) => {
    const r = measure(rootOf(named(name, coneBand(defaultCone))));
    const [issue] = nearMisses(r);
    expect(issue).toMatchObject({ level: "warning", meshName: name });
    expect(issue?.message).toContain(name);
    expect(issue?.message).toContain(expected);
    // not a print mesh
    expect(codes(r)).toContain("NO_PRINT_MESH");
  });

  it("is quiet for ordinary names and for the loose GLTFLoader form", () => {
    for (const name of ["Cube", "printer", "body", "printBODY", "print:BODY"]) {
      expect(nearMisses(measure(rootOf(named(name, coneBand(defaultCone)))))).toEqual([]);
    }
  });
});
