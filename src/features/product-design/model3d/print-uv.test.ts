// @vitest-environment node
// Ported from stockflow-storefront src/features/product-design/engine/__tests__/model3d-print-uv.test.ts
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  Vector2,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";

import { printedWidthMm } from "./cup-sector";
import { printGeometry } from "./print-uv";
import { createSurfaces } from "./surfaces";
import { buildBagGeometry } from "./test-support/bag-panel-geometry";
import { buildCupGeometry, uvToSurfacePoint } from "./test-support/cup-body-geometry";
import { bagM, cup12oz, cupBody } from "./test-support/fixtures";

import type { BagModel, CupModel, PrintAreaCode } from "./model-types";
import type { PrintSurface, SurfaceSet } from "./surface-types";

/** The index of a geometry; a throw where the storefront test reads it with `!`. */
function indexOf(g: BufferGeometry) {
  const index = g.getIndex();
  if (index === null) throw new Error("The geometry has no index");
  return index;
}

/** The surface of a print area; a throw where the storefront test reads it with `!`. */
function surfaceFor(set: SurfaceSet, code: PrintAreaCode): PrintSurface {
  const surface = set.byCode[code];
  if (surface === undefined) throw new Error(`The template has no ${code} surface`);
  return surface;
}

const cupModel = cup12oz.model as CupModel;
const bagModel = bagM.model as BagModel;
const TOLERANCE = 1e-6;
const TAU = Math.PI * 2;

/** The geometry as a file would hold it: same triangles, no `uv`. */
function withoutUv(source: BufferGeometry): BufferGeometry {
  const copy = source.clone();
  copy.deleteAttribute("uv");
  return copy;
}

function uvAt(g: BufferGeometry, i: number): [number, number] {
  const uv = g.getAttribute("uv");
  return [uv.getX(i), uv.getY(i)];
}

/** `printGeometry` is non-indexed in the source's triangle order: compare corner k with index[k]. */
function expectSameUvs(result: BufferGeometry, original: BufferGeometry) {
  const index = indexOf(original);
  expect(result.getAttribute("position").count).toBe(index.count);
  for (let k = 0; k < index.count; k++) {
    const [u, v] = uvAt(result, k);
    const [eu, ev] = uvAt(original, index.getX(k));
    expect(Math.abs(u - eu)).toBeLessThan(TOLERANCE);
    expect(Math.abs(v - ev)).toBeLessThan(TOLERANCE);
  }
}

const cupTarget = { code: "BODY", surface: cupBody } as const;

