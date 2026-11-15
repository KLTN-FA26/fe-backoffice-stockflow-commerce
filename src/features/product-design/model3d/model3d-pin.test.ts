// @vitest-environment node
/**
 * PIN TEST: THE SAME TEST LIVES IN TWO REPOSITORIES, AND BOTH COPIES MUST GIVE THE SAME NUMBERS.
 *
 *   storefront  stockflow-storefront  src/features/product-design/engine/__tests__/model3d-pin.test.ts
 *   back-office stockflow-ui          src/features/product-design/model3d/model3d-pin.test.ts
 *
 * Both repositories hold their own copy of the code that maps a flat print sheet onto a print mesh
 * of a `.glb` (`findPrintObjects`, `printGeometry`, the print surfaces). The storefront uses it to
 * show a customer's artwork; the back-office uses it to show the numbered grid when staff upload the
 * file. What staff check at upload must be what the customer sees, so the two copies must never
 * differ. Nothing else keeps them together: each repository's other tests compare a copy with
 * itself. This test compares both with numbers typed here, from the real sample cup (a byte-identical
 * `sample-cup-12oz.glb` in both) and from hand-built trees.
 *
 * Everything below the line "shared part" is literally identical in the two files; only the import
 * lines and the path of the sample file differ. A change to the code in one repository (a constant,
 * the seam cut, the winding, the face axes, which print object is taken) has to be made in the
 * other one too, and this test updated in both. If a number here has to change, change it in both
 * files, and say why in both commit messages. Do not "fix" one side's numbers to make it pass.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { findPrintObjects } from "./find-print-meshes";
import { loadGlb } from "./load";
import { printGeometry } from "./print-uv";
import { createSurfaces } from "./surfaces";

const SAMPLE = path.resolve(process.cwd(), "public/mock/models/sample-cup-12oz.glb");

// ---- shared part: identical in both repositories ------------------------------------------

type Code = "BODY" | "FRONT" | "BACK" | "LEFT" | "RIGHT";
type Template = Parameters<typeof createSurfaces>[0];
type PrintModel = Parameters<typeof printGeometry>[2];
type Area = Template["printAreas"][number];
type Point = [number, number, number];

const TOLERANCE = 1e-6;

const cupModel: PrintModel = {
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

/** A cup whose wall is almost straight (taper 0.2 mm < 0.5 mm): its body unrolls to a rectangle. */
const straightCupModel: PrintModel = { ...cupModel, topDiameterMm: 80, bottomDiameterMm: 79.6 };

const bagModel: PrintModel = {
  kind: "parametric-bag",
  widthMm: 260,
  gussetMm: 120,
  heightMm: 320,
  topFoldMm: 40,
  handle: "twisted",
  material: "kraft-brown",
};

const cupBodyArea: Area = {
  code: "BODY",
  name: "Thân ly",
  xMm: 0,
  yMm: 0,
  widthMm: 279.67,
  heightMm: 120.85,
  safeMarginMm: 3,
  bleedMm: 2,
  shape: {
    type: "annular-sector",
    innerRadiusMm: 230.04,
    outerRadiusMm: 327.05,
    sweepRad: 0.84894,
    seamMm: 8,
  },
  uvMapping: { meshPart: "body" },
};

function bagFace(code: Code, name: string, widthMm: number): Area {
  return {
    code,
    name,
    xMm: 0,
    yMm: 0,
    widthMm,
    heightMm: 280,
    safeMarginMm: 5,
    bleedMm: 3,
    shape: { type: "rect" },
    uvMapping: { meshPart: code.toLowerCase() },
  };
}

function templateOf(model: PrintModel, printAreas: Area[]): Template {
  return {
    templateId: "tpl-pin",
    code: "PIN",
    name: "Pin",
    sku: "PIN",
    minDpi: 300,
    colorMode: "RGB",
    allowedFileFormats: ["image/png"],
    maxFileSizeMb: 20,
    maxColors: null,
    allowedFontCodes: null,
    model,
    printAreas,
  };
}

