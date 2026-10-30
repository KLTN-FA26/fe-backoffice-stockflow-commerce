import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { LAYOUT } from "@/features/warehouse-map/__fixtures__/layout";

import { MapFrame } from "../shared/MapFrame";
import { MapCanvas2D } from "./MapCanvas2D";
import { PlaceDetailDialog } from "./PlaceDetailDialog";

beforeAll(() => {
  // jsdom không có ResizeObserver mà tooltip (Radix) của thanh zoom dùng khi mở
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const CONTROLS = { fullscreen: { active: false, onToggle: () => {} } };

describe("bản đồ 2D", () => {
  it("vẽ mọi kệ và khu vực thành nút chọn được, có nhãn trạng thái hiệu lực", () => {
    render(
      <MapCanvas2D layout={LAYOUT} selectedId={null} onSelect={() => {}} controls={CONTROLS} />,
    );
    expect(
      screen.getByRole("group", { name: /Bản đồ 2D kho Kho Hồ Chí Minh/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kệ A01 — Đang dùng/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kệ Z99 — Ngừng dùng/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Khu vực RCV01 Khu nhận hàng/ })).toBeInTheDocument();
  });

  it("chọn bằng chuột lẫn bàn phím (Enter) — Mode A không cần chuột", async () => {
    const onSelect = vi.fn();
    render(
      <MapCanvas2D layout={LAYOUT} selectedId={null} onSelect={onSelect} controls={CONTROLS} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Kệ A01/ }));
    expect(onSelect).toHaveBeenLastCalledWith("shelf-a01");
    screen.getByRole("button", { name: /Khu vực RCV01/ }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("area-rcv");
  });

  it("thanh zoom nổi dọc: nút thu nhỏ khoá ở mức nhỏ nhất", async () => {
    render(
      <MapCanvas2D layout={LAYOUT} selectedId={null} onSelect={() => {}} controls={CONTROLS} />,
    );
    expect(screen.getByRole("toolbar", { name: "Điều khiển bản đồ" })).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
    expect(screen.getByRole("button", { name: /^Thu nhỏ/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /^Phóng to/ }));
    expect(screen.getByRole("button", { name: /^Thu nhỏ/ })).toBeEnabled();
    // Phím tắt: 0 về vừa khung
    await userEvent.keyboard("0");
    expect(screen.getByRole("button", { name: /^Thu nhỏ/ })).toBeDisabled();
  });
});

describe("khung bản đồ: toàn màn hình + chú giải trong modal", () => {
  const renderFrame = () =>
    render(
      <MapFrame layout={LAYOUT}>
        {(controls) => (
          <MapCanvas2D layout={LAYOUT} selectedId={null} onSelect={() => {}} controls={controls} />
        )}
      </MapFrame>,
    );

  it("nút toàn màn hình phủ kín khung bản đồ; bấm lại thì thoát", async () => {
    const { container } = renderFrame();
    const frame = container.querySelector("[data-fullscreen]");
    expect(frame).toHaveAttribute("data-fullscreen", "false");
    await userEvent.click(screen.getByRole("button", { name: /^Xem toàn màn hình/ }));
    expect(frame).toHaveAttribute("data-fullscreen", "true");
    expect(frame).toHaveClass("fixed");
    await userEvent.click(screen.getByRole("button", { name: /Thoát toàn màn hình/ }));
    expect(frame).toHaveAttribute("data-fullscreen", "false");
  });

  it("toàn màn hình: thanh công cụ của trang vào trong khung (không bị lớp phủ che)", async () => {
    const { container } = render(
      <MapFrame layout={LAYOUT} toolbar={<p>Thanh công cụ</p>}>
        {(controls) => (
          <MapCanvas2D layout={LAYOUT} selectedId={null} onSelect={() => {}} controls={controls} />
        )}
      </MapFrame>,
    );
    const frame = () => container.querySelector("[data-fullscreen]");
    expect(frame()).not.toContainElement(screen.getByText("Thanh công cụ"));
    await userEvent.click(screen.getByRole("button", { name: /^Xem toàn màn hình/ }));
    expect(frame()).toContainElement(screen.getByText("Thanh công cụ"));
  });

  it('chú giải, số liệu và nhãn BR-05 nằm trong modal "?" thay vì chiếm chỗ trên trang', async () => {
    renderFrame();
    expect(screen.queryByText(/chỉ mang tính trực quan/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Chú giải/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Bin dùng được");
    expect(dialog).toHaveTextContent(/chỉ mang tính trực quan/);
    expect(dialog).toHaveTextContent("Ctrl+Z");
  });

  it("phím F bật toàn màn hình, ? mở chú giải", async () => {
    const { container } = renderFrame();
    await userEvent.keyboard("f");
    expect(container.querySelector("[data-fullscreen]")).toHaveAttribute("data-fullscreen", "true");
    await userEvent.keyboard("?");
    expect(screen.getByRole("dialog")).toHaveTextContent("Phím tắt — chế độ sửa");
  });
});

describe("modal chi tiết kệ", () => {
  it("hiện zone, mặt lấy hàng và mã vị trí đầy đủ của từng bin theo tầng", () => {
    const shelf = LAYOUT.shelves[0];
    if (!shelf) throw new Error("fixture thiếu kệ");
    render(
      <PlaceDetailDialog
        place={{ kind: "shelf", shelf }}
        zones={LAYOUT.zones}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("A01 · Kệ A01");
    // Không làm mờ nền: backdrop-filter mờ dần đè lên SVG bản đồ làm Chrome chớp khối đen
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass(
      "supports-backdrop-filter:backdrop-blur-none",
    );
    expect(screen.getByText("Khu A - Sofa")).toBeInTheDocument();
    expect(screen.getByText("Nam")).toBeInTheDocument();
    expect(screen.getByText("HCM-A01-1-A")).toBeInTheDocument();
    expect(screen.getByText("HCM-A01-2-A")).toBeInTheDocument();
    // Không truyền `statusAction` (thiếu quyền) → không có nút đổi trạng thái
    expect(screen.queryByRole("button", { name: "Đổi trạng thái" })).not.toBeInTheDocument();
  });
});
