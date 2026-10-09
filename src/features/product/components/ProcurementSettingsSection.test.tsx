import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ADMIN_ROUTES } from "@/constants";

import { readMockSkuProcurementSettings } from "../procurement-settings/mock-fixtures";
import { ProcurementSettingsSection } from "./ProcurementSettingsSection";

describe("ProcurementSettingsSection", () => {
  it("shows the SKU's illustrative mapped suppliers and all requested fields", () => {
    const settings = readMockSkuProcurementSettings("SKU-001-BLK-L", 60);
    render(<ProcurementSettingsSection settings={settings} isMock />);

    expect(screen.getByRole("heading", { name: "Cài đặt mua hàng" })).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("Dữ liệu minh hoạ · Chỉ xem")).toBeInTheDocument();
    expect(screen.getByText("Nhà cung cấp mặc định")).toBeInTheDocument();
    expect(screen.getAllByText("Công ty TNHH Dệt may Thành Công")).toHaveLength(2);
    for (const heading of ["Mã hàng NCC", "Thời gian giao", "MOQ", "Bội số đặt hàng"]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getAllByText("Chưa có dữ liệu")).toHaveLength(8);
    expect(screen.getByRole("link", { name: "Công ty TNHH Dệt may Thành Công" })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.suppliers.detail("SUP-001"),
    );
    expect(screen.getByRole("link", { name: "Công ty TNHH May mặc Việt Thắng" })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.suppliers.detail("SUP-004"),
    );
    expect(screen.queryByRole("button", { name: /Lưu|Chỉnh sửa/ })).not.toBeInTheDocument();
  });

  it("shows an empty state for an SKU without a mock mapping", () => {
    render(
      <ProcurementSettingsSection
        settings={readMockSkuProcurementSettings("SKU-001-BLK-M", 60)}
        isMock
      />,
    );

    expect(screen.getByText("Chưa có nhà cung cấp liên kết")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
  });
});