describe("printGeometry, cup", () => {
  it("matches the parametric body UVs for a mesh with other segment counts and no uv", () => {
    const counts: [number, number][] = [
      [24, 5],
      [37, 3],
      [128, 16],
    ];
    for (const [radialSegments, heightSegments] of counts) {
      const original = buildCupGeometry(cupModel, cupBody, { radialSegments, heightSegments }).body;
      const mesh = new Mesh(withoutUv(original));
      expectSameUvs(printGeometry(mesh, cupTarget, cupModel), original);
    }
  });

  it("works through the surface, so a near-cylindrical cup (rect surface) matches too", () => {
    const straight: CupModel = { ...cupModel, bottomDiameterMm: cupModel.topDiameterMm };
    const template = {
      ...cup12oz,
      model: straight,
      printAreas: cup12oz.printAreas.map((a) => ({ ...a, shape: { type: "rect" as const } })),
    };
    const surface = surfaceFor(createSurfaces(template), "BODY");
    expect(surface.kind).toBe("rect");
    const original = buildCupGeometry(straight, surface, { radialSegments: 30 }).body;
    const result = printGeometry(
      new Mesh(withoutUv(original)),
      { code: "BODY", surface },
      straight,
    );
    expectSameUvs(result, original);
  });

  it("overwrites wrong uvs that the file came with", () => {
    const original = buildCupGeometry(cupModel, cupBody, { radialSegments: 24 }).body;
    const wrong = original.clone();
    const count = wrong.getAttribute("position").count;
    wrong.setAttribute("uv", new Float32BufferAttribute(new Array(count * 2).fill(0.5), 2));
    expectSameUvs(printGeometry(new Mesh(wrong), cupTarget, cupModel), original);
  });

  it("splits triangles that straddle the seam: none is wider than half the dieline, and picking inverts the UV", () => {
    const radialSegments = 20;
    const original = buildCupGeometry(cupModel, cupBody, {
      radialSegments,
      heightSegments: 4,
    }).body;
    // Half a step of rotation puts no vertex on the seam, so a triangle crosses it at the back.
    const turned = withoutUv(original);
    turned.rotateY(Math.PI / radialSegments);
    const result = printGeometry(new Mesh(turned), cupTarget, cupModel);

    const position = result.getAttribute("position");
    for (let k = 0; k < position.count; k += 3) {
      const us = [0, 1, 2].map((c) => uvAt(result, k + c)[0]);
      expect(Math.max(...us) - Math.min(...us)).toBeLessThan(0.5);
    }

    const widthMm = printedWidth();
    const [bandTop, bandBottom] = cupBody.vRange;
    const yTop = cupModel.heightMm * (1 - bandTop / slant());
    const yBottom = cupModel.heightMm * (1 - bandBottom / slant());
    for (let i = 0; i < position.count; i++) {
      const point = uvToSurfacePoint(cupBody, uvAt(result, i));
      const alpha = Math.atan2(-position.getX(i), -position.getZ(i));
      const wrapped = (((alpha % TAU) + TAU) % TAU) / TAU;
      // u is the unwrapped angle share of the width: equal mod the width (a vertex at the seam may be at either end).
      const share = (((point.u / widthMm) % 1) + 1) % 1;
      const gap = Math.min(Math.abs(share - wrapped), 1 - Math.abs(share - wrapped));
      expect(gap).toBeLessThan(1e-5);
      const t = (yTop - position.getY(i)) / (yTop - yBottom);
      expect(point.v).toBeCloseTo(bandTop + t * (bandBottom - bandTop), 3);
    }
  });

  it("puts a vertex that lies exactly on the seam on the side of its triangle", () => {
    // One triangle: seam vertex (alpha 0) and two just before the end of the turn (alpha near 2π).
    const r = 40;
    const near = (a: number): [number, number] => [-r * Math.sin(a), -r * Math.cos(a)];
    const [x1, z1] = near(TAU - 0.1);
    const [x2, z2] = near(TAU - 0.2);
    const g = new BufferGeometry();
    g.setAttribute(
      "position",
      new Float32BufferAttribute([0, 100, -r, x1, 100, z1, x2, 50, z2], 3),
    );
    const result = printGeometry(new Mesh(g), cupTarget, cupModel);
    const us = [0, 1, 2].map((c) => uvAt(result, c)[0]);
    expect(Math.max(...us) - Math.min(...us)).toBeLessThan(0.5);
  });

  it("applies the mesh's world transform to positions and normals", () => {
    const original = buildCupGeometry(cupModel, cupBody, { radialSegments: 24 }).body;
    const metres = withoutUv(original);
    metres.scale(0.001, 0.001, 0.001);
    const mesh = new Mesh(metres);
    mesh.scale.setScalar(1000);
    const result = printGeometry(mesh, cupTarget, cupModel);
    expectSameUvs(result, original);
    const index = indexOf(original);
    for (let k = 0; k < index.count; k += 17) {
      const i = index.getX(k);
      for (const name of ["position", "normal"] as const) {
        const a = result.getAttribute(name);
        const b = original.getAttribute(name);
        expect(a.getX(k)).toBeCloseTo(b.getX(i), 3);
        expect(a.getY(k)).toBeCloseTo(b.getY(i), 3);
        expect(a.getZ(k)).toBeCloseTo(b.getZ(i), 3);
      }
    }
  });

  it("returns a non-indexed geometry with normals, computing them when the file has none", () => {
    const original = buildCupGeometry(cupModel, cupBody, { radialSegments: 24 }).body;
    const bare = withoutUv(original);
    bare.deleteAttribute("normal");
    const result = printGeometry(new Mesh(bare), cupTarget, cupModel);
    expect(result.getIndex()).toBeNull();
    const normal = result.getAttribute("normal");
    expect(normal.count).toBe(result.getAttribute("position").count);
    expect(Math.hypot(normal.getX(5), normal.getY(5), normal.getZ(5))).toBeCloseTo(1, 5);
  });

  describe("absolute position rule (the UV does not depend on the mesh's own extent)", () => {
    const H = cupModel.heightMm;
    const vOf = (y: number) => slant() * (1 - y / H);
    const yOf = (v: number) => H * (1 - v / slant());
    const radiusAt = (y: number) =>
      cupModel.bottomDiameterMm / 2 +
      (cupModel.topDiameterMm / 2 - cupModel.bottomDiameterMm / 2) * (y / H);

    function expectParametricAt(result: BufferGeometry) {
      const position = result.getAttribute("position");
      const width = printedWidthMm(cupModel, cupBody);
      for (let i = 0; i < position.count; i++) {
        const alpha = Math.atan2(-position.getX(i), -position.getZ(i));
        const base = alpha < 0 ? alpha + TAU : alpha;
        const [u, v] = uvAt(result, i);
        // A vertex on the seam may sit at either end of the turn.
        const gaps = [base, base + TAU].map((a) => {
          const flat = cupBody.toFlat((a / TAU) * width, vOf(position.getY(i)));
          const [eu, ev] = cupBody.uvOf(flat.x, flat.y);
          return Math.max(Math.abs(u - eu), Math.abs(v - ev));
        });
        expect(Math.min(...gaps)).toBeLessThan(TOLERANCE);
      }
    }

    const lathe = (yFrom: number, yTo: number) =>
      new LatheGeometry([new Vector2(radiusAt(yTo), yTo), new Vector2(radiusAt(yFrom), yFrom)], 64);

    it("a band 1 mm shorter than the template at each end is not rescaled", () => {
      const [bt, bb] = cupBody.vRange;
      const geometry = lathe(yOf(bb) + 1, yOf(bt) - 1);
      expectParametricAt(printGeometry(new Mesh(geometry), cupTarget, cupModel));
    });

    it("a mesh covering the whole wall (y 0..height) is not rescaled", () => {
      expectParametricAt(printGeometry(new Mesh(lathe(0, H)), cupTarget, cupModel));
    });
  });

  it("rejects a print area the model does not have", () => {
    const original = buildCupGeometry(cupModel, cupBody).body;
    expect(() =>
      printGeometry(new Mesh(original), { code: "FRONT", surface: cupBody }, cupModel),
    ).toThrow(/FRONT/);
  });
});

