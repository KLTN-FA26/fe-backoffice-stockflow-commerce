import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readMockSkuProcurementSettings } from "../procurement-settings/mock-fixtures";
import * as service from "../procurement-settings/service";
import { ProcurementSettingsSection } from "./ProcurementSettingsSection";

afterEach(() => vi.restoreAllMocks());

async function setup() {
  const user = userEvent.setup();
  const settings = readMockSkuProcurementSettings("SKU-001-BLK-L");
  const save = vi
    .spyOn(service, "saveProcurementSettings")
    .mockImplementation(async (value) => value);
  render(<ProcurementSettingsSection settings={settings} isMock />);
  await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
  return { user, save, settings };
}

describe("procurement supplier mapping integrity", () => {
  it.each([
    ["Nhà cung cấp · 1", "SUP-004"],
    ["Nhà cung cấp · 2", "SUP-001"],
  ])(
    "rejects duplicate selection in %s without mutating the other row",
    async (label, supplierId) => {
      const { user, save } = await setup();
      await user.selectOptions(screen.getByRole("combobox", { name: label }), supplierId);
      await user.click(screen.getByRole("button", { name: "Lưu" }));
      const errors = await screen.findAllByRole("alert");
      expect(errors).toHaveLength(2);
      for (const error of errors)
        expect(error).toHaveTextContent("Nhà cung cấp đã được chọn ở dòng khác");
      expect(screen.getByRole("combobox", { name: "Nhà cung cấp · 1" })).toHaveValue(supplierId);
      expect(screen.getByRole("combobox", { name: "Nhà cung cấp · 2" })).toHaveValue(supplierId);
      expect(save).not.toHaveBeenCalled();
    },
  );

  it("keeps each row's existing supplier selectable and accepts it on save", async () => {
    const { user, save, settings } = await setup();
    for (const [index, supplier] of settings.suppliers.entries()) {
      const select = screen.getByRole("combobox", { name: `Nhà cung cấp · ${index + 1}` });
      expect(
        within(select).getByRole("option", { name: supplier.supplierName }),
      ).not.toBeDisabled();
      await user.selectOptions(select, supplier.supplierId);
    }
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(settings, true);
  });

  it("saves distinct suppliers after correcting a duplicate without changing the default", async () => {
    const { user, save } = await setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "Nhà cung cấp · 1" }), "SUP-004");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    await user.selectOptions(screen.getByRole("combobox", { name: "Nhà cung cấp · 1" }), "SUP-002");
    await user.selectOptions(screen.getByRole("combobox", { name: "Nhà cung cấp · 2" }), "SUP-003");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultSupplierId: "SUP-001",
        suppliers: [
          expect.objectContaining({ supplierId: "SUP-002" }),
          expect.objectContaining({ supplierId: "SUP-003" }),
        ],
      }),
      true,
    );
  });

  it("cancels a duplicate draft back to the accepted mappings", async () => {
    const { user, save } = await setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "Nhà cung cấp · 1" }), "SUP-004");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Huỷ" }));
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    expect(screen.getByRole("combobox", { name: "Nhà cung cấp · 1" })).toHaveValue("SUP-001");
    expect(screen.getByRole("combobox", { name: "Nhà cung cấp · 2" })).toHaveValue("SUP-004");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it("preserves corrected supplier selections on service failure and retries normally", async () => {
    const { user, save } = await setup();
    save.mockRejectedValueOnce(new Error("Không thể lưu dữ liệu minh hoạ"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Nhà cung cấp · 1" }), "SUP-004");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    expect(save).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByRole("combobox", { name: "Nhà cung cấp · 1" }), "SUP-002");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể lưu dữ liệu minh hoạ");
    expect(screen.getByRole("combobox", { name: "Nhà cung cấp · 1" })).toHaveValue("SUP-002");
    expect(screen.getByRole("combobox", { name: "Nhà cung cấp · 2" })).toHaveValue("SUP-004");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(2);
  });
});
