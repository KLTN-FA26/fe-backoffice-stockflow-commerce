import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CATALOG, WAREHOUSE_REF, catalogPath, patchJsdomForCmdk } from "../../__fixtures__/create";
import {
  PO_PERMISSION_SETS,
  SUPPLIER_REF,
  bePage,
  mockApi,
  renderPoScreen,
} from "../../__fixtures__/render";
import { createEmptyLine } from "./helpers";
import { LinesStep } from "./LinesStep";
import { usePoWizard } from "./usePoWizard";

import type { PoCreateFormValues } from "@/features/purchase-order";

beforeAll(patchJsdomForCmdk);

afterEach(() => vi.restoreAllMocks());

/** PO nháp có một dòng đã lưu (`lineId`) — màn sửa nháp (Task 11) dùng cùng lõi wizard. */
const DRAFT: PoCreateFormValues = {
  supplierId: SUPPLIER_REF.supplierId,
  warehouseId: WAREHOUSE_REF.id,
  currency: "VND",
  expectedDate: "2099-01-01",
  note: "",
  lines: [
    {
      ...createEmptyLine(),
      lineId: "33333333-3333-4333-8333-333333333333",
      skuId: "SOFA-3S-GREY",
      orderedQty: "10",
      unitPrice: "100000",
      terms: { moq: 1, packSize: 1, price: 1500000, currency: "VND", effectiveLeadTimeDays: 7 },
    },
  ],
};

function EditHarness() {
  const w = usePoWizard({ mode: "edit", defaults: DRAFT, isSubmitting: false, onConfirm: vi.fn() });
  return <LinesStep w={w} />;
}

describe("LinesStep — dòng đã lưu của PO nháp", () => {
  it("dòng có lineId → khoá SKU (BE: lineId giữ SKU); dòng mới vẫn chọn được", async () => {
    const user = userEvent.setup();
    mockApi(PO_PERMISSION_SETS.procurement, {
      "/suppliers": () => bePage([SUPPLIER_REF]),
      "/warehouses": () => bePage([WAREHOUSE_REF]),
      [catalogPath(SUPPLIER_REF.supplierId)]: () => bePage(CATALOG),
    });
    renderPoScreen(<EditHarness />);
    const locked = await screen.findByRole("combobox", { name: "SKU dòng 1" });
    expect(locked).toBeDisabled();
    expect(locked).toHaveValue("SOFA-3S-GREY");

    await user.click(screen.getByRole("button", { name: /Thêm dòng hàng/ }));
    const fresh = await screen.findByRole("combobox", { name: "SKU dòng 2" });
    await vi.waitFor(() => expect(fresh).toBeEnabled());
  });
});