describe("printGeometry, bag", () => {
  const surfaces = createSurfaces(bagM);
  const panels = buildBagGeometry(bagModel, surfaces).panels;

  it.each(["FRONT", "RIGHT", "BACK", "LEFT"] as const)(
    "face %s matches the formula of bag-mesh.ts",
    (code) => {
      const surface = surfaceFor(surfaces, code);
      const original = panels[code];
      const result = printGeometry(new Mesh(withoutUv(original)), { code, surface }, bagModel);
      expectSameUvs(result, original);
    },
  );

  it("overwrites wrong uvs and honours the world transform", () => {
    const surface = surfaceFor(surfaces, "RIGHT");
    const wrong = panels.RIGHT.clone();
    wrong.scale(0.001, 0.001, 0.001);
    wrong.setAttribute(
      "uv",
      new Float32BufferAttribute(new Array(wrong.getAttribute("position").count * 2).fill(0), 2),
    );
    const mesh = new Mesh(wrong);
    mesh.scale.setScalar(1000);
    const result = printGeometry(mesh, { code: "RIGHT", surface }, bagModel);
    expectSameUvs(result, panels.RIGHT);
  });

  it("a face 2 mm narrower and shorter than the template face is not rescaled", () => {
    const surface = surfaceFor(surfaces, "FRONT");
    const hw = bagModel.widthMm / 2;
    const panelHeight = bagModel.heightMm - bagModel.topFoldMm;
    const z = bagModel.gussetMm / 2;
    const [x0, x1, y0, y1] = [-hw + 1, hw - 1, 1, panelHeight - 1];
    const g = new BufferGeometry();
    g.setAttribute(
      "position",
      new Float32BufferAttribute([x0, y1, z, x0, y0, z, x1, y1, z, x1, y0, z], 3),
    );
    g.setIndex([0, 1, 2, 1, 3, 2]);
    const result = printGeometry(new Mesh(g), { code: "FRONT", surface }, bagModel);
    const [u0, u1] = surface.uRange;
    const [v0, v1] = surface.vRange;
    const position = result.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const s = (position.getX(i) + hw) / bagModel.widthMm;
      const t = (panelHeight - position.getY(i)) / panelHeight;
      const flat = surface.toFlat(u0 + (u1 - u0) * s, v0 + (v1 - v0) * t);
      const [eu, ev] = surface.uvOf(flat.x, flat.y);
      const [u, v] = uvAt(result, i);
      expect(Math.abs(u - eu)).toBeLessThan(TOLERANCE);
      expect(Math.abs(v - ev)).toBeLessThan(TOLERANCE);
    }
  });

  it("transforms normals with the normal matrix under a non-uniform scale", () => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute([0, 10, 0, 0, 0, 0, 10, 10, 0], 3));
    const n = new Vector3(1, 1, 0).normalize();
    g.setAttribute(
      "normal",
      new Float32BufferAttribute([...n.toArray(), ...n.toArray(), ...n.toArray()], 3),
    );
    const mesh = new Mesh(g);
    mesh.scale.set(2, 1, 0.5);
    const result = printGeometry(
      mesh,
      { code: "FRONT", surface: surfaceFor(surfaces, "FRONT") },
      bagModel,
    );
    const expected = new Vector3(1 / 2, 1, 0).normalize();
    const normal = result.getAttribute("normal");
    expect(normal.getX(0)).toBeCloseTo(expected.x, 6);
    expect(normal.getY(0)).toBeCloseTo(expected.y, 6);
    expect(normal.getZ(0)).toBeCloseTo(expected.z, 6);
  });

  it("gives the same result for a non-indexed input as for the indexed one", () => {
    const surface = surfaceFor(surfaces, "RIGHT");
    const target = { code: "RIGHT", surface } as const;
    const indexed = printGeometry(new Mesh(panels.RIGHT), target, bagModel);
    const flat = printGeometry(new Mesh(panels.RIGHT.toNonIndexed()), target, bagModel);
    for (const name of ["position", "normal", "uv"] as const) {
      expect(Array.from(flat.getAttribute(name).array)).toEqual(
        Array.from(indexed.getAttribute(name).array),
      );
    }
  });

  it("leaves the input geometry untouched, even without normals", () => {
    const surface = surfaceFor(surfaces, "FRONT");
    const source = withoutUv(panels.FRONT);
    source.deleteAttribute("normal");
    const before = {
      names: Object.keys(source.attributes),
      position: Array.from(source.getAttribute("position").array),
      index: Array.from(indexOf(source).array),
    };
    printGeometry(new Mesh(source), { code: "FRONT", surface }, bagModel);
    expect(Object.keys(source.attributes)).toEqual(before.names);
    expect(source.getAttribute("normal")).toBeUndefined();
    expect(Array.from(source.getAttribute("position").array)).toEqual(before.position);
    expect(Array.from(indexOf(source).array)).toEqual(before.index);
  });
});

