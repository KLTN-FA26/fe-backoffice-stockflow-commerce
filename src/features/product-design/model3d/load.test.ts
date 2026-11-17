// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { BufferAttribute, BufferGeometry, Euler, Group, Mesh, Box3, Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bakeMillimetres } from "./bake";
import { resetGlbCacheForTests } from "./bytes-cache";
import { loadGlb } from "./load";
import { Model3dError } from "./model3d-error";

const SAMPLE = path.resolve(process.cwd(), "public/mock/models/sample-cup-12oz.glb");
/** The 12 oz sample's height in mm, typed here on purpose (the storefront read it from a fixture). */
const SAMPLE_HEIGHT_MM = 110;

beforeEach(() => resetGlbCacheForTests());
afterEach(() => resetGlbCacheForTests());

/** The value, or a failed test: the narrowing this repository uses instead of `!`. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}

/** The sample file's bytes as an ArrayBuffer of its own. */
function sampleBytes(): ArrayBuffer {
  const file = readFileSync(SAMPLE);
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
}

async function rejection(promise: Promise<unknown>): Promise<Model3dError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Model3dError);
    return error as Model3dError;
  }
  throw new Error("expected a rejection");
}

/** three's loader, imported on demand like `loadGlb` does (nothing imports it statically). */
async function gltfLoaderClass() {
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  return GLTFLoader;
}

/** Y interval of every triangle of a mesh, in world space. */
function triangleSpans(mesh: Mesh): [number, number][] {
  mesh.updateWorldMatrix(true, false);
  const position = mesh.geometry.getAttribute("position");
  const index = mesh.geometry.getIndex();
  const corners = index
    ? Array.from(index.array)
    : Array.from({ length: position.count }, (_, i) => i);
  const spans: [number, number][] = [];
  for (let k = 0; k + 2 < corners.length; k += 3) {
    const ys = [0, 1, 2].map(
      (c) =>
        new Vector3()
          .fromBufferAttribute(position, defined(corners[k + c]))
          .applyMatrix4(mesh.matrixWorld).y,
    );
    spans.push([Math.min(...ys), Math.max(...ys)]);
  }
  return spans;
}

describe("loadGlb", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reads the sample file in millimetres, keeping the author's names in userData", async () => {
    const root = await loadGlb(sampleBytes());
    const body = root.getObjectByName("printBODY");
    expect(body?.userData.name).toBe("print:BODY");
    // 110 mm cup, rim tube included, not 0.11
    const geometry = (body as Mesh).geometry;
    geometry.computeBoundingBox();
    expect(defined(geometry.boundingBox).max.y).toBeGreaterThan(100);
    expect(defined(geometry.boundingBox).max.y).toBeLessThan(110);
    expect(root.getObjectByName("rim")).toBeInstanceOf(Mesh);
  });

  it("fetches a URL with the signal", async () => {
    const bytes = sampleBytes();
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, arrayBuffer: async () => bytes });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const root = await loadGlb("/models/sample-cup-12oz.glb", { signal: controller.signal });
    expect(root.getObjectByName("rim")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/models/sample-cup-12oz.glb",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("rejects ABORTED when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await rejection(loadGlb(sampleBytes(), { signal: controller.signal }));
    expect(error.code).toBe("ABORTED");
  });

  it("rejects ABORTED when the signal aborts during the fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: { signal: AbortSignal }) => {
        return new Promise((_, reject) => {
          init.signal.addEventListener("abort", () => reject(new DOMException("x", "AbortError")));
        });
      }),
    );
    const controller = new AbortController();
    const pending = rejection(loadGlb("/m.glb", { signal: controller.signal }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    expect((await pending).code).toBe("ABORTED");
  });

  it("rejects LOAD_FAILED when fetch fails, answers an error status, or the bytes are not a glTF", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    expect((await rejection(loadGlb("/m-net.glb"))).code).toBe("LOAD_FAILED");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const notFound = await rejection(loadGlb("/m-404.glb"));
    expect(notFound.code).toBe("LOAD_FAILED");
    expect(notFound.message).toContain("404");

    const garbage = new TextEncoder().encode("not a model").buffer as ArrayBuffer;
    expect((await rejection(loadGlb(garbage))).code).toBe("LOAD_FAILED");
  });

  it("fails as LOAD_FAILED, not a hang, for a file that needs a Draco decoder", async () => {
    const json = JSON.stringify({
      asset: { version: "2.0" },
      extensionsUsed: ["KHR_draco_mesh_compression"],
      extensionsRequired: ["KHR_draco_mesh_compression"],
    });
    const bytes = new TextEncoder().encode(json).buffer as ArrayBuffer;
    expect((await rejection(loadGlb(bytes))).code).toBe("LOAD_FAILED");
  });

  it("gives up with LOAD_FAILED after 15 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    const pending = rejection(loadGlb("/slow.glb"));
    await vi.advanceTimersByTimeAsync(15_001);
    const error = await pending;
    expect(error.code).toBe("LOAD_FAILED");
    expect(error.message).toContain("15");
  });
});