const cupTemplate = templateOf(cupModel, [cupBodyArea]);
const straightCupTemplate = templateOf(straightCupModel, [cupBodyArea]);
const bagTemplate = templateOf(bagModel, [
  bagFace("FRONT", "Mặt trước", 260),
  bagFace("BACK", "Mặt sau", 260),
  bagFace("LEFT", "Hông trái", 120),
  bagFace("RIGHT", "Hông phải", 120),
]);

function surfaceOf(template: Template, code: Code) {
  const surface = createSurfaces(template).byCode[code];
  if (!surface) throw new Error(`no surface for ${code}`);
  return surface;
}

function mapped(mesh: Mesh, template: Template, model: PrintModel, code: Code): BufferGeometry {
  return printGeometry(mesh, { code, surface: surfaceOf(template, code) }, model);
}

/** Position and UV of the vertex nearest to `target`: [x, y, z, u, v]. */
function pointNear(geometry: BufferGeometry, target: Point): number[] {
  const position = geometry.getAttribute("position");
  let best = 0;
  let gap = Infinity;
  for (let i = 0; i < position.count; i++) {
    const d = Math.hypot(
      position.getX(i) - target[0],
      position.getY(i) - target[1],
      position.getZ(i) - target[2],
    );
    if (d < gap) {
      gap = d;
      best = i;
    }
  }
  const uv = geometry.getAttribute("uv");
  return [
    position.getX(best),
    position.getY(best),
    position.getZ(best),
    uv.getX(best),
    uv.getY(best),
  ];
}

/** The unit normal of triangle `k` by its winding (counter-clockwise seen from the front). */
function windingOf(geometry: BufferGeometry, k: number): number[] {
  const position = geometry.getAttribute("position");
  const corner = (i: number) =>
    new Vector3(position.getX(3 * k + i), position.getY(3 * k + i), position.getZ(3 * k + i));
  const [a, b, c] = [corner(0), corner(1), corner(2)];
  const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  return [normal.x, normal.y, normal.z];
}

/** Every number within 1e-6 of the typed ones (6 decimals). */
function expectClose(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, i) => {
    const typed = expected[i] ?? Number.NaN;
    expect(Math.abs(value - typed), `#${i}: ${value} against ${typed}`).toBeLessThanOrEqual(
      TOLERANCE,
    );
  });
}

function triangles(geometry: BufferGeometry): number {
  return geometry.getAttribute("position").count / 3;
}

/** A cup wall from y0 to y1 with `segments` sides; `phase` 0 puts a vertex on the seam. */
function ring(
  name: string,
  y0: number,
  y1: number,
  segments: number,
  phase: number,
  flip: boolean,
  model: PrintModel,
): Mesh {
  if (model.kind !== "parametric-cup") throw new Error("a cup model is needed");
  const radiusAt = (y: number) =>
    (model.bottomDiameterMm +
      ((model.topDiameterMm - model.bottomDiameterMm) * y) / model.heightMm) /
    2;
  const positions: number[] = [];
  for (const y of [y1, y0]) {
    for (let i = 0; i < segments; i++) {
      const angle = ((i + phase) / segments) * 2 * Math.PI;
      positions.push(-radiusAt(y) * Math.sin(angle), y, -radiusAt(y) * Math.cos(angle));
    }
  }
  const index: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = i;
    const b = (i + 1) % segments;
    if (flip) index.push(a, b, a + segments, b, b + segments, a + segments);
    else index.push(a, a + segments, b, b, a + segments, b + segments);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(index);
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  mesh.name = name;
  return mesh;
}

/** A flat four-corner face; `flip` winds it the other way. */
function quad(name: string, corners: number[], flip: boolean): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(corners), 3));
  geometry.setIndex(flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  mesh.name = name;
  return mesh;
}

