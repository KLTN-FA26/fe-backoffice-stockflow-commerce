import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { readSkuProcurementSettingsView } from "../procurement-settings/service";
import { ProcurementSettingsSection } from "./ProcurementSettingsSection";

describe("procurement workflow service boundary", () => {
  it("uses the real local service and restores its saved snapshot after remount", async () => {
    const user = userEvent.setup();
    const skuId = "SKU-001-BLK-M";
    const view = render(
      <ProcurementSettingsSection settings={readSkuProcurementSettingsView(skuId, true)} isMock />,
    );
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    await user.selectOptions(screen.getByLabelText("Nhà cung cấp mặc định"), "SUP-003");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument();
    view.unmount();
    render(
      <ProcurementSettingsSection settings={readSkuProcurementSettingsView(skuId, true)} isMock />,
    );
    expect(readSkuProcurementSettingsView(skuId, true)).not.toHaveProperty("reorderPoint");
    expect(screen.getByText("Công ty CP Gốm sứ Minh Long")).toBeInTheDocument();
    expect(screen.getByText("Chưa có nhà cung cấp liên kết")).toBeInTheDocument();
  });

  it("real mode shows the missing contract, not an empty supplier list, and offers no editing", () => {
    render(
      <ProcurementSettingsSection
        isMock={false}
        identity={{
          productId: "11111111-1111-4111-8111-111111111111",
          variantId: "22222222-2222-4222-8222-222222222222",
          sku: "CHAIR-BLUE",
        }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Chưa có dữ liệu mua hàng từ hệ thống");
    expect(screen.queryByText("Chưa có nhà cung cấp liên kết")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("never reads a procurement view outside mock mode", () => {
    expect(() => readSkuProcurementSettingsView("SKU-001-BLK-L", false)).toThrow(
      "Chưa có dữ liệu mua hàng",
    );
  });
});