describe("the sample cup is a whole cup", () => {
  it("has its highest world point at Y 110 mm", async () => {
    const root = await loadGlb(sampleBytes());
    root.updateMatrixWorld(true);
    let top = -Infinity;
    root.traverse((o) => {
      if (o instanceof Mesh) top = Math.max(top, new Box3().setFromObject(o).max.y);
    });
    expect(Math.abs(top - 110)).toBeLessThan(0.01);
  });

  it("print:BODY, wall and the rim tube together cover the outer wall from the base to the top", async () => {
    const root = await loadGlb(sampleBytes());
    const meshes = ["printBODY", "wall", "rim"].map((name) => root.getObjectByName(name) as Mesh);
    expect(meshes.every((m) => m instanceof Mesh)).toBe(true);
    const spans = meshes.flatMap(triangleSpans).sort((a, b) => a[0] - b[0]);
    let covered = 0;
    let worstGap = 0;
    for (const [from, to] of spans) {
      worstGap = Math.max(worstGap, from - covered);
      covered = Math.max(covered, to);
    }
    expect(defined(spans[0])[0]).toBeCloseTo(0, 3);
    expect(worstGap).toBeLessThanOrEqual(0.1);
    expect(covered).toBeCloseTo(SAMPLE_HEIGHT_MM, 2);
  });
});

describe("bakeMillimetres", () => {
  function triangle(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([0.1, 0, 0, 0, 0.2, 0, 0, 0, 0.3]), 3),
    );
    return g;
  }
  const worldVertex = (mesh: Mesh, i: number) => {
    mesh.updateWorldMatrix(true, false);
    return new Vector3()
      .fromBufferAttribute(mesh.geometry.getAttribute("position"), i)
      .applyMatrix4(mesh.matrixWorld);
  };

  function tree() {
    const shared = triangle();
    const root = new Group();
    const parent = new Group();
    parent.position.set(0.5, 0.25, -0.75);
    parent.rotation.set(0.4, 1.1, -0.3);
    parent.scale.set(2, 3, 4);
    const child = new Mesh(shared);
    child.position.set(0.1, -0.2, 0.3);
    child.rotation.set(-0.7, 0.2, 0.9);
    child.scale.set(1.5, 0.5, 2);
    parent.add(child);
    const twin = new Mesh(shared);
    twin.position.set(-0.3, 0.1, 0.2);
    root.add(parent, twin);
    return { root, parent, child, twin, shared };
  }
  const world = (t: ReturnType<typeof tree>) =>
    [t.child, t.twin].flatMap((m) => [0, 1, 2].map((i) => worldVertex(m, i)));

  it("ends at 1000 x the original world position of every vertex, nested nodes included", () => {
    const expected = world(tree()).map((v) => v.clone().multiplyScalar(1000));
    const after = tree();
    bakeMillimetres(after.root);
    world(after).forEach((v, i) => {
      expect(v.distanceTo(defined(expected[i]))).toBeLessThan(1e-3);
    });
  });

  it("scales a geometry shared by two nodes once", () => {
    const { root, shared } = tree();
    bakeMillimetres(root);
    expect(shared.getAttribute("position").getX(0)).toBeCloseTo(100, 3);
    expect(shared.getAttribute("position").getY(1)).toBeCloseTo(200, 3);
  });

  it("leaves node rotations and scales alone", () => {
    const { root, parent, child } = tree();
    const rotation = new Euler().copy(child.rotation);
    const [scale, parentScale] = [child.scale.clone(), parent.scale.clone()];
    bakeMillimetres(root);
    expect(child.rotation.toArray()).toEqual(rotation.toArray());
    expect(child.scale.equals(scale)).toBe(true);
    expect(parent.scale.equals(parentScale)).toBe(true);
    expect(child.position.x).toBeCloseTo(100, 3);
  });
});

