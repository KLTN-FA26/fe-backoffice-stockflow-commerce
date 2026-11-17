/**
 * What the 3D view adds to a loaded model and how it is taken away again, on the real sample cup
 * (top 90, bottom 60, height 110, band offsets 6 and 8, seam 8). The grid painter is replaced by a blank canvas:
 * the painting itself is tested in `model3d/grid-texture.test.ts`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { BufferGeometry, type Mesh, type Object3D } from "three";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { findPrintObjects } from "../../model3d/find-print-meshes";
import { loadGlb } from "../../model3d/load";
import { cup12oz } from "../../model3d/test-support/fixtures";
import { buildPrintView, undoPrintView } from "./print-view";

import type { CupModel } from "../../model3d/model-types";
import type { GridPainter } from "./print-view";

const SAMPLE = path.resolve(process.cwd(), "public/mock/models/sample-cup-12oz.glb");
const MODEL = cup12oz.model as CupModel;
const PARTS = [{ printAreaCode: "BODY" as const }];

const blank: GridPainter = () => document.createElement("canvas");

async function sampleTree(): Promise<Object3D> {
  const file = readFileSync(SAMPLE);
  // A buffer made in this window: the loader tells bytes from text by its own `ArrayBuffer`.
  const bytes = new ArrayBuffer(file.byteLength);
  new Uint8Array(bytes).set(file);
  return loadGlb(bytes);
}

function fileBody(root: Object3D): Mesh {
  const found = findPrintObjects(root).find((object) => object.printAreaCode === "BODY");
  if (!found?.mesh) throw new Error("The sample has no print:BODY mesh");
  return found.mesh;
}

const everything = (root: Object3D) => {
  const all: Object3D[] = [];
  root.traverse((object) => all.push(object));
  return all;
};

let root: Object3D;
beforeEach(async () => {
  root = await sampleTree();
});
beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

const build = (tree: Object3D, paint: GridPainter = blank) =>
  buildPrintView({ root: tree, parts: PARTS, template: cup12oz, model: MODEL, paint });

describe("buildPrintView on the sample cup", () => {
  it("adds one mesh for BODY, with UVs inside the unit square, and a canvas for it", () => {
    const view = build(root);
    expect(view.failures).toEqual([]);
    expect(view.shown.map((part) => part.code)).toEqual(["BODY"]);
    const [shown] = view.shown;
    const uv = shown?.mesh.geometry.getAttribute("uv");
    expect(uv?.count).toBeGreaterThan(0);
    for (let i = 0; i < (uv?.count ?? 0); i += 1) {
      expect(uv?.getX(i)).toBeGreaterThanOrEqual(-1e-6);
      expect(uv?.getX(i)).toBeLessThanOrEqual(1 + 1e-6);
      expect(uv?.getY(i)).toBeGreaterThanOrEqual(-1e-6);
      expect(uv?.getY(i)).toBeLessThanOrEqual(1 + 1e-6);
    }
    expect(shown?.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(view.group.children).toEqual([shown?.mesh]);
    undoPrintView(view);
  });

  it("paints the surface of the template, with the seam at the printed width of the cup", () => {
    const paint = vi.fn(blank);
    const view = build(root, paint);
    const [surface, seam] = paint.mock.calls[0] ?? [];
    expect(surface?.code).toBe("BODY");
    expect(seam).toBeCloseTo(75 * Math.PI, 3);
    undoPrintView(view);
  });

  it("hides the file's own print:BODY while shown and shows it again after undo", () => {
    const own = fileBody(root);
    const view = build(root);
    expect(own.visible).toBe(false);
    expect(view.hidden.map((entry) => entry.mesh)).toEqual([own]);
    undoPrintView(view);
    expect(own.visible).toBe(true);
  });

  it("gives back a mesh that was hidden before as hidden", () => {
    const own = fileBody(root);
    own.visible = false;
    undoPrintView(build(root));
    expect(own.visible).toBe(false);
  });

  it("leaves the tree as it found it: same objects, same visibility, same geometry objects", () => {
    const before = everything(root).map((object) => ({
      object,
      visible: object.visible,
      parent: object.parent,
      geometry: "geometry" in object ? object.geometry : null,
    }));
    const view = build(root);
    expect(everything(root)).toHaveLength(before.length);
    undoPrintView(view);
    const after = everything(root);
    expect(after).toEqual(before.map((entry) => entry.object));
    after.forEach((object, i) => {
      expect(object.visible).toBe(before[i]?.visible);
      expect(object.parent).toBe(before[i]?.parent);
      expect("geometry" in object ? object.geometry : null).toBe(before[i]?.geometry);
    });
  });

  it("disposes what it added and nothing of the file", () => {
    const view = build(root);
    const [shown] = view.shown;
    if (!shown) throw new Error("no part shown");
    const added = [
      vi.spyOn(shown.mesh.geometry, "dispose"),
      vi.spyOn(shown.mesh.material, "dispose"),
      vi.spyOn(shown.texture, "dispose"),
    ];
    const own = vi.spyOn(fileBody(root).geometry, "dispose");
    undoPrintView(view);
    added.forEach((spy) => expect(spy).toHaveBeenCalled());
    expect(own).not.toHaveBeenCalled();
    expect(view.group.children).toEqual([]);
  });

  it("reports a part whose geometry cannot be made, by name and reason, and leaves that mesh visible", () => {
    const own = fileBody(root);
    own.geometry = new BufferGeometry();
    const view = build(root);
    expect(view.shown).toEqual([]);
    expect(view.failures).toHaveLength(1);
    expect(view.failures[0]).toMatchObject({ code: "BODY", name: "print:BODY" });
    expect(view.failures[0]?.reason.length).toBeGreaterThan(0);
    expect(own.visible).toBe(true);
    undoPrintView(view);
  });

  it("builds nothing for an area whose print part the tree does not have", () => {
    const bare = root.clone();
    bare.children.length = 0;
    const view = buildPrintView({
      root: bare,
      parts: PARTS,
      template: cup12oz,
      model: MODEL,
      paint: blank,
    });
    expect(view.shown).toEqual([]);
    expect(view.failures).toEqual([]);
    undoPrintView(view);
  });
});
