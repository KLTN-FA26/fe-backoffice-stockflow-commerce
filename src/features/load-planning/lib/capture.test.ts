import { PerspectiveCamera, Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LAYOUT_40HC, LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";

import { fitDistance } from "./capture-fit";
import { OVERVIEW_MIN_WIDTH, STEP_ASPECT, captureStepImages, captureVehicleViews } from "./capture";
import { acquireRenderer, disposeSharedRenderer } from "./capture-renderer";
import { extentOf } from "./dims";
import { buildLoadingSteps } from "./loading-steps";
import { sceneScale } from "./scene";

import type { Scene } from "three";

/**
 * jsdom không có WebGL: thay `WebGLRenderer` bằng bản giả đếm số lần tạo, nhả context và render —
 * đúng ba thứ mà lỗi rò context của bản gốc làm hỏng.
 */
const { created, FakeRenderer } = vi.hoisted(() => {
  const created: InstanceType<typeof FakeRenderer>[] = [];
  class FakeRenderer {
    lost = false;
    forceContextLoss = vi.fn();
    dispose = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    renderedMeshCounts: number[] = [];
    renderedCameras: PerspectiveCamera[] = [];
    domElement = {
      width: 1200,
      height: 760,
      toDataURL: vi.fn(() => "data:image/jpeg;base64,FAKE"),
    };
    constructor() {
      created.push(this);
    }
    getContext() {
      return { isContextLost: () => this.lost };
    }
    render(scene: Scene, camera?: PerspectiveCamera) {
      if (camera) {
        camera.updateMatrixWorld(true);
        this.renderedCameras.push(camera.clone());
      }
      let meshes = 0;
      scene.traverse((o) => {
        if ((o as { isMesh?: boolean }).isMesh) meshes += 1;
      });
      this.renderedMeshCounts.push(meshes);
    }
  }
  return { created, FakeRenderer };
});

vi.mock("three", async (importOriginal) => ({
  ...(await importOriginal<typeof import("three")>()),
  WebGLRenderer: FakeRenderer,
}));

vi.mock("./capture-fit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./capture-fit")>()),
  trimWhite: vi.fn(() => ({ dataUrl: "data:image/jpeg;base64,TRIMMED", aspect: 0.5 })),
}));

const colorOf = () => "#60a5fa";

beforeEach(() => {
  created.length = 0;
});
afterEach(() => disposeSharedRenderer());

describe("captureStepImages", () => {
  it("returns one cumulative image per step: step k holds every box up to and including step k", () => {
    const steps = buildLoadingSteps([LAYOUT_PICKUP_KIT]);
    const images = captureStepImages(
      LAYOUT_PICKUP_KIT,
      steps.map((s) => s.boxes),
      colorOf,
    );
    expect(images).toHaveLength(3);
    expect(images.every((i) => i.startsWith("data:image/jpeg"))).toBe(true);
    // mỗi kiện = 1 mesh khối (cột Mesh; đường viền là LineSegments, không tính)
    expect(created[0].renderedMeshCounts).toEqual([4, 20, 23]);
  });

  it("returns nothing, and creates no renderer, when there are no steps", () => {
    expect(captureStepImages(LAYOUT_PICKUP_KIT, [], colorOf)).toEqual([]);
    expect(created).toHaveLength(0);
  });

  it("reuses ONE WebGL context for every vehicle and every step (the context-leak regression)", () => {
    for (const layout of [LAYOUT_PICKUP_KIT, LAYOUT_40HC, LAYOUT_PICKUP_KIT]) {
      const steps = buildLoadingSteps([layout]);
      captureStepImages(
        layout,
        steps.map((s) => s.boxes),
        colorOf,
      );
    }
    expect(created).toHaveLength(1);
    expect(created[0].forceContextLoss).not.toHaveBeenCalled();
  });

  it("sizes the shared renderer for the step image", () => {
    captureStepImages(LAYOUT_PICKUP_KIT, [LAYOUT_PICKUP_KIT.boxes], colorOf);
    expect(created[0].setSize).toHaveBeenCalledWith(1200, 760, false);
    expect(STEP_ASPECT).toBeCloseTo(760 / 1200, 9);
  });
});