function slant(): number {
  return Math.hypot(cupModel.heightMm, (cupModel.topDiameterMm - cupModel.bottomDiameterMm) / 2);
}

/** The printed width at the surface: `printedWidthMm` for a sector (the part of u the body wraps). */
function printedWidth(): number {
  const geometry = buildCupGeometry(cupModel, cupBody, {
    radialSegments: 4,
    heightSegments: 1,
  }).body;
  // The last ring vertex sits at α = 2π, so the picked u of that vertex is the printed width.
  const uv = geometry.getAttribute("uv");
  return uvToSurfacePoint(cupBody, [uv.getX(4), uv.getY(4)]).u;
}

/** Per-triangle keys (sorted vertex strings with position and uv), to compare meshes as sets. */
function triangleKeys(g: BufferGeometry): string[] {
  const position = g.getAttribute("position");
  const key = (i: number) =>
    [position.getX(i), position.getY(i), position.getZ(i)]
      .map((n) => n.toFixed(3))
      .concat(uvAt(g, i).map((n) => n.toFixed(5)))
      .join(",");
  const keys: string[] = [];
  for (let k = 0; k < position.count; k += 3) {
    keys.push([key(k), key(k + 1), key(k + 2)].sort().join("|"));
  }
  return keys.sort();
}

function winding(g: BufferGeometry, k: number): Vector3 {
  const p = g.getAttribute("position");
  const at = (i: number) => new Vector3(p.getX(i), p.getY(i), p.getZ(i));
  return at(k + 1)
    .sub(at(k))
    .cross(at(k + 2).sub(at(k)));
}

