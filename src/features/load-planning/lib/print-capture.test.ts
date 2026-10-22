import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOAD_PLANNING_LIMITS } from "@/constants";

import { LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";

import { captureStepImages, captureVehicleViews } from "./capture";
import { CaptureCancelled, capturePrintImages } from "./print-capture";

import type { LayoutBox } from "../types";

vi.mock("./capture", () => ({
  captureVehicleViews: vi.fn(() => ({
    left: { dataUrl: "L", aspect: 0.5 },
    right: { dataUrl: "R", aspect: 0.5 },
  })),
  captureStepImages: vi.fn((_layout: unknown, steps: readonly (readonly LayoutBox[])[]) =>
    steps.map((boxes, i) => `img${i}:${boxes.length}`),
  ),
}));

const box = (n: number) => ({ ...LAYOUT_PICKUP_KIT.boxes[0], ref: `b${n}` });
const steps = (counts: number[]) =>
  counts.map((c, i) => ({ boxes: Array.from({ length: c }, (_, k) => box(i * 100 + k)) }));
const colorOf = () => "#fff";
const labelOf = () => "A";

beforeEach(() => vi.clearAllMocks());

describe("capturePrintImages", () => {
  it("returns the overview views and one image per step, in step order, reporting progress", async () => {
    const progress: [number, number][] = [];
    const result = await capturePrintImages(
      LAYOUT_PICKUP_KIT,
      steps([1, 2, 3]),
      colorOf,
      labelOf,
      (d, t) => progress.push([d, t]),
    );
    expect(result.left.dataUrl).toBe("L");
    expect(result.steps).toEqual(["img0:1", "img1:2", "img2:3"]);
    expect(progress[0]).toEqual([0, 4]);
    expect(progress.at(-1)).toEqual([4, 4]);
    expect(captureVehicleViews).toHaveBeenCalledTimes(1);
  });

  it("splits long step lists into chunks and carries the earlier boxes over as a hidden base step", async () => {
    const chunk = LOAD_PLANNING_LIMITS.captureChunkSteps;
    const all = steps(Array.from({ length: chunk + 2 }, () => 2));
    const result = await capturePrintImages(LAYOUT_PICKUP_KIT, all, colorOf, labelOf, () => {});
    expect(result.steps).toHaveLength(chunk + 2);
    const calls = vi.mocked(captureStepImages).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][1]).toHaveLength(chunk);
    // second chunk: base step holding every earlier box + the chunk's own steps
    expect(calls[1][1]).toHaveLength(3);
    expect(calls[1][1][0]).toHaveLength(chunk * 2);
    // the base step's image is dropped: no duplicates, no gaps
    expect(result.steps.slice(chunk)).toEqual(["img1:2", "img2:2"]);
  });

  it("stops between chunks when cancelled", async () => {
    const control = { cancelled: false };
    const run = capturePrintImages(
      LAYOUT_PICKUP_KIT,
      steps([1, 1]),
      colorOf,
      labelOf,
      () => {},
      control,
    );
    control.cancelled = true;
    await expect(run).rejects.toBeInstanceOf(CaptureCancelled);
    expect(captureStepImages).not.toHaveBeenCalled();
  });

  it("propagates a capture failure (no WebGL)", async () => {
    vi.mocked(captureVehicleViews).mockImplementationOnce(() => {
      throw new Error("no webgl");
    });
    await expect(
      capturePrintImages(LAYOUT_PICKUP_KIT, steps([1]), colorOf, labelOf, () => {}),
    ).rejects.toThrow("no webgl");
  });
});
