/** The camera start and the "turn to" targets, as numbers, for the real sample cup (front +Z, seam at the back −Z). */
import { readFileSync } from "node:fs";
import path from "node:path";

import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { loadGlb } from "../../model3d/load";
import { cameraPositionFor, framingOf, startPosition, viewTargets } from "./camera-views";

async function sampleBox(): Promise<Box3> {
  const file = readFileSync(path.resolve(process.cwd(), "public/mock/models/sample-cup-12oz.glb"));
  // A buffer made in this window: the loader tells bytes from text by its own `ArrayBuffer`.
  const bytes = new ArrayBuffer(file.byteLength);
  new Uint8Array(bytes).set(file);
  const root = await loadGlb(bytes);
  root.updateMatrixWorld(true);
  return new Box3().setFromObject(root);
}

describe("framing on the sample's real bounding box", () => {
  it("is centred on the box and sized by its half diagonal", async () => {
    const box = await sampleBox();
    const centre = box.getCenter(new Vector3());
    const framing = framingOf(box);
    expect(box.max.y).toBeCloseTo(110, 0);
    expect(framing.centre[0]).toBeCloseTo(centre.x, 6);
    expect(framing.centre[1]).toBeCloseTo(centre.y, 6);
    expect(framing.centre[2]).toBeCloseTo(centre.z, 6);
    expect(framing.radius).toBeCloseTo(box.getSize(new Vector3()).length() / 2, 6);
    expect(framing.distance).toBeGreaterThan(framing.radius);
  });

  it("starts on +Z of the centre, a little above it, at the framing distance", async () => {
    const framing = framingOf(await sampleBox());
    const [x, y, z] = startPosition(framing);
    expect(x).toBeCloseTo(framing.centre[0], 6);
    expect(z).toBeGreaterThan(framing.centre[2]);
    expect(y).toBeGreaterThan(framing.centre[1]);
    const away = new Vector3(x - framing.centre[0], y - framing.centre[1], z - framing.centre[2]);
    expect(away.length()).toBeCloseTo(framing.distance, 6);
  });

  it("turns to the back of the cup on −Z of the centre, at the same distance", async () => {
    const framing = framingOf(await sampleBox());
    const back = viewTargets("cup", ["BODY"]).find((target) => target.id === "BODY-back");
    if (!back) throw new Error("no back view");
    const [x, , z] = cameraPositionFor(framing, back.direction);
    expect(x).toBeCloseTo(framing.centre[0], 6);
    expect(z).toBeLessThan(framing.centre[2]);
    expect(framing.centre[2] - z).toBeGreaterThan(framing.distance * 0.9);
  });
});

describe("viewTargets", () => {
  it("gives a cup a front and a back view, front first", () => {
    expect(viewTargets("cup", ["BODY"]).map((target) => target.id)).toEqual([
      "BODY-front",
      "BODY-back",
    ]);
  });

  it("gives a bag one view for each face it has, looking at that face from outside", () => {
    const targets = viewTargets("bag", ["FRONT", "RIGHT", "BACK", "LEFT"]);
    const toward = Object.fromEntries(targets.map((t) => [t.id, t.direction]));
    expect(toward.FRONT?.[2]).toBeGreaterThan(0.9);
    expect(toward.BACK?.[2]).toBeLessThan(-0.9);
    expect(toward.RIGHT?.[0]).toBeGreaterThan(0.9);
    expect(toward.LEFT?.[0]).toBeLessThan(-0.9);
  });

  it("skips the faces a bag does not have, and every label is in words", () => {
    const targets = viewTargets("bag", ["FRONT"]);
    expect(targets.map((t) => t.id)).toEqual(["FRONT"]);
    expect(targets[0]?.label).toBe("Xoay tới mặt trước");
  });
});