function triangleArea(g: BufferGeometry, k: number): number {
  return winding(g, k).length() / 2;
}

/** Every triangle winds outward and every vertex normal points outward, for the given direction rule. */
function expectOutward(g: BufferGeometry, outwardAt: (centroid: Vector3) => Vector3) {
  const p = g.getAttribute("position");
  const n = g.getAttribute("normal");
  for (let k = 0; k < p.count; k += 3) {
    const centroid = new Vector3();
    for (let c = 0; c < 3; c++) {
      centroid.add(new Vector3(p.getX(k + c), p.getY(k + c), p.getZ(k + c)));
    }
    const out = outwardAt(centroid.divideScalar(3));
    if (triangleArea(g, k) < 1e-6) continue;
    expect(winding(g, k).dot(out)).toBeGreaterThan(0);
    for (let c = 0; c < 3; c++) {
      expect(new Vector3(n.getX(k + c), n.getY(k + c), n.getZ(k + c)).dot(out)).toBeGreaterThan(0);
    }
  }
}

/** The geometry as an inward-facing file would hold it: winding reversed, optionally normals negated. */
function inwardFacing(source: BufferGeometry, negateNormals: boolean): BufferGeometry {
  const copy = withoutUv(source);
  const reversed = Array.from(indexOf(copy).array);
  for (let k = 0; k < reversed.length; k += 3) {
    const [second, third] = [reversed[k + 1], reversed[k + 2]];
    if (second === undefined || third === undefined) throw new Error("A triangle needs 3 indices");
    [reversed[k + 1], reversed[k + 2]] = [third, second];
  }
  copy.setIndex(reversed);
  if (negateNormals) {
    const n = copy.getAttribute("normal");
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  }
  return copy;
}

const radialOut = (c: Vector3) => new Vector3(c.x, 0, c.z);

describe("printGeometry faces outward", () => {
  const surfaces = createSurfaces(bagM);
  const BAG_OUT = {
    FRONT: new Vector3(0, 0, 1),
    BACK: new Vector3(0, 0, -1),
    RIGHT: new Vector3(1, 0, 0),
    LEFT: new Vector3(-1, 0, 0),
  } as const;

  it.each([true, false])(
    "a cup body with reversed winding (normals negated: %s) is fixed",
    (neg) => {
      const original = buildCupGeometry(cupModel, cupBody, { radialSegments: 24 }).body;
      const fixed = printGeometry(new Mesh(inwardFacing(original, neg)), cupTarget, cupModel);
      const good = printGeometry(new Mesh(withoutUv(original)), cupTarget, cupModel);
      expect(triangleKeys(fixed)).toEqual(triangleKeys(good));
      expectOutward(fixed, radialOut);
    },
  );

  it.each(["FRONT", "RIGHT", "BACK", "LEFT"] as const)(
    "bag face %s with reversed winding is fixed",
    (code) => {
      const panel = buildBagGeometry(bagModel, surfaces).panels[code];
      const target = { code, surface: surfaceFor(surfaces, code) };
      for (const neg of [true, false]) {
        const fixed = printGeometry(new Mesh(inwardFacing(panel, neg)), target, bagModel);
        const good = printGeometry(new Mesh(withoutUv(panel)), target, bagModel);
        expect(triangleKeys(fixed)).toEqual(triangleKeys(good));
        expectOutward(fixed, () => BAG_OUT[code]);
      }
    },
  );

  it("a mirrored mesh (negative scale on its parent) comes out outward", () => {
    const original = buildCupGeometry(cupModel, cupBody, { radialSegments: 24 }).body;
    const parent = new Group();
    parent.scale.set(-1, 1, 1);
    const mesh = new Mesh(withoutUv(original));
    parent.add(mesh);
    expectOutward(printGeometry(mesh, cupTarget, cupModel), radialOut);
  });

  it("returns a correct mesh unchanged (same corner order, positions and normals)", () => {
    const original = buildCupGeometry(cupModel, cupBody, { radialSegments: 24 }).body;
    const result = printGeometry(new Mesh(withoutUv(original)), cupTarget, cupModel);
    const index = indexOf(original);
    for (let k = 0; k < index.count; k++) {
      for (const name of ["position", "normal"] as const) {
        const a = result.getAttribute(name);
        const b = original.getAttribute(name);
        expect(a.getX(k)).toBeCloseTo(b.getX(index.getX(k)), 5);
        expect(a.getY(k)).toBeCloseTo(b.getY(index.getX(k)), 5);
        expect(a.getZ(k)).toBeCloseTo(b.getZ(index.getX(k)), 5);
      }
    }
  });
});