/** The four faces of a 260 x 120 x 280 bag, each wound outward (or all inward with `flip`). */
function bagFaces(flip: boolean): Record<string, Mesh> {
  const [w, g, h] = [260, 120, 280];
  const faces: Record<string, number[]> = {
    FRONT: [-w / 2, h, g / 2, -w / 2, 0, g / 2, w / 2, 0, g / 2, w / 2, h, g / 2],
    BACK: [w / 2, h, -g / 2, w / 2, 0, -g / 2, -w / 2, 0, -g / 2, -w / 2, h, -g / 2],
    RIGHT: [w / 2, h, g / 2, w / 2, 0, g / 2, w / 2, 0, -g / 2, w / 2, h, -g / 2],
    LEFT: [-w / 2, h, -g / 2, -w / 2, 0, -g / 2, -w / 2, 0, g / 2, -w / 2, h, g / 2],
  };
  return Object.fromEntries(
    Object.entries(faces).map(([code, corners]) => [code, quad(`print:${code}`, corners, flip)]),
  );
}

function groupOf(name: string, ...children: Mesh[]): Group {
  const group = new Group();
  group.name = name;
  group.add(...children);
  return group;
}

/** What `findPrintObjects` says: [code, name, name of the mesh it found, problem]. */
function found(root: Group) {
  return findPrintObjects(root).map((o) => [
    o.printAreaCode,
    o.name,
    o.mesh?.name ?? null,
    o.problem,
  ]);
}

// ---- cases ----------------------------------------------------------------------------------

/** The distinct vertices on the seam half-plane (x = 0, z < 0), sorted by height then u. */
function seamVertices(geometry: BufferGeometry): number[][] {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const rows = new Map<string, number[]>();
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getX(i)) > 1e-3 || position.getZ(i) >= 0) continue;
    const row = [position.getX(i), position.getY(i), position.getZ(i), uv.getX(i), uv.getY(i)];
    rows.set(row.map((n) => n.toFixed(5)).join(","), row);
  }
  return [...rows.values()].sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0) || (a[3] ?? 0) - (b[3] ?? 0));
}

function expectRows(actual: number[][], expected: number[][]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((row, i) => expectClose(row, expected[i] ?? []));
}

describe("the sample cup with the 12 oz template (numbers typed here)", () => {
  it("maps print:BODY of the real file to the same triangles and UVs in both repositories", async () => {
    const file = readFileSync(SAMPLE);
    const bytes = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer;
    const objects = findPrintObjects(await loadGlb(bytes));
    expect(objects.map((o) => [o.printAreaCode, o.name, o.problem])).toEqual([
      ["BODY", "print:BODY", null],
    ]);
    const body = objects[0]?.mesh;
    if (!body) throw new Error("the sample has no print:BODY mesh");

    const geometry = mapped(body, cupTemplate, cupModel, "BODY");
    expect(triangles(geometry)).toBe(1024);
    // [x, y, z, u, v] of the nearest vertex: front centre, a point each side of the seam, top, bottom
    expectClose(pointNear(geometry, [0, 56, 37.6]), [0, 55.990829, 37.635113, 0.482025, 0.597641]);
    expectClose(
      pointNear(geometry, [-3.7, 56, -37.4]),
      [-3.688886, 55.990829, -37.453888, 0.093461, 0.412671],
    );
    expectClose(
      pointNear(geometry, [3.7, 56, -37.4]),
      [3.688886, 55.990829, -37.453888, 0.870589, 0.412671],
    );
    expectClose(
      pointNear(geometry, [0, 104.055, 44.2]),
      [0, 104.055016, 44.18932, 0.482025, 0.984068],
    );
    expectClose(
      pointNear(geometry, [0, 7.927, 31.1]),
      [0, 7.926641, 31.080906, 0.482025, 0.211215],
    );
  });

  it("builds the sector surface of the 12 oz cup", () => {
    const surface = surfaceOf(cupTemplate, "BODY");
    expect(surface.kind).toBe("sector");
    expectClose([surface.flatBounds.width, surface.flatBounds.height], [286.538984, 125.532256]);
    expectClose([...surface.uRange, ...surface.vRange], [0, 245.271677, 6, 103.018017]);
    expectClose(surface.uvOf(10, 20), [0.034899, 0.840678]);
    const flat = surface.toFlat(100, 50);
    expectClose([flat.x, flat.y, flat.uprightRad ?? 0], [119.968199, 46.582556, -0.064169]);
  });
});

