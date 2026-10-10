import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ADMIN_ROUTES } from "@/constants";

import { readMockSkuProcurementSettings } from "../procurement-settings/mock-fixtures";
import { ProcurementSettingsSection } from "./ProcurementSettingsSection";

describe("ProcurementSettingsSection", () => {
  it("shows the SKU's illustrative mapped suppliers and Procurement-owned fields", () => {
    const settings = readMockSkuProcurementSettings("SKU-001-BLK-L");
    render(<ProcurementSettingsSection settings={settings} isMock />);

    expect(screen.getByRole("heading", { name: "Cài đặt mua hàng" })).toBeInTheDocument();
    expect(screen.queryByText("Điểm đặt hàng lại")).not.toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Lưu" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument();
  });

  it("shows an empty state for an SKU without a mock mapping", () => {
    render(
      <ProcurementSettingsSection
        settings={readMockSkuProcurementSettings("SKU-001-BLK-M")}
        isMock
      />,
    );

    expect(screen.getByText("Chưa có nhà cung cấp liên kết")).toBeInTheDocument();
    expect(screen.queryByText("Điểm đặt hàng lại")).not.toBeInTheDocument();
  });

  it("displays a default supplier reference independently of supplier mappings", () => {
    const settings = {
      ...readMockSkuProcurementSettings("SKU-001-BLK-L"),
      defaultSupplierName: null,
      suppliers: [],
    };
    render(<ProcurementSettingsSection settings={settings} isMock />);

    expect(screen.getByText("SUP-001")).toBeInTheDocument();
    expect(screen.getByText("Chưa có nhà cung cấp liên kết")).toBeInTheDocument();
  });
});
