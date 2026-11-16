// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadGlb } from "../model3d/load";
import { measureModel } from "../model3d/measure";
import { fileDifferences } from "./file-differences";
import { bagTree } from "./print-config-test-utils";

import type { BagModel, CupModel } from "../model3d/model-types";
import type { BagShift } from "./print-config-test-utils";

function measuredBag(shift: BagShift, faces?: readonly string[]) {
  const r = measureModel(bagTree(shift, faces));
  if (r.model?.kind !== "parametric-bag") throw new Error("no bag model");
  return { model: r.model, parts: r.printMeshes };
}

const check = (shift: BagShift) => {
  const { model, parts } = measuredBag(shift);
  return fileDifferences(model, parts);
};

describe("fileDifferences: the file against the model that will be saved", () => {
  it("a bag shifted 5 mm on X is reported, per face, as an error naming the mesh and what to do in Blender", () => {
    const issues = check({ dx: 5 });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.level === "error")).toBe(true);
    const front = issues.find((i) => i.meshName === "print:FRONT");
    expect(front?.message).toContain("lệch tâm theo chiều ngang 5");
    expect(front?.message).toContain("+½ độ sâu hông");
    expect(issues.some((i) => i.meshName === "print:RIGHT" && /vị trí mặt/.test(i.message))).toBe(
      true,
    );
  });

  it("a bag shifted 1.0 mm is clean", () => {
    expect(check({ dx: 1 })).toEqual([]);
  });

  it("a bag shifted in depth is caught", () => {
    expect(check({ dz: 10 }).length).toBeGreaterThan(0);
  });

  it("a bag that does not start at Y 0 is caught", () => {
    const issues = check({ dy: 5 });
    expect(issues.some((i) => /đáy Y/.test(i.message))).toBe(true);
  });

  it("a centred bag is clean, and a top fold added on the face height keeps it clean", () => {
    const { model, parts } = measuredBag({});
    expect(fileDifferences(model, parts)).toEqual([]);
    const folded: BagModel = { ...model, heightMm: model.heightMm + 40, topFoldMm: 40 };
    expect(fileDifferences(folded, parts)).toEqual([]);
    // the old rule (fold taken out of the face height) is exactly what this comparison catches
    expect(fileDifferences({ ...model, topFoldMm: 40 }, parts).length).toBeGreaterThan(0);
  });

  it("the real sample cup is clean", async () => {
    const file = readFileSync(
      path.resolve(process.cwd(), "public/mock/models/sample-cup-12oz.glb"),
    );
    const bytes = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer;
    const r = measureModel(await loadGlb(bytes), { byteLength: bytes.byteLength });
    const model = r.model as CupModel;
    expect(fileDifferences({ ...model, seamMm: 6, rimMm: 2 }, r.printMeshes)).toEqual([]);
  });
});
