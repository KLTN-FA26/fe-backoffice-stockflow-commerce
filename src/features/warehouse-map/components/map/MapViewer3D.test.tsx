import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LAYOUT } from "@/features/warehouse-map/__fixtures__/layout";

import { MapViewer3D } from "./MapViewer3D";

// Cảnh three.js thật không chạy trong jsdom — chỉ kiểm cổng WebGL của viewer
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="scene" /> }));
// Không có WebGL → viewer hiện bản đồ 2D dự phòng (đo khung bằng ResizeObserver)
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

describe("MapViewer3D — kiểm WebGL", () => {
  it("render lại nhiều lần (mở / đóng modal) không tạo thêm WebGL context", () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => null);
    const props = {
      layout: LAYOUT,
      selectedId: null,
      onSelect: () => {},
      onOpenDetail: () => {},
      controls: { fullscreen: { active: false, onToggle: () => {} } },
    };
    const { rerender } = render(<MapViewer3D {...props} />);
    for (let i = 0; i < 5; i += 1) rerender(<MapViewer3D {...props} selectedId={`shelf-${i}`} />);
    // Một lần kiểm: thử webgl2 rồi webgl — không phải mỗi lần render
    expect(getContext.mock.calls.length).toBeLessThanOrEqual(2);
    getContext.mockRestore();
  });
});
