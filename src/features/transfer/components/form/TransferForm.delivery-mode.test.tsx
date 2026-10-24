import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";

import {
  TRANSFER_ROLE_PERMISSIONS as ROLES,
  mockTransferApi,
  renderTransferScreen,
  HEAVY_TEST,
} from "../../__fixtures__/render";
import { FROM_WH, TO_WH, warehouses } from "../../__fixtures__/transfer";
import { pickSelectOption } from "../../../fulfillment/__fixtures__/render";
import { TransferForm } from "./TransferForm";

import type { TransferFormInput } from "@/features/transfer/types";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(() => vi.restoreAllMocks());

const D = UI_LABELS.transfer.deliveryMode;
const BASE: TransferFormInput = {
  fromWarehouseId: FROM_WH,
  toWarehouseId: TO_WH,
  reason: "",
  expectedDate: "",
  lines: [{ sku: "CUP-PP-500", lotNumber: "", quantity: 5 }],
};

function renderForm(defaults: TransferFormInput = BASE) {
  mockTransferApi(ROLES.inventoryPlanner, { "/warehouses": () => warehouses });
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderTransferScreen(
    <TransferForm
      defaultValues={defaults}
      submitLabel={UI_LABELS.transfer.action.save}
      cancelHref="/admin/transfers"
      isPending={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

describe("TransferForm — hình thức giao (LP2-8, BE PR #164)", HEAVY_TEST, () => {
  it("mặc định 'Nguyên xe (FTL)' như BE; gửi deliveryMode FULL_TRUCKLOAD khi không đổi", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();
    expect(await screen.findByRole("combobox", { name: D.label })).toHaveTextContent(
      "Nguyên xe (FTL)",
    );
    await user.click(screen.getByRole("button", { name: UI_LABELS.transfer.action.save }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ deliveryMode: "FULL_TRUCKLOAD" });
  });

  it("đổi sang 'Giao lẻ' → gửi PARCEL; sửa nháp mang sẵn hình thức đang có của lệnh", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();
    await pickSelectOption(user, D.label, "Giao lẻ");
    await user.click(screen.getByRole("button", { name: UI_LABELS.transfer.action.save }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ deliveryMode: "PARCEL" });
  });

  it("form sửa nháp dựng từ lệnh PARCEL: ô hiện 'Giao lẻ'; lời nhắc chỉ đổi được khi còn Nháp", async () => {
    renderForm({ ...BASE, deliveryMode: "PARCEL" });
    expect(await screen.findByRole("combobox", { name: D.label })).toHaveTextContent("Giao lẻ");
    expect(screen.getByText(new RegExp(D.editableOnlyInDraft))).toBeInTheDocument();
  });
});