describe("loadGlb abort during the parse", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is ABORTED and frees the parsed tree", async () => {
    const GLTFLoader = await gltfLoaderClass();
    const real = GLTFLoader.prototype.parse;
    const controller = new AbortController();
    vi.spyOn(GLTFLoader.prototype, "parse").mockImplementation(function (
      this: InstanceType<typeof GLTFLoader>,
      ...args
    ) {
      controller.abort();
      return real.apply(this, args);
    });
    const dispose = vi.spyOn(BufferGeometry.prototype, "dispose");
    const error = await rejection(loadGlb(sampleBytes(), { signal: controller.signal }));
    expect(error.code).toBe("ABORTED");
    // the parse finishes after the rejection; the tree is freed when it does
    await vi.waitFor(() => expect(dispose).toHaveBeenCalled());
  });
});

describe("loadGlb reasons", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("network: fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("down")));
    const error = await rejection(loadGlb("/net.glb"));
    expect([error.code, error.reason]).toEqual(["LOAD_FAILED", "network"]);
  });

  it("http: an error status, with the status in the message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const error = await rejection(loadGlb("/http.glb"));
    expect([error.code, error.reason]).toEqual(["LOAD_FAILED", "http"]);
    expect(error.message).toContain("503");
  });

  it("parse: bytes that are not a glTF, and a file that needs a decoder", async () => {
    const garbage = new TextEncoder().encode("not a model").buffer as ArrayBuffer;
    expect((await rejection(loadGlb(garbage))).reason).toBe("parse");
    const draco = new TextEncoder().encode(
      JSON.stringify({
        asset: { version: "2.0" },
        extensionsUsed: ["KHR_draco_mesh_compression"],
        extensionsRequired: ["KHR_draco_mesh_compression"],
      }),
    ).buffer as ArrayBuffer;
    expect((await rejection(loadGlb(draco))).reason).toBe("parse");
  });

  it("timeout: a download that takes more than 15 s", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    const pending = rejection(loadGlb("/slow-reason.glb"));
    await vi.advanceTimersByTimeAsync(15_001);
    const error = await pending;
    expect([error.code, error.reason]).toEqual(["LOAD_FAILED", "timeout"]);
  });

  it("is not set on the other codes", async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await rejection(loadGlb(sampleBytes(), { signal: controller.signal }));
    expect(error.reason).toBeUndefined();
  });
});

