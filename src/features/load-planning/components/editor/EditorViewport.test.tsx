import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LOAD_PLANNING_LIMITS, UI_LABELS } from "@/constants";

import { gridBlock } from "../../__fixtures__/build";
import { editorState, layoutOne, vehicleOf, BOX } from "../../__fixtures__/editor";
import { buildColorMap } from "../../lib/palette";

import { EditorViewport } from "./EditorViewport";

/** jsdom không có WebGL: kiểm lớp DOM bao quanh và những gì truyền vào Canvas; hình học cảnh ở `lib/editor-scene.test.ts`. */
const canvas = vi.hoisted(() => ({
  last: null as null | { camera?: { position: number[] }; onPointerMissed?: () => void },
}));
vi.mock("@react-three/fiber", () => ({
  Canvas: (props: { camera?: { position: number[] }; onPointerMissed?: () => void }) => {
    canvas.last = props;
    return <div data-testid="canvas" />;
  },
  useThree: () => ({}),
}));
vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: () => {} }),
}));
vi.mock("@react-three/drei", () => ({
  Edges: () => null,
  Html: () => null,
  OrbitControls: () => null,
}));

const E = UI_LABELS.loadPlan.editor;
const props = {
  colorMap: buildColorMap(["Thùng BOX"]),
  tones: new Map<string, "idle">(),
  ghosts: [],
  emptySpaces: null,
  onBoxPick: vi.fn(),
  onGhostPlace: vi.fn(),
  onBackgroundClick: vi.fn(),
};

describe("EditorViewport", () => {
  it("renders a labelled group with the view buttons and a canvas framed from the vehicle size", () => {
    render(<EditorViewport {...props} vehicle={vehicleOf(layoutOne)} />);
    expect(screen.getByRole("group", { name: E.viewport.aria("TRUCK-A") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cửa" })).toBeInTheDocument();
    // longest side = 10 world units; camera at 1.35 × that
    expect(canvas.last?.camera?.position[0]).toBeCloseTo(13.5, 6);
  });

  it("a click on empty space (pointer missed) clears the selection", () => {
    render(<EditorViewport {...props} vehicle={vehicleOf(layoutOne)} />);
    canvas.last?.onPointerMissed?.();
    expect(props.onBackgroundClick).toHaveBeenCalledTimes(1);
  });

  it("builds a scene for far more boxes than the viewer's 600-box cap without trimming or warning", () => {
    const many = gridBlock({
      carton: { ...BOX, origMm: { l: 100, w: 100, h: 100 } },
      origin: { xMm: 0, yMm: 0, zMm: 0 },
      counts: { nx: 10, ny: 10, nz: 10 },
    });
    expect(many.length).toBeGreaterThan(LOAD_PLANNING_LIMITS.renderBoxesMax - 1);
    const big = {
      ...editorState().vehicles[0],
      boxes: [...many, ...many.map((b) => ({ ...b, ref: `${b.ref}-2`, zMm: b.zMm + 1000 }))],
    };
    expect(big.boxes).toHaveLength(2000);
    render(<EditorViewport {...props} vehicle={big} />);
    expect(screen.queryByText(/chỉ dựng/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });
});
