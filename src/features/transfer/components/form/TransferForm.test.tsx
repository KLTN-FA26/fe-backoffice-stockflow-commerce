import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { TRANSFER_ERROR_MESSAGES, TRANSFER_FIELD_MESSAGES as MSG, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  TRANSFER_ROLE_PERMISSIONS as ROLES,
  mockTransferApi,
  renderTransferScreen,
} from "../../__fixtures__/render";
import { FROM_WH, TO_WH, warehouses } from "../../__fixtures__/transfer";
import { TransferForm } from "./TransferForm";

import type { TransferFormInput } from "@/features/transfer/types";

// jsdom không có scrollIntoView (form cuộn tới lỗi máy chủ)
beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(() => vi.restoreAllMocks());

// Render cả màn + react-query + userEvent: máy CI / máy đang tải nặng có thể vượt mốc 5s mặc định
const HEAVY = { timeout: 15_000 };

const DEFAULTS: TransferFormInput = {
  fromWarehouseId: FROM_WH,
  toWarehouseId: TO_WH,
  reason: "",
  expectedDate: "",
  lines: [
    { sku: "CUP-PP-500", lotNumber: "LOT-01", quantity: 40 },
    { sku: "TABLE-OAK-160", lotNumber: "LOT-1", quantity: 5 },
    { sku: "TABLE-OAK-160", lotNumber: "LOT-2", quantity: 30 },
  ],
};

function renderForm(error: unknown) {
  mockTransferApi(ROLES.inventoryPlanner, { "/warehouses": () => warehouses });
  const onSubmit = vi.fn().mockRejectedValue(error);
  renderTransferScreen(
    <TransferForm
      defaultValues={DEFAULTS}
      submitLabel={UI_LABELS.transfer.action.save}
      cancelHref="/admin/transfers"
      isPending={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

const qty = (row: number) => screen.getByLabelText(`SL dòng ${row}`);

describe("TransferForm — lỗi máy chủ theo dòng (SKU + lô)", HEAVY, () => {
  it("BE chỉ ra dòng thiếu tồn → đánh dấu đúng dòng; sửa dòng đó thì bỏ đánh dấu", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm(
      new ApiError(409, "INSUFFICIENT_STOCK", "Insufficient stock for SKU TABLE-OAK-160", {
        "lines[2].quantity": "requested 30, available 7",
      }),
    );
    await user.click(screen.getByRole("button", { name: UI_LABELS.transfer.action.save }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(await screen.findByText(`${MSG.notEnoughStock} 7`)).toBeInTheDocument();
    expect(qty(3)).toHaveAttribute("aria-invalid", "true");
    expect(qty(2)).not.toHaveAttribute("aria-invalid");

    await user.clear(qty(3));
    await user.type(qty(3), "7");
    expect(screen.queryByText(`${MSG.notEnoughStock} 7`)).not.toBeInTheDocument();
  });

  it("xoá dòng phía trước → lỗi dồn theo dòng (không gắn nhầm dòng khác)", async () => {
    const user = userEvent.setup();
    renderForm(
      new ApiError(409, "INSUFFICIENT_STOCK", "x", {
        "lines[2].quantity": "requested 30, available 7",
      }),
    );
    await user.click(screen.getByRole("button", { name: UI_LABELS.transfer.action.save }));
    await screen.findByText(`${MSG.notEnoughStock} 7`);

    await user.click(screen.getByRole("button", { name: "Xoá dòng 1" }));
    // Dòng thiếu tồn (cũ là dòng 3) giờ là dòng 2
    expect(qty(2)).toHaveAttribute("aria-invalid", "true");
    expect(qty(1)).not.toHaveAttribute("aria-invalid");
  });

  it("BE từ chối mà không chỉ ra dòng nào → câu chung, không bảo 'xem ô được đánh dấu'", async () => {
    const user = userEvent.setup();
    renderForm(
      new ApiError(400, "VALIDATION_FAILED", "x", { fromWarehouseId: "must not be null" }),
    );
    await user.click(screen.getByRole("button", { name: UI_LABELS.transfer.action.save }));
    expect(await screen.findByText(TRANSFER_ERROR_MESSAGES.validationGeneral)).toBeInTheDocument();
  });
});
