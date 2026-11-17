// Ported from stockflow-storefront src/features/product-design/engine/model3d/find-print-meshes.ts
import { Mesh, type Object3D } from "three";

import type { PrintAreaCode } from "./model-types";

/**
 * Find the `print:<CODE>` objects of a loaded model. GLTFLoader sanitises node names
 * (`print:BODY` becomes `printBODY`, a repeat `printBODY_1`) but keeps the author's name in
 * `userData.name`, so that is read first; the loose forms are a fallback for trees without it.
 */

export type PrintObject = {
  printAreaCode: PrintAreaCode;
  /** the author's name, e.g. `print:BODY` */
  name: string;
  /** the mesh that carries the print area; null when none could be resolved */
  mesh: Mesh | null;
  /**
   * why `mesh` is null: nothing below the object, several meshes (several materials), or the
   * name sits on a parent that holds other print objects (those are reported on their own)
   */
  problem: "empty" | "multi" | "parent" | null;
};

const EXACT = /^print:(BODY|FRONT|BACK|LEFT|RIGHT)$/;
const LOOSE = /^print[_]?(BODY|FRONT|BACK|LEFT|RIGHT)$/;

function authorName(object: Object3D): string {
  const stored: unknown = object.userData?.name;
  return typeof stored === "string" ? stored : object.name;
}

function codeOf(object: Object3D): PrintAreaCode | null {
  const stored: unknown = object.userData?.name;
  const name = authorName(object);
  const match = EXACT.exec(name) ?? (typeof stored === "string" ? null : LOOSE.exec(name));
  return match ? (match[1] as PrintAreaCode) : null;
}

function meshesBelow(object: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  object.traverse((child) => {
    if (child instanceof Mesh) meshes.push(child);
  });
  return meshes;
}

function hasPrintBelow(object: Object3D): boolean {
  return object.children.some((child) => codeOf(child) !== null || hasPrintBelow(child));
}

export function findPrintObjects(root: Object3D): PrintObject[] {
  const found: PrintObject[] = [];
  const visit = (object: Object3D) => {
    const code = codeOf(object);
    if (code) {
      if (!(object instanceof Mesh) && hasPrintBelow(object)) {
        // the name belongs on the mesh object: report it and look at what is below
        found.push({ printAreaCode: code, name: `print:${code}`, mesh: null, problem: "parent" });
        object.children.forEach(visit);
        return;
      }
      const meshes = object instanceof Mesh ? [object] : meshesBelow(object);
      const [only] = meshes;
      found.push({
        printAreaCode: code,
        name: `print:${code}`,
        mesh: meshes.length === 1 && only ? only : null,
        problem: meshes.length === 0 ? "empty" : meshes.length > 1 ? "multi" : null,
      });
      return;
    }
    object.children.forEach(visit);
  };
  visit(root);
  return found;
}

// TEMPORARY: `findNearMissNames` is read only by `measure.ts`; both are deleted together (task S3).
const NEAR = /^print[:\-_]?(body|front|back|left|right)$/;

/**
 * Objects that look like a print part but are not an exact match: lower-cased, spaces removed, a
 * trailing `.NNN` dropped and the separator (`:`, `-`, `_`) normalised. They are not print meshes;
 * the caller warns with the exact name to use.
 */
export function findNearMissNames(root: Object3D): { name: string; expected: string }[] {
  const misses: { name: string; expected: string }[] = [];
  const visit = (object: Object3D) => {
    if (codeOf(object) === null) {
      const name = authorName(object);
      const squeezed = name
        .toLowerCase()
        .replace(/\.\d+$/, "")
        .replace(/\s+/g, "");
      const match = NEAR.exec(squeezed);
      if (match?.[1]) misses.push({ name, expected: `print:${match[1].toUpperCase()}` });
    }
    object.children.forEach(visit);
  };
  visit(root);
  return misses;
}
