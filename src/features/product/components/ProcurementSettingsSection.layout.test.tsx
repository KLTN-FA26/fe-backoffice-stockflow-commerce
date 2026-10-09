import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { readMockSkuProcurementSettings } from "../procurement-settings/mock-fixtures";
import { ProcurementSettingsSection } from "./ProcurementSettingsSection";

const ITEM_CODE = "SKU-001-BLK-L".repeat(20).slice(0, 240);
const LONG_NAME = "Công ty TNHH Dệt may Thành Công".repeat(8);

function setup() {
  const fixture = readMockSkuProcurementSettings("SKU-001-BLK-L", 60);
  render(
    <ProcurementSettingsSection
      isMock
      settings={{
        ...fixture,
        defaultSupplierName: LONG_NAME,
        suppliers: fixture.suppliers.map((supplier, index) =>
          index === 0
            ? { ...supplier, supplierName: LONG_NAME, supplierItemCode: ITEM_CODE }
            : supplier,
        ),
      }}
    />,
  );
}

describe("procurement long-content presentation", () => {
  it("keeps the full long supplier name and 240-character item code readable by wrapping", () => {
    setup();
    const table = screen.getByRole("table");
    expect(table).toHaveClass("table-fixed", "min-w-[48rem]");
    expect(within(table).getByRole("link", { name: LONG_NAME })).toHaveClass(
      "whitespace-normal",
      "wrap-anywhere",
    );
    expect(within(table).getByText(ITEM_CODE)).toHaveClass("whitespace-normal", "break-all");
    expect(ITEM_CODE).toHaveLength(240);
    expect(screen.getAllByText(LONG_NAME)).toHaveLength(2);
    expect(within(table).getAllByText("Chưa có dữ liệu")).toHaveLength(7);
  });

  it("keeps full values editable in the same fixed-layout table", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    expect(screen.getByRole("table")).toHaveClass("table-fixed", "min-w-[48rem]");
    expect(screen.getByRole("textbox", { name: "Mã hàng NCC · 1" })).toHaveValue(ITEM_CODE);
    expect(
      within(screen.getByRole("combobox", { name: "Nhà cung cấp · 1" })).getByRole("option", {
        name: LONG_NAME,
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(screen.getByText(ITEM_CODE)).toBeInTheDocument();
  });
});
