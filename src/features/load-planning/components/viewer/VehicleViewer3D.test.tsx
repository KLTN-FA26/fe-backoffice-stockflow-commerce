import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LOAD_PLANNING_LIMITS } from "@/constants";

import { gridBlock, makeLayout } from "../../__fixtures__/build";
import { LAYOUT_40HC } from "../../__fixtures__/layouts";

import { VehicleViewer3D } from "./VehicleViewer3D";

/**
 * jsdom không có WebGL nên Canvas của react-three-fiber không dựng được. Repo chưa có mẫu test 3D,
 * nên mock fiber/drei ở mức tối thiểu: kiểm lớp DOM bao quanh (nhãn truy cập, nút góc nhìn, cảnh
 * báo cắt bớt) và việc dựng cảnh không ném lỗi. Hình học cảnh được test ở `lib/scene.test.ts`.
 */
const canvasProps = vi.hoisted(() => ({
  last: null as null | { camera?: { position: number[] } },
}));

vi.mock("@react-three/fiber", () => ({
  Canvas: (props: { camera?: { position: number[] } }) => {
    canvasProps.last = props;
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

describe("VehicleViewer3D", () => {
  it("renders a labelled region with the view buttons and a canvas", () => {
    render(<VehicleViewer3D layout={LAYOUT_40HC} />);
    expect(screen.getByRole("group", { name: "Mô hình 3D xe 40HC" })).toBeInTheDocument();
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chéo" })).toBeInTheDocument();
  });

  it("frames the camera from the vehicle size (1.35 × the longest side, 10 units)", () => {
    render(<VehicleViewer3D layout={LAYOUT_40HC} />);
    expect(canvasProps.last?.camera?.position[0]).toBeCloseTo(13.5, 6);
  });

  it("keeps working when a view button is clicked", async () => {
    render(<VehicleViewer3D layout={LAYOUT_40HC} />);
    await userEvent.click(screen.getByRole("button", { name: "Bên" }));
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("does not warn about truncation for a normal load", () => {
    render(<VehicleViewer3D layout={LAYOUT_40HC} />);
    expect(screen.queryByText(/chỉ dựng/i)).not.toBeInTheDocument();
  });

  it("warns, instead of silently hiding boxes, when the load exceeds the draw limit", () => {
    const max = LOAD_PLANNING_LIMITS.renderBoxesMax;
    const boxes = gridBlock({
      carton: {
        ref: "R",
        label: "L",
        partName: "P",
        origMm: { l: 100, w: 100, h: 100 },
        weightKg: 1,
      },
      origin: { xMm: 0, yMm: 0, zMm: 0 },
      counts: { nx: 1, ny: 1, nz: max + 40 },
    });
    const layout = makeLayout({
      seq: 1,
      code: "BIG",
      innerMm: { l: 20000, w: 2000, h: 2000 },
      maxPayloadKg: 1,
      boxes,
    });
    render(<VehicleViewer3D layout={layout} />);
    expect(screen.getByText(`Khung 3D chỉ dựng ${max}/${max + 40} kiện.`)).toBeInTheDocument();
  });

  it("applies the requested height", () => {
    render(<VehicleViewer3D layout={LAYOUT_40HC} heightPx={480} />);
    expect(screen.getByRole("group", { name: "Mô hình 3D xe 40HC" })).toHaveStyle({
      height: "480px",
    });
  });
});