describe("a cup body with no vertex on the seam (its triangles are cut there)", () => {
  const cut = (phase: number, flip: boolean) =>
    mapped(
      ring("print:BODY", 7.927, 104.055, 48, phase, flip, cupModel),
      cupTemplate,
      cupModel,
      "BODY",
    );

  it("splits the triangles that cross the seam: one piece ends at u 0, one at the printed width", () => {
    const geometry = cut(0.5, false);
    expect(triangles(geometry)).toBe(100);
    expectRows(seamVertices(geometry), [
      [0, 7.927, -31.014408, 0.151397, 0.048597],
      [0, 7.927, -31.014408, 0.812653, 0.048597],
      [0, 47.620625, -36.415585, 0.093818, 0.339405],
      [0, 47.620625, -36.415585, 0.870232, 0.339405],
      [0, 104.055, -44.094704, 0.011955, 0.752862],
      [0, 104.055, -44.094704, 0.952095, 0.752862],
    ]);
  });

  it("does not split a body that has a vertex on the seam", () => {
    const geometry = cut(0, false);
    expect(triangles(geometry)).toBe(96);
    expectRows(seamVertices(geometry), [
      [0, 7.927, -31.080954, 0.151397, 0.048597],
      [0, 7.927, -31.080954, 0.812653, 0.048597],
      [0, 104.055, -44.18932, 0.011955, 0.752862],
      [0, 104.055, -44.18932, 0.952095, 0.752862],
    ]);
  });

  it("turns a body wound inward outward: the same triangles, UVs and winding as the right way round", () => {
    const geometry = cut(0.5, true);
    expect(triangles(geometry)).toBe(100);
    // the first triangle is a piece at the back (z < 0): its winding faces away from the axis
    expectClose(windingOf(geometry, 0), [-0.129334, -0.134829, -0.982392]);
    expectClose(windingOf(cut(0.5, false), 0), [-0.129334, -0.134829, -0.982392]);
    expectClose(
      pointNear(geometry, [-2, 7.927, 31]),
      [-2.032792, 7.927, 31.014408, 0.474926, 0.211146],
    );
    expect(seamVertices(geometry)).toHaveLength(6);
  });
});

describe("a near-cylindrical cup (top 80, bottom 79.6): the rect surface", () => {
  it("unrolls to a rectangle of the top circumference plus the seam, and maps onto it", () => {
    const surface = surfaceOf(straightCupTemplate, "BODY");
    expect(surface.kind).toBe("rect");
    expectClose([surface.flatBounds.width, surface.flatBounds.height], [263.327412, 100.000182]);
    expectClose([...surface.uRange, ...surface.vRange], [0, 259.327412, 6, 102.000182]);

    const mesh = ring("print:BODY", 7.927, 104.055, 48, 0.5, false, straightCupModel);
    const geometry = mapped(mesh, straightCupTemplate, straightCupModel, "BODY");
    expect(triangles(geometry)).toBe(100);
    expectClose(
      pointNear(geometry, [-1, 104.055, 39.9]),
      [-2.615418, 104.055, 39.903572, 0.474868, 0.98055],
    );
    expectClose(
      pointNear(geometry, [-1, 7.927, 39.7]),
      [-2.603987, 7.927, 39.729168, 0.474868, 0.01927],
    );
    expectRows(seamVertices(geometry), [
      [0, 7.927, -39.729168, 0.007595, 0.01927],
      [0, 7.927, -39.729168, 0.962024, 0.01927],
      [0, 55.885735, -39.816177, 0.007595, 0.498857],
      [0, 55.885735, -39.816177, 0.962024, 0.498857],
      [0, 104.055, -39.903572, 0.007595, 0.98055],
      [0, 104.055, -39.903572, 0.962024, 0.98055],
    ]);
  });
});

