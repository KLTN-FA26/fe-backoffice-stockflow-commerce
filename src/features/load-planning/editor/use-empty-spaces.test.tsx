import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useEmptySpaces } from "./use-empty-spaces";

import type { EmptySpaceJob } from "./use-empty-spaces";

const EXTENT = { wMm: 1000, hMm: 1000, dMm: 1000 };
const job = (obstacles: EmptySpaceJob["obstacles"] = []): EmptySpaceJob => ({
  extent: EXTENT,
  obstacles,
});

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  posted: { id: number }[] = [];
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(request: { id: number }) {
    this.posted.push(request);
  }
  terminate() {
    this.terminated = true;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.instances = [];
});

describe("useEmptySpaces without a Worker (jsdom fallback)", () => {
  it("reports computing, then the spaces of the current job", async () => {
    const first = job();
    const { result } = renderHook(({ j }) => useEmptySpaces(j), { initialProps: { j: first } });
    expect(result.current).toEqual({ spaces: null, computing: true });
    await waitFor(() => expect(result.current.computing).toBe(false));
    expect(result.current.spaces).toHaveLength(1);
  });

  it("does nothing without a job and drops the old result when the job changes", async () => {
    const { result, rerender } = renderHook(({ j }) => useEmptySpaces(j), {
      initialProps: { j: null as EmptySpaceJob | null },
    });
    expect(result.current).toEqual({ spaces: null, computing: false });
    rerender({ j: job() });
    await waitFor(() => expect(result.current.spaces).not.toBeNull());
    rerender({ j: job([{ xMm: 0, yMm: 0, zMm: 0, wMm: 500, hMm: 1000, dMm: 1000 }]) });
    expect(result.current.spaces).toBeNull();
    expect(result.current.computing).toBe(true);
    await waitFor(() => expect(result.current.computing).toBe(false));
  });
});

describe("useEmptySpaces with a Worker", () => {
  it("posts the job off the main thread, ignores a late answer for an older job and terminates on unmount", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const { result, rerender, unmount } = renderHook(({ j }) => useEmptySpaces(j), {
      initialProps: { j: job() },
    });
    await waitFor(() => expect(FakeWorker.instances[0].posted).toHaveLength(1));
    const worker = FakeWorker.instances[0];
    const second = job([{ xMm: 0, yMm: 0, zMm: 0, wMm: 500, hMm: 1000, dMm: 1000 }]);
    rerender({ j: second });
    await waitFor(() => expect(worker.posted).toHaveLength(2));
    // the answer to the FIRST request arrives late: must be ignored
    act(() => worker.onmessage?.({ data: { id: worker.posted[0].id, spaces: [] } }));
    expect(result.current.spaces).toBeNull();
    const spaces = [{ id: "s", xMm: 0, yMm: 0, zMm: 0, wMm: 1, hMm: 1, dMm: 1 }];
    act(() => worker.onmessage?.({ data: { id: worker.posted[1].id, spaces } }));
    expect(result.current).toEqual({ spaces, computing: false });
    unmount();
    expect(worker.terminated).toBe(true);
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("falls back to computing on the main thread when the worker fails", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const stable = job();
    const { result } = renderHook(() => useEmptySpaces(stable));
    await waitFor(() => expect(FakeWorker.instances[0].posted).toHaveLength(1));
    act(() => FakeWorker.instances[0].onerror?.());
    expect(FakeWorker.instances[0].terminated).toBe(true);
    await waitFor(() => expect(result.current.computing).toBe(false));
    expect(result.current.spaces).toHaveLength(1);
  });
});
