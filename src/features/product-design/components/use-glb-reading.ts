"use client";

/**
 * Reading and measuring one `.glb` at a time, in the browser. three.js is not imported here: `../model3d` (loader,
 * measuring) arrives by a dynamic `import()` when a file is chosen, so a page that only shows a variant does not load
 * it. The loaded tree is kept in the result (the 3D view of a later task reads it) and freed when the next file is
 * chosen or the section unmounts.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { MODEL3D_READ_MESSAGES as MESSAGES } from "@/constants/labels-model3d";
import { MODEL3D_LIMITS, PRINT_CONFIG_LIMITS } from "@/constants/numbers";

import { Model3dError } from "../model3d/model3d-error";

import type { Object3D } from "three";
import type { ModelIssue } from "../model3d/issues";
import type { PrintShape } from "../model3d/measure-types";
import type { BagModel, CupModel, PrintAreaCode } from "../model3d/model-types";

export interface PrintPart {
  printAreaCode: PrintAreaCode;
  /** The author's name for the mesh, e.g. `print:BODY`. */
  meshName: string;
  /** This part measured on its own; `null` when it failed its own checks. */
  shape: PrintShape | null;
}

export interface MeasuredFile {
  fileName: string;
  /** The bytes read once, when the file was chosen: measured, and sent on save as they are. */
  bytes: ArrayBuffer;
  kind: "cup" | "bag" | null;
  /** `null` with any error, and for a bag that cannot be sized as a whole. */
  model: CupModel | BagModel | null;
  parts: PrintPart[];
  issues: ModelIssue[];
  /** The loaded tree, in millimetres; freed by this hook, not by the reader. */
  root: Object3D;
}

export type ReadPhase =
  | { status: "idle" }
  | { status: "reading"; fileName: string }
  | { status: "unreadable"; fileName: string; reason: string }
  | { status: "done"; key: number; result: MeasuredFile };

/** The loader's signature (`loadGlb` of `model3d`), replaceable in tests. */
export type GlbLoader = (bytes: ArrayBuffer) => Promise<Object3D>;

/** The file's bytes in this window's own `ArrayBuffer` (the loader tells bytes from text by it). */
async function readBytes(file: File): Promise<ArrayBuffer> {
  const read = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("Unexpected FileReader result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("File could not be read"));
    reader.readAsArrayBuffer(file);
  });
  const bytes = new ArrayBuffer(read.byteLength);
  new Uint8Array(bytes).set(new Uint8Array(read));
  return bytes;
}

/** Why a file could not be read, in our words (the loader's and the browser's English stays out of the screen). */
function reasonOf(error: unknown): string {
  if (!(error instanceof Model3dError)) return MESSAGES.readFailed;
  if (error.reason === "timeout") return MESSAGES.slowFile;
  return `${MESSAGES.unreadable} ${MESSAGES.unreadableCauses}`;
}

export function useGlbReading(loadModel?: GlbLoader) {
  const [phase, setPhase] = useState<ReadPhase>({ status: "idle" });
  const counter = useRef(0);
  const held = useRef<{ root: Object3D; dispose: (root: Object3D) => void } | null>(null);

  const release = useCallback(() => {
    held.current?.dispose(held.current.root);
    held.current = null;
  }, []);

  useEffect(() => release, [release]);

  const choose = useCallback(
    async (file: File): Promise<MeasuredFile | null> => {
      const mine = ++counter.current;
      release();
      if (!file.name.toLowerCase().endsWith(PRINT_CONFIG_LIMITS.modelFileExtension)) {
        setPhase({ status: "unreadable", fileName: file.name, reason: MESSAGES.notGlb(file.name) });
        return null;
      }
      if (file.size > MODEL3D_LIMITS.maxReadBytes) {
        setPhase({
          status: "unreadable",
          fileName: file.name,
          reason: MESSAGES.tooBigToRead(file.size, MODEL3D_LIMITS.maxReadBytes),
        });
        return null;
      }
      setPhase({ status: "reading", fileName: file.name });
      let root: Object3D | null = null;
      let dispose: ((root: Object3D) => void) | null = null;
      try {
        const model3d = await import("../model3d");
        dispose = model3d.disposeGlbTree;
        const bytes = await readBytes(file);
        root = await (loadModel ?? model3d.loadGlb)(bytes.slice(0));
        const measured = model3d.measureModel(root, { byteLength: bytes.byteLength });
        if (mine !== counter.current) {
          dispose(root);
          return null;
        }
        const result: MeasuredFile = {
          fileName: file.name,
          bytes,
          kind: measured.kind,
          model: measured.model,
          parts: measured.printMeshes.map(({ printAreaCode, meshName, shape }) => ({
            printAreaCode,
            meshName,
            shape,
          })),
          issues: measured.issues,
          root,
        };
        held.current = { root, dispose };
        setPhase({ status: "done", key: mine, result });
        return result;
      } catch (error) {
        if (root && dispose) dispose(root);
        if (mine === counter.current) {
          setPhase({ status: "unreadable", fileName: file.name, reason: reasonOf(error) });
        }
        return null;
      }
    },
    [loadModel, release],
  );

  /** Forget the result (after a save the file is stored; the screen starts again from the saved state). */
  const clear = useCallback(() => {
    counter.current += 1;
    release();
    setPhase({ status: "idle" });
  }, [release]);

  return { phase, choose, clear };
}
