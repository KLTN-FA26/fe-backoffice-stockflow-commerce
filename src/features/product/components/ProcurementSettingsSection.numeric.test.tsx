import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readMockSkuProcurementSettings } from "../procurement-settings/mock-fixtures";
import * as service from "../procurement-settings/service";
import { ProcurementSettingsSection } from "./ProcurementSettingsSection";

afterEach(() => vi.restoreAllMocks());

async function setup() {
  const user = userEvent.setup();
  const save = vi
    .spyOn(service, "saveProcurementSettings")
    .mockImplementation(async (value) => value);
  render(
    <ProcurementSettingsSection
      settings={{
        ...readMockSkuProcurementSettings("SKU-001-BLK-L"),
        suppliers: readMockSkuProcurementSettings("SKU-001-BLK-L").suppliers.map((supplier) => ({
          ...supplier,
          leadTimeDays: 7,
          moq: 7,
          orderMultiple: 7,
        })),
      }}
      isMock
    />,
  );
  await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
  return { user, save };
}

describe("procurement numeric submission", () => {
  it.each(["Thời gian giao · 1", "MOQ · 1", "Bội số đặt hàng · 1"])(
    "does not save browser badInput as an unknown value for %s",
    async (label) => {
      const { user, save } = await setup();
      const input = screen.getByRole("spinbutton", { name: label });
      if (!(input instanceof HTMLInputElement)) throw new Error("Expected number input");
      await user.clear(input);
      // jsdom does not emulate Chromium's visible incomplete exponent/overflow text.
      // Both 1e and 1e309 expose value="" with badInput=true in the audited browser.
      const invalid = vi.spyOn(input.validity, "badInput", "get").mockReturnValue(true);
      await user.click(screen.getByRole("button", { name: "Lưu" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Nhập số hợp lệ");
      expect(save).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Huỷ" })).toBeInTheDocument();
      invalid.mockRestore();
      await user.click(screen.getByRole("button", { name: "Huỷ" }));
      await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
      expect(screen.getByRole("spinbutton", { name: label })).toHaveValue(7);
    },
  );

  it.each([
    ["", null],
    ["0", 0],
    ["2.5", 2.5],
    ["9007199254740991", Number.MAX_SAFE_INTEGER],
  ])("saves valid input %j without changing its numeric meaning", async (text, expected) => {
    const { user, save } = await setup();
    const input = screen.getByRole("spinbutton", { name: "MOQ · 1" });
    await user.clear(input);
    if (text) await user.type(input, text);
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        suppliers: expect.arrayContaining([expect.objectContaining({ moq: expected })]),
      }),
      true,
    );
  });

  it("rejects unsafe integer conversion and preserves the draft for correction", async () => {
    const { user, save } = await setup();
    const input = screen.getByRole("spinbutton", { name: "MOQ · 1" });
    await user.clear(input);
    // userEvent coerces long number strings; native Chromium retains this raw value.
    fireEvent.change(input, { target: { value: "9007199254740993" } });
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("độ chính xác");
    expect(save).not.toHaveBeenCalled();
    // Assert the raw draft rather than valueAsNumber, which itself loses precision.
    expect(input).toHaveAttribute("type", "number");
    if (!(input instanceof HTMLInputElement)) throw new Error("Expected number input");
    expect(input.value).toBe("9007199254740993");
    await user.clear(input);
    await user.type(input, "75");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        suppliers: expect.arrayContaining([expect.objectContaining({ moq: 75 })]),
      }),
      true,
    );
  });

  it("allows a corrected browser-invalid field to save", async () => {
    const { user, save } = await setup();
    const input = screen.getByRole("spinbutton", { name: "MOQ · 1" });
    if (!(input instanceof HTMLInputElement)) throw new Error("Expected number input");
    await user.clear(input);
    const invalid = vi.spyOn(input.validity, "badInput", "get").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nhập số hợp lệ");
    expect(save).not.toHaveBeenCalled();
    invalid.mockRestore();
    await user.type(input, "75");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        suppliers: expect.arrayContaining([expect.objectContaining({ moq: 75 })]),
      }),
      true,
    );
  });
});
