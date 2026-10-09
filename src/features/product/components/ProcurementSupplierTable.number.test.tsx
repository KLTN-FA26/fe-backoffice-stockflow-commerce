import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readMockSkuProcurementSettings } from "../procurement-settings/mock-fixtures";
import * as service from "../procurement-settings/service";
import { ProcurementSettingsSection } from "./ProcurementSettingsSection";
import { PROCUREMENT_MISSING, showProcurementNumber } from "./ProcurementSupplierTable";

afterEach(() => vi.restoreAllMocks());

describe("procurement numeric display", () => {
  it.each([
    [0.0001, "0,0001"],
    [1e-25, `0,${"0".repeat(24)}1`],
    [1234, "1.234"],
    [0, "0"],
    [0.12345678901234566, "0,12345678901234566"],
    [0.3, "0,3"],
    [0.1 + 0.2, "≈ 0,3"],
    [Number.MAX_SAFE_INTEGER, "9.007.199.254.740.991"],
    [null, PROCUREMENT_MISSING],
  ])("displays %s without a fixed fractional cutoff", (value, expected) => {
    expect(showProcurementNumber(value)).toBe(expected);
  });

  it("preserves suffixes only for known values", () => {
    expect(showProcurementNumber(0.0001, " ngày")).toBe("0,0001 ngày");
    expect(showProcurementNumber(null, " ngày")).toBe(PROCUREMENT_MISSING);
  });

  it("retains stored precision in read-only settings and mapping fields", () => {
    const fixture = readMockSkuProcurementSettings("SKU-001-BLK-L", 60);
    render(
      <ProcurementSettingsSection
        isMock
        settings={{
          ...fixture,
          reorderPoint: 0.0001,
          suppliers: fixture.suppliers.map((supplier) => ({
            ...supplier,
            leadTimeDays: 0.0001,
            moq: 0.0001,
            orderMultiple: 0.1 + 0.2,
          })),
        }}
      />,
    );
    expect(screen.getAllByText("0,0001")).toHaveLength(3);
    expect(screen.getAllByText("0,0001 ngày")).toHaveLength(2);
    for (const displayed of screen.getAllByText("≈ 0,3")) {
      expect(displayed).toHaveAttribute("title", "0.30000000000000004");
    }
  });

  it("displays 0.0001 faithfully after saving through the service", async () => {
    const user = userEvent.setup();
    const save = vi
      .spyOn(service, "saveProcurementSettings")
      .mockImplementation(async (value) => value);
    render(
      <ProcurementSettingsSection
        isMock
        settings={readMockSkuProcurementSettings("SKU-001-BLK-L", 60)}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    const input = screen.getByRole("spinbutton", { name: "Điểm đặt hàng lại" });
    await user.clear(input);
    await user.type(input, "0.0001");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("button", { name: "Chỉnh sửa" })).toBeInTheDocument();
    expect(screen.getByText("0,0001")).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ reorderPoint: 0.0001 }), true);
  });
});
