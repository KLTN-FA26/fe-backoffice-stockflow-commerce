import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LAYOUT } from "@/features/warehouse-map/__fixtures__/layout";

import { MapCanvas2D } from "./MapCanvas2D";
import { PlaceDetailPanel } from "./PlaceDetailPanel";

describe("bản đồ 2D", () => {
  it("vẽ mọi kệ và khu vực thành nút chọn được, có nhãn trạng thái hiệu lực", () => {
    render(<MapCanvas2D layout={LAYOUT} selectedId={null} onSelect={() => {}} />);
    expect(
      screen.getByRole("group", { name: /Bản đồ 2D kho Kho Hồ Chí Minh/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kệ A01 — Đang dùng/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kệ Z99 — Ngừng dùng/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Khu vực RCV01 Khu nhận hàng/ })).toBeInTheDocument();
  });

  it("chọn bằng chuột lẫn bàn phím (Enter) — Mode A không cần chuột", async () => {
    const onSelect = vi.fn();
    render(<MapCanvas2D layout={LAYOUT} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /Kệ A01/ }));
    expect(onSelect).toHaveBeenLastCalledWith("shelf-a01");
    screen.getByRole("button", { name: /Khu vực RCV01/ }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("area-rcv");
  });

  it("phóng to / thu nhỏ: nút thu nhỏ khoá ở mức nhỏ nhất", async () => {
    render(<MapCanvas2D layout={LAYOUT} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Thu nhỏ" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Phóng to" }));
    expect(screen.getByRole("button", { name: "Thu nhỏ" })).toBeEnabled();
  });
});

describe("panel chi tiết kệ", () => {
  it("hiện zone, mặt lấy hàng và mã vị trí đầy đủ của từng bin theo tầng", () => {
    const shelf = LAYOUT.shelves[0];
    if (!shelf) throw new Error("fixture thiếu kệ");
    render(
      <PlaceDetailPanel place={{ kind: "shelf", shelf }} zones={LAYOUT.zones} onClose={() => {}} />,
    );
    expect(screen.getByText("Khu A - Sofa")).toBeInTheDocument();
    expect(screen.getByText("Nam")).toBeInTheDocument();
    expect(screen.getByText("HCM-A01-1-A")).toBeInTheDocument();
    expect(screen.getByText("HCM-A01-2-A")).toBeInTheDocument();
    // Không truyền `statusAction` (thiếu quyền) → không có nút đổi trạng thái
    expect(screen.queryByRole("button", { name: "Đổi trạng thái" })).not.toBeInTheDocument();
  });
});
