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
      <ProcurementSettingsSection
        settings={readSkuProcurementSettingsView(skuId, 60, true)}
        isMock
      />,
    );
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    await user.clear(screen.getByLabelText("Điểm đặt hàng lại"));
    await user.type(screen.getByLabelText("Điểm đặt hàng lại"), "75");
    await user.selectOptions(screen.getByLabelText("Nhà cung cấp mặc định"), "SUP-003");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument();
    view.unmount();
    render(
      <ProcurementSettingsSection
        settings={readSkuProcurementSettingsView(skuId, 60, true)}
        isMock
      />,
    );
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText("Công ty CP Gốm sứ Minh Long")).toBeInTheDocument();
    expect(screen.getByText("Chưa có nhà cung cấp liên kết")).toBeInTheDocument();
  });

  it("does not offer mock editing when real mode has no contract", () => {
    render(
      <ProcurementSettingsSection
        settings={readSkuProcurementSettingsView("SKU-001-BLK-L", 60, false)}
        isMock={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });
});