/** Mức lấp khung: toạ độ NDC lớn nhất của 8 góc lòng xe (1 = chạm mép khung). */
function frameFill(camera: PerspectiveCamera, inner: { l: number; w: number; h: number }): number {
  const extent = extentOf(inner);
  const k = sceneScale(extent);
  const half = [extent.wMm * k, extent.hMm * k, extent.dMm * k].map((v) => v / 2);
  let fill = 0;
  for (const x of [-half[0], half[0]]) {
    for (const y of [-half[1], half[1]]) {
      for (const z of [-half[2], half[2]]) {
        const p = new Vector3(x, y, z).project(camera);
        fill = Math.max(fill, Math.abs(p.x), Math.abs(p.y));
      }
    }
  }
  return fill;
}

describe("captureVehicleViews", () => {
  it.each([
    ["pickup", LAYOUT_PICKUP_KIT],
    ["40HC", LAYOUT_40HC],
  ])(
    "%s: the camera is fitted so the vehicle fills the frame, not a speck in it",
    (_name, layout) => {
      captureVehicleViews(layout, colorOf);
      const cameras = created[0].renderedCameras;
      expect(cameras).toHaveLength(2);
      for (const camera of cameras) {
        // distance applied once (regression: it was squared, leaving the vehicle ~60 px wide in an 1800 px frame)
        const fill = frameFill(camera, layout.innerMm);
        expect(fill).toBeGreaterThan(0.85);
        expect(fill).toBeLessThanOrEqual(1);
      }
    },
  );

  it("renders the overview large enough to stay sharp after trimming (>= 1200 px wide)", () => {
    captureVehicleViews(LAYOUT_PICKUP_KIT, colorOf);
    const [width] = created[0].setSize.mock.calls[0];
    expect(width).toBeGreaterThanOrEqual(OVERVIEW_MIN_WIDTH * 1.5);
  });

  it("renders two opposite views through the shared renderer", () => {
    const { left, right } = captureVehicleViews(LAYOUT_PICKUP_KIT, colorOf);
    expect(left).toEqual({ dataUrl: "data:image/jpeg;base64,TRIMMED", aspect: 0.5 });
    expect(right.dataUrl).toBe(left.dataUrl);
    expect(created).toHaveLength(1);
    expect(created[0].renderedMeshCounts).toEqual([23, 23]);
  });
});

describe("acquireRenderer", () => {
  it("returns the same renderer on every call", () => {
    expect(acquireRenderer(10, 10)).toBe(acquireRenderer(20, 20));
    expect(created).toHaveLength(1);
  });

  it("recreates the renderer, releasing the dead one, after the context is lost", () => {
    const first = acquireRenderer(10, 10);
    created[0].lost = true;
    const second = acquireRenderer(10, 10);
    expect(second).not.toBe(first);
    expect(created[0].forceContextLoss).toHaveBeenCalledOnce();
    expect(created[0].dispose).toHaveBeenCalledOnce();
    expect(created).toHaveLength(2);
  });

  it("disposeSharedRenderer releases the context and the next capture builds a new one", () => {
    acquireRenderer(10, 10);
    disposeSharedRenderer();
    expect(created[0].forceContextLoss).toHaveBeenCalledOnce();
    acquireRenderer(10, 10);
    expect(created).toHaveLength(2);
    disposeSharedRenderer();
    disposeSharedRenderer(); // lặp lại vô hại
  });
});

describe("fitDistance", () => {
  it("backs the camera off until the farthest corner sits at ~92% of the frustum", () => {
    const camera = new PerspectiveCamera(34, 1800 / 1120, 0.1, 1000);
    const corners = [-5, 5].flatMap((x) =>
      [-1.2, 1.2].flatMap((y) => [-0.5, 0.5].map((z) => new Vector3(x, y, z))),
    );
    const direction = new Vector3(0.95, 0.72, 1.3).normalize();
    const distance = fitDistance(camera, direction, corners);
    camera.position.copy(direction).multiplyScalar(distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    const extent = Math.max(
      ...corners.map((c) =>
        Math.max(Math.abs(c.clone().project(camera).x), Math.abs(c.clone().project(camera).y)),
      ),
    );
    expect(extent).toBeGreaterThan(0.88);
    expect(extent).toBeLessThan(0.97);
  });
});
