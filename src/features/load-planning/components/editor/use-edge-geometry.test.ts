import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BufferGeometry } from "three";

import { useEdgeGeometry } from "./use-edge-geometry";

afterEach(() => vi.restoreAllMocks());

describe("useEdgeGeometry (R3F does not dispose geometry we create ourselves)", () => {
  it("builds one position attribute per call and disposes the old geometry when the data changes and on unmount", () => {
    const dispose = vi.spyOn(BufferGeometry.prototype, "dispose");
    const first = new Float32Array(72);
    const second = new Float32Array(144);
    const { result, rerender, unmount } = renderHook(({ data }) => useEdgeGeometry(data), {
      initialProps: { data: first },
    });
    const before = result.current;
    expect(before.getAttribute("position").count).toBe(24);
    expect(dispose).not.toHaveBeenCalled();
    rerender({ data: second });
    expect(result.current).not.toBe(before);
    expect(result.current.getAttribute("position").count).toBe(48);
    expect(dispose).toHaveBeenCalledTimes(1);
    unmount();
    expect(dispose).toHaveBeenCalledTimes(2);
  });

  it("keeps the same geometry while the data is the same array", () => {
    const data = new Float32Array(72);
    const { result, rerender } = renderHook(() => useEdgeGeometry(data));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