describe("loadGlb byte cache", () => {
  const okResponse = (bytes: ArrayBuffer) => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes,
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("two concurrent loads of one URL make one request and give two independent trees", async () => {
    const bytes = sampleBytes();
    const fetchMock = vi.fn().mockResolvedValue(okResponse(bytes));
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([loadGlb("/c1.glb"), loadGlb("/c1.glb")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).not.toBe(b);
    const [rimA, rimB] = [a, b].map((r) => r.getObjectByName("rim") as Mesh);
    expect(rimA).not.toBe(rimB);
    expect(defined(rimA).geometry).not.toBe(defined(rimB).geometry);
  });

  it("a second load makes no request and parses a copy, leaving the kept bytes alone", async () => {
    const bytes = sampleBytes();
    const size = bytes.byteLength;
    const fetchMock = vi.fn().mockResolvedValue(okResponse(bytes));
    vi.stubGlobal("fetch", fetchMock);
    const GLTFLoader = await gltfLoaderClass();
    const parse = vi.spyOn(GLTFLoader.prototype, "parse");

    const first = await loadGlb("/c2.glb");
    const second = await loadGlb("/c2.glb");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).not.toBe(first);
    expect(second.getObjectByName("rim")).toBeInstanceOf(Mesh);
    expect(bytes.byteLength).toBe(size);
    for (const call of parse.mock.calls) expect(call[0]).not.toBe(bytes);
    // the first tree keeps its own geometry even after the second was baked
    const rim = first.getObjectByName("rim") as Mesh;
    rim.geometry.computeBoundingBox();
    expect(defined(rim.geometry.boundingBox).max.y).toBeCloseTo(110, 1);
  });

  it("one caller aborting does not fail the other, and the download goes on", async () => {
    let release: (response: unknown) => void = () => undefined;
    const fetchMock = vi.fn(() => new Promise((resolve) => (release = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    const quitter = new AbortController();
    const first = rejection(loadGlb("/c3.glb", { signal: quitter.signal }));
    const second = loadGlb("/c3.glb");
    await new Promise((resolve) => setTimeout(resolve, 20));
    quitter.abort();
    expect((await first).code).toBe("ABORTED");
    release(okResponse(sampleBytes()));
    expect((await second).getObjectByName("rim")).toBeInstanceOf(Mesh);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("an aborted load is not remembered: the next call joins the running download", async () => {
    let release: (response: unknown) => void = () => undefined;
    const fetchMock = vi.fn(() => new Promise((resolve) => (release = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    const quitter = new AbortController();
    const first = rejection(loadGlb("/c4.glb", { signal: quitter.signal }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    quitter.abort();
    expect((await first).code).toBe("ABORTED");
    const again = loadGlb("/c4.glb");
    release(okResponse(sampleBytes()));
    expect((await again).getObjectByName("rim")).toBeInstanceOf(Mesh);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("remembers a 404 for 60 s, then tries again", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);
    const first = await rejection(loadGlb("/c5.glb"));
    expect(first.reason).toBe("http");
    const second = await rejection(loadGlb("/c5.glb"));
    expect([second.code, second.reason, second.message]).toEqual([
      "LOAD_FAILED",
      "http",
      first.message,
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_001);
    fetchMock.mockResolvedValue(okResponse(sampleBytes()));
    const root = await loadGlb("/c5.glb");
    expect(root.getObjectByName("rim")).toBeInstanceOf(Mesh);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("remembers a timeout too, with the same reason", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const fetchMock = vi.fn(() => new Promise(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    const first = rejection(loadGlb("/c6.glb"));
    await vi.advanceTimersByTimeAsync(15_001);
    expect((await first).reason).toBe("timeout");
    const second = await rejection(loadGlb("/c6.glb"));
    expect(second.reason).toBe("timeout");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the last 4 URLs: the fifth evicts the first", async () => {
    const bytes = sampleBytes();
    const fetchMock = vi.fn().mockResolvedValue(okResponse(bytes));
    vi.stubGlobal("fetch", fetchMock);
    for (const n of [1, 2, 3, 4, 5]) await loadGlb(`/lru-${n}.glb`);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    await loadGlb("/lru-5.glb");
    await loadGlb("/lru-2.glb");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    await loadGlb("/lru-1.glb");
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("does not touch an ArrayBuffer source", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const bytes = sampleBytes();
    await loadGlb(bytes);
    await loadGlb(bytes);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
