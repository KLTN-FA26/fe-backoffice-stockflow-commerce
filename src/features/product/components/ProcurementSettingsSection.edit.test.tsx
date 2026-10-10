import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readMockSkuProcurementSettings } from "../procurement-settings/mock-fixtures";
import * as service from "../procurement-settings/service";
import { ProcurementSettingsSection } from "./ProcurementSettingsSection";

import type { SkuProcurementSettingsView } from "../procurement-settings/view-model";

function setup() {
  const user = userEvent.setup();
  const settings = readMockSkuProcurementSettings("SKU-001-BLK-L");
  render(<ProcurementSettingsSection settings={settings} isMock />);
  return { user, settings };
}

async function edit() {
  const context = setup();
  await context.user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
  return context;
}

describe("procurement settings editing", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("never presents or saves Inventory Control's reorder point", async () => {
    const save = vi
      .spyOn(service, "saveProcurementSettings")
      .mockImplementation(async (value) => value);
    const { user, settings } = setup();
    expect(settings).not.toHaveProperty("reorderPoint");
    expect(screen.queryByText("Điểm đặt hàng lại")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    expect(screen.queryByLabelText("Điểm đặt hàng lại")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Mã hàng NCC · 1"), "SKU-001-BLK-L");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).not.toHaveProperty("reorderPoint");
  });

  it("starts read-only and explicitly enters edit mode", async () => {
    const { user } = setup();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    expect(screen.getByRole("spinbutton", { name: "MOQ · 1" })).toHaveValue(null);
    expect(screen.getByRole("button", { name: "Lưu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Huỷ" })).toBeInTheDocument();
  });

  it("edits every visible field and saves through the service", async () => {
    const save = vi
      .spyOn(service, "saveProcurementSettings")
      .mockImplementation(async (value) => value);
    const { user } = await edit();
    await user.selectOptions(screen.getByLabelText("Nhà cung cấp mặc định"), "SUP-003");
    await user.selectOptions(screen.getByLabelText("Nhà cung cấp · 1"), "SUP-002");
    await user.type(screen.getByLabelText("Mã hàng NCC · 1"), "SKU-001-BLK-L");
    await user.type(screen.getByLabelText("Thời gian giao · 1"), "5");
    await user.type(screen.getByLabelText("MOQ · 1"), "3");
    await user.type(screen.getByLabelText("Bội số đặt hàng · 1"), "2");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument(),
    );
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultSupplierId: "SUP-003",
        suppliers: expect.arrayContaining([
          expect.objectContaining({
            supplierId: "SUP-002",
            supplierItemCode: "SKU-001-BLK-L",
            leadTimeDays: 5,
            moq: 3,
            orderMultiple: 2,
          }),
        ]),
      }),
      true,
    );
    expect(screen.getByText("5 ngày")).toBeInTheDocument();
  });

  it("cancel restores the last successful save, not the initial fixture", async () => {
    vi.spyOn(service, "saveProcurementSettings").mockImplementation(async (value) => value);
    const { user } = await edit();
    const field = screen.getByLabelText("MOQ · 1");
    await user.clear(field);
    await user.type(field, "75");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    await user.click(await screen.findByRole("button", { name: "Chỉnh sửa" }));
    await user.clear(screen.getByLabelText("MOQ · 1"));
    await user.type(screen.getByLabelText("MOQ · 1"), "90");
    await user.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(screen.getByText("75")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    expect(screen.getByLabelText("MOQ · 1")).toHaveValue(75);
  });

  it("disables inputs and actions while saving and prevents duplicate submissions", async () => {
    let finish: ((value: SkuProcurementSettingsView) => void) | undefined;
    const save = vi.spyOn(service, "saveProcurementSettings").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { user, settings } = await edit();
    await user.dblClick(screen.getByRole("button", { name: "Lưu" }));
    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Huỷ" })).toBeDisabled();
    expect(screen.getByLabelText("MOQ · 1")).toBeDisabled();
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish?.(settings);
    });
    expect(screen.getByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument();
  });

  it("preserves the draft on failure and lets the user retry", async () => {
    const save = vi
      .spyOn(service, "saveProcurementSettings")
      .mockRejectedValueOnce(new Error("Không thể lưu dữ liệu minh hoạ"))
      .mockImplementation(async (value) => value);
    const { user } = await edit();
    await user.type(screen.getByLabelText("Mã hàng NCC · 1"), "SKU-001-BLK-L");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể lưu dữ liệu minh hoạ");
    expect(screen.getByLabelText("Mã hàng NCC · 1")).toHaveValue("SKU-001-BLK-L");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("allows an unmapped default supplier without changing mappings", async () => {
    const save = vi
      .spyOn(service, "saveProcurementSettings")
      .mockImplementation(async (value) => value);
    const { user, settings } = await edit();
    await user.selectOptions(screen.getByLabelText("Nhà cung cấp mặc định"), "SUP-003");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ defaultSupplierId: "SUP-003", suppliers: settings.suppliers }),
        true,
      ),
    );
  });

  it("keeps missing item lead time empty and does not substitute supplier lead time", async () => {
    const save = vi
      .spyOn(service, "saveProcurementSettings")
      .mockImplementation(async (value) => value);
    const { user } = await edit();
    expect(screen.getByLabelText("Thời gian giao · 1")).toHaveValue(null);
    await user.selectOptions(screen.getByLabelText("Nhà cung cấp · 1"), "SUP-002");
    expect(screen.getByLabelText("Thời gian giao · 1")).toHaveValue(null);
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        suppliers: expect.arrayContaining([expect.objectContaining({ leadTimeDays: null })]),
      }),
      true,
    );
  });

  it("saves order multiple independently of MOQ without rounding or pack-size fields", async () => {
    const save = vi
      .spyOn(service, "saveProcurementSettings")
      .mockImplementation(async (value) => value);
    const { user } = await edit();
    await user.type(screen.getByLabelText("MOQ · 1"), "3");
    await user.type(screen.getByLabelText("Bội số đặt hàng · 1"), "2.5");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        suppliers: expect.arrayContaining([
          expect.objectContaining({ moq: 3, orderMultiple: 2.5 }),
        ]),
      }),
      true,
    );
    expect(save.mock.calls[0]?.[0].suppliers[0]).not.toHaveProperty("packSize");
  });

  it("rejects negative quantities without losing draft values", async () => {
    const save = vi.spyOn(service, "saveProcurementSettings");
    const { user } = await edit();
    await user.type(screen.getByLabelText("MOQ · 1"), "-1");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Số không âm hợp lệ");
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByLabelText("MOQ · 1")).toHaveValue(-1);
  });
});