describe("printGeometry splits triangles at the seam", () => {
  const width = printedWidthMm(cupModel, cupBody);
  const uOf = (g: BufferGeometry, i: number) => uvToSurfacePoint(cupBody, uvAt(g, i)).u;

  function turnedBody() {
    const radialSegments = 32;
    const original = buildCupGeometry(cupModel, cupBody, {
      radialSegments,
      heightSegments: 4,
    }).body;
    const turned = withoutUv(original);
    turned.rotateY(Math.PI / radialSegments);
    return { turned, result: printGeometry(new Mesh(turned), cupTarget, cupModel) };
  }

  it("maps nothing beyond the printed width and leaves no gap in u", () => {
    const { result } = turnedBody();
    const count = result.getAttribute("position").count;
    const spans: [number, number][] = [];
    for (let k = 0; k < count; k += 3) {
      const us = [0, 1, 2].map((c) => uOf(result, k + c));
      for (const u of us) {
        expect(u).toBeGreaterThan(-1e-3);
        expect(u).toBeLessThan(width + 1e-3);
      }
      spans.push([Math.min(...us), Math.max(...us)]);
    }
    spans.sort((a, b) => a[0] - b[0]);
    const [firstSpan] = spans;
    if (firstSpan === undefined) throw new Error("The seam test found no triangle");
    expect(firstSpan[0]).toBeLessThan(1e-3);
    let reach = firstSpan[1];
    for (const [from, to] of spans) {
      expect(from).toBeLessThanOrEqual(reach + 1e-3);
      reach = Math.max(reach, to);
    }
    expect(reach).toBeGreaterThan(width - 1e-3);
  });

  it("keeps the total surface area", () => {
    const { turned, result } = turnedBody();
    const area = (g: BufferGeometry) => {
      let sum = 0;
      for (let k = 0; k < g.getAttribute("position").count; k += 3) sum += triangleArea(g, k);
      return sum;
    };
    const flat = turned.toNonIndexed();
    expect(Math.abs(area(result) - area(flat)) / area(flat)).toBeLessThan(1e-6);
  });

  it("gives the formula 2 and 4 degrees each side of the seam, and 0 or full width on the cut", () => {
    const r = 40;
    const alphas = [-4, -2, 2, 4].map((d) => (((d * Math.PI) / 180) % TAU) + (d < 0 ? TAU : 0));
    const positions: number[] = [];
    for (const y of [100, 60]) {
      for (const a of alphas) positions.push(-r * Math.sin(a), y, -r * Math.cos(a));
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(positions, 3));
    g.setIndex([0, 4, 1, 4, 5, 1, 1, 5, 2, 5, 6, 2, 2, 6, 3, 6, 7, 3]);
    const result = printGeometry(new Mesh(g), cupTarget, cupModel);
    const p = result.getAttribute("position");
    const formula = (alpha: number, y: number) => {
      const flat = cupBody.toFlat((alpha / TAU) * width, slant() * (1 - y / cupModel.heightMm));
      return cupBody.uvOf(flat.x, flat.y);
    };
    let cuts = 0;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const [u, v] = uvAt(result, i);
      const onSeam = Math.abs(p.getX(i)) < 1e-6;
      const alpha = Math.atan2(-p.getX(i), -p.getZ(i));
      const candidates = onSeam
        ? [formula(0, y), formula(TAU, y)]
        : [formula((alpha + TAU) % TAU, y)];
      if (onSeam) cuts++;
      const best = Math.min(
        ...candidates.map(([eu, ev]) => Math.max(Math.abs(u - eu), Math.abs(v - ev))),
      );
      expect(best).toBeLessThan(TOLERANCE);
    }
    expect(cuts).toBeGreaterThan(0);
  });

  it("keeps the triangle count when a vertex column lies on the seam", () => {
    const original = buildCupGeometry(cupModel, cupBody, { radialSegments: 32 }).body;
    const result = printGeometry(new Mesh(withoutUv(original)), cupTarget, cupModel);
    expect(result.getAttribute("position").count).toBe(indexOf(original).count);
  });
});