describe("a four-face bag, 260 x 120 x 280", () => {
  it("maps each face from its own corner: s = 0 at the left seen from outside, t = 0 at the top", () => {
    const faces = bagFaces(false);
    // [x, y, z, u, v] of the top-left corner seen from outside, per face
    const corners: [Code, number[]][] = [
      ["FRONT", [-130, 280, 60, 0.011278, 0.98951]],
      ["BACK", [130, 280, -60, 0.011278, 0.98951]],
      ["LEFT", [-130, 280, -60, 0.02381, 0.98951]],
      ["RIGHT", [130, 280, 60, 0.02381, 0.98951]],
    ];
    for (const [code, expected] of corners) {
      const geometry = mapped(faces[code] as Mesh, bagTemplate, bagModel, code);
      expect(triangles(geometry), code).toBe(2);
      expectClose(
        pointNear(geometry, [expected[0] ?? 0, expected[1] ?? 0, expected[2] ?? 0]),
        expected,
      );
    }
  });

  it("builds the rect surface of the front face", () => {
    const front = surfaceOf(bagTemplate, "FRONT");
    expect(front.kind).toBe("rect");
    expectClose([front.flatBounds.width, front.flatBounds.height], [266, 286]);
    expectClose([...front.uRange, ...front.vRange], [0, 260, 0, 280]);
    expectClose(front.uvOf(10, 20), [0.037594, 0.93007]);
    const flat = front.toFlat(100, 50);
    expectClose([flat.x, flat.y, flat.uprightRad ?? 0], [103, 53, 0]);
  });

  it("turns faces wound inward outward: winding and normals face FRONT +Z, BACK -Z, LEFT -X, RIGHT +X", () => {
    const faces = bagFaces(true);
    const outward: [Code, number[]][] = [
      ["FRONT", [0, 0, 1]],
      ["BACK", [0, 0, -1]],
      ["LEFT", [-1, 0, 0]],
      ["RIGHT", [1, 0, 0]],
    ];
    for (const [code, normal] of outward) {
      const geometry = mapped(faces[code] as Mesh, bagTemplate, bagModel, code);
      expectClose(windingOf(geometry, 0), normal);
      const normals = geometry.getAttribute("normal");
      expectClose([normals.getX(0), normals.getY(0), normals.getZ(0)], normal);
    }
  });
});

describe("findPrintObjects on a print name that sits on a group", () => {
  const wall = (name: string) => ring(name, 7.927, 104.055, 48, 0, false, cupModel);

  it("a parent group with a print object of the same code below it: the parent is reported, the child is used", () => {
    const root = new Group();
    root.add(groupOf("print:BODY", wall("print:BODY")));
    expect(found(root)).toEqual([
      ["BODY", "print:BODY", null, "parent"],
      ["BODY", "print:BODY", "print:BODY", null],
    ]);
  });

  it("a group with exactly one mesh below it: that mesh", () => {
    const root = new Group();
    root.add(groupOf("print:BODY", wall("a")));
    expect(found(root)).toEqual([["BODY", "print:BODY", "a", null]]);
  });

  it("a group with two meshes below it: no mesh, problem 'multi'", () => {
    const root = new Group();
    root.add(groupOf("print:BODY", ring("a", 7.927, 60, 48, 0, false, cupModel), wall("b")));
    expect(found(root)).toEqual([["BODY", "print:BODY", null, "multi"]]);
  });
});
