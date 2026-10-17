import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminDashboardPage from "./page";

const mockMode = vi.hoisted(() => ({ isMock: false }));
vi.mock("@/providers/app-providers", () => ({ useIsMock: () => mockMode.isMock }));

beforeEach(() => {
  mockMode.isMock = false;
});

describe("dashboard — widget Đề xuất nhập hàng", () => {
  it("không hiện khi nối BE thật: BE chưa có API đề xuất nhập hàng, widget chỉ có dữ liệu mẫu", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByText("Hiệu suất kho hôm nay")).toBeInTheDocument();
    expect(screen.queryByText("Đề xuất nhập hàng")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Xem tất cả/ })).not.toBeInTheDocument();
  });

  it("hiện ở chế độ mock", () => {
    mockMode.isMock = true;
    render(<AdminDashboardPage />);
    expect(screen.getByText("Đề xuất nhập hàng")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Xem tất cả/ })).toHaveAttribute(
      "href",
      "/admin/replenishment",
    );
  });
});
