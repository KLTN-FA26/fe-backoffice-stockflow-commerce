import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { usePanZoom } from "./use-pan-zoom";

const mount = (hand = false) => {
  const hook = renderHook(({ on }) => usePanZoom({ hand: on }), { initialProps: { on: hand } });
  // Gắn khung cuộn giả để zoom có chỗ neo, render lại để effect gắn listener `wheel`
  act(() => {
    hook.result.current.ref.current = document.createElement("div");
  });
  hook.rerender({ on: hand });
  return hook;
};

describe("zoom / kéo bản đồ (chung cho xem và sửa)", () => {
  it("nút + − 0: zoom theo bước, không vượt giới hạn, 0 về vừa khung", () => {
    const { result } = mount();
    expect(result.current.controls.canOut).toBe(false);
    act(() => result.current.controls.onIn());
    expect(result.current.zoom).toBeCloseTo(LIMITS.zoomStep);
    for (let i = 0; i < 20; i += 1) act(() => result.current.controls.onIn());
    expect(result.current.zoom).toBe(LIMITS.zoomMax);
    expect(result.current.controls.canIn).toBe(false);
    act(() => result.current.controls.onReset());
    expect(result.current.zoom).toBe(LIMITS.zoomMin);
  });

  it("lăn chuột thường không zoom (vẫn cuộn); Ctrl + lăn mới zoom", () => {
    const { result } = mount();
    const el = result.current.ref.current;
    if (!el) throw new Error("thiếu khung");
    act(() => {
      el.dispatchEvent(new WheelEvent("wheel", { deltaY: -200, cancelable: true }));
    });
    expect(result.current.zoom).toBe(LIMITS.zoomMin);
    act(() => {
      el.dispatchEvent(new WheelEvent("wheel", { deltaY: -200, ctrlKey: true, cancelable: true }));
    });
    expect(result.current.zoom).toBeGreaterThan(LIMITS.zoomMin);
  });

  it("giữ Ctrl hoặc bật công cụ bàn tay → chế độ kéo (con trỏ bàn tay)", () => {
    const { result } = mount();
    expect(result.current.panMode).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control", ctrlKey: true }));
    });
    expect(result.current.panMode).toBe(true);
    expect(result.current.cursorClass).toBe("cursor-grab");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Control", ctrlKey: false }));
    });
    expect(result.current.panMode).toBe(false);
    expect(mount(true).result.current.panMode).toBe(true);
  });
});
