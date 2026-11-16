/**
 * What the 3D view adds to a loaded model, and the function that takes it away. For each print area of the template
 * it builds a mesh from `printGeometry` carrying the numbered grid of the area's surface as a texture, and hides the
 * file's own mesh of that part. The new meshes live in a group of their own, NOT in the loaded tree (whose owner,
 * `use-glb-reading.ts`, measured it and frees it): the caller draws the group beside the tree. Only the visibility of
 * the hidden meshes changes in the tree, and `undoPrintView` gives it back and frees everything that was made.
 * Pure of React and of WebGL (a canvas and a texture need neither a renderer nor a context).
 */
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, SRGBColorSpace } from "three";

import { MODEL3D_VIEW as VIEW } from "@/constants/numbers";

import { printedWidthMm } from "../../model3d/cup-sector";
import { disposeMaterials } from "../../model3d/dispose";
import { findPrintObjects } from "../../model3d/find-print-meshes";
import { readGridColors } from "../../model3d/grid-colors";
import { drawGridTexture, gridPxPerMm } from "../../model3d/grid-texture";
import { printGeometry } from "../../model3d/print-uv";
import { createSurfaces } from "../../model3d/surfaces";

import type { BufferGeometry, Object3D } from "three";
import type {
  BagModel,
  CupModel,
  CustomizationTemplate,
  PrintAreaCode,
} from "../../model3d/model-types";
import type { PrintSurface } from "../../model3d/surface-types";

/** Paints the grid of a surface on a new canvas; `seamAtMm` is where a cup's glue flap starts, `null` for a bag face. */
export type GridPainter = (surface: PrintSurface, seamAtMm: number | null) => HTMLCanvasElement;

export const paintGrid: GridPainter = (surface, seamAtMm) => {
  const canvas = document.createElement("canvas");
  drawGridTexture(canvas, surface, {
    pxPerMm: gridPxPerMm(surface.flatBounds),
    colors: readGridColors(),
    seamAtMm,
  });
  return canvas;
};

export interface ShownPart {
  code: PrintAreaCode;
  mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  canvas: HTMLCanvasElement;
  texture: CanvasTexture;
}

export interface PrintViewFailure {
  code: PrintAreaCode;
  /** The author's name of the part, e.g. `print:BODY`. */
  name: string;
  reason: string;
}

export interface PrintView {
  /** The new meshes: draw it next to the loaded tree, with an identity transform. */
  group: Group;
  shown: ShownPart[];
  /** The file's own meshes hidden while the grid shows, with their visibility before. */
  hidden: { mesh: Mesh; wasVisible: boolean }[];
  failures: PrintViewFailure[];
}

export interface BuildPrintViewArgs {
  root: Object3D;
  parts: readonly { printAreaCode: PrintAreaCode }[];
  template: CustomizationTemplate;
  model: CupModel | BagModel;
  paint?: GridPainter;
}

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function buildPrintView({
  root,
  parts,
  template,
  model,
  paint = paintGrid,
}: BuildPrintViewArgs): PrintView {
  root.updateMatrixWorld(true);
  const view: PrintView = { group: new Group(), shown: [], hidden: [], failures: [] };
  const surfaces = createSurfaces(template);
  const wanted = new Set(parts.map((part) => part.printAreaCode));
  const found = findPrintObjects(root);

  for (const code of surfaces.order) {
    const surface = surfaces.byCode[code];
    const own = found.find((object) => object.printAreaCode === code && object.mesh);
    if (!surface || !own?.mesh || !wanted.has(code)) continue;
    const { mesh: fileMesh, name } = own;
    let geometry: BufferGeometry | null = null;
    try {
      geometry = printGeometry(fileMesh, { code, surface }, model);
      const seamAtMm = model.kind === "parametric-cup" ? printedWidthMm(model, surface) : null;
      const canvas = paint(surface, seamAtMm);
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = VIEW.gridAnisotropy;
      // The file's own wall can lie in the same place as the print part: win the depth test.
      const material = new MeshBasicMaterial({
        map: texture,
        polygonOffset: true,
        polygonOffsetFactor: VIEW.gridPolygonOffsetFactor,
        polygonOffsetUnits: VIEW.gridPolygonOffsetUnits,
      });
      const mesh = new Mesh(geometry, material);
      mesh.name = `grid:${code}`;
      view.group.add(mesh);
      view.shown.push({ code, mesh, canvas, texture });
      view.hidden.push({ mesh: fileMesh, wasVisible: fileMesh.visible });
      fileMesh.visible = false;
    } catch (error) {
      geometry?.dispose();
      view.failures.push({ code, name, reason: reasonOf(error) });
    }
  }
  return view;
}

/** Shows what was hidden as it was, and frees every geometry, material and texture the view made. */
export function undoPrintView(view: PrintView): void {
  for (const { mesh, wasVisible } of view.hidden) mesh.visible = wasVisible;
  view.hidden.length = 0;
  for (const { mesh, canvas } of view.shown) {
    view.group.remove(mesh);
    mesh.geometry.dispose();
    disposeMaterials([mesh.material]);
    canvas.width = 0;
    canvas.height = 0;
  }
  view.shown.length = 0;
}
