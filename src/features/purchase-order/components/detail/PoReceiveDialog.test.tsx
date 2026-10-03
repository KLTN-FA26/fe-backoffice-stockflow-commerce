import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PoReceiveDialog } from "./PoReceiveDialog";

import type { PurchaseOrder } from "@/features/purchase-order";

const PO: PurchaseOrder = {
  poId: "po-1",
  poNumber: "PO-20260930-000001",
  supplierId: "sup-1",
  status: "PARTIALLY_RECEIVED",
  currency: "VND",
  orderDate: "2026-09-30",
  expectedDate: "2026-10-07",
  createdBy: "tester",
  grandTotal: 2000,
  paymentTermDays: 30,
  leadTimeDays: 7,
  supplierConfirmationStatus: "CONFIRMED",
  deliveryStatus: "DELIVERED",
  lines: [
    {
      lineId: "l-1",
      poId: "po-1",
      skuId: "SKU-A",
      orderedQty: 10,
      receivedQty: 4,
      openQuantity: 6,
      unitPrice: 100,
      currency: "VND",
      lineTotal: 1000,
    },
    {
      lineId: "l-2",
      poId: "po-1",
      skuId: "SKU-B",
      orderedQty: 10,
      receivedQty: 10,
      openQuantity: 0,
      unitPrice: 100,
      currency: "VND",
      lineTotal: 1000,
    },
  ],
};

function setup(open = true) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  const utils = render(
    <PoReceiveDialog
      open={open}
      onOpenChange={onOpenChange}
      po={PO}
      isPending={false}
      serverError={null}
      onConfirm={onConfirm}
    />,
  );
  const submit = () => screen.getByRole("button", { name: /xác nhận nhận hàng/i });
  return { ...utils, onConfirm, onOpenChange, submit };
}

describe("PoReceiveDialog", () => {
  it("shows the remaining quantity and only lists lines that are still open", () => {
    setup();
    expect(screen.getByText(/còn nhận được: 6/i)).toBeInTheDocument();
    expect(screen.queryByText("SKU-B")).not.toBeInTheDocument();
  });

  it("disables confirm until at least one line has a quantity", () => {
    const { submit } = setup();
    expect(submit()).toBeDisabled();
  });

  it("blocks a quantity above the open quantity with an inline error", async () => {
    const user = userEvent.setup();
    const { submit, onConfirm } = setup();
    await user.type(screen.getByLabelText(/SKU-A/), "20");
    expect(screen.getByText(/vượt sl còn nhận được \(6\)/i)).toBeInTheDocument();
    expect(submit()).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("sends only valid lines", async () => {
    const user = userEvent.setup();
    const { submit, onConfirm } = setup();
    await user.type(screen.getByLabelText(/SKU-A/), "4");
    await user.click(submit());
    expect(onConfirm).toHaveBeenCalledWith([{ lineId: "l-1", quantity: 4 }]);
  });

  it("resets typed quantities when the dialog is closed and reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = setup();
    await user.type(screen.getByLabelText(/SKU-A/), "3");
    const props = {
      onOpenChange: vi.fn(),
      po: PO,
      isPending: false,
      serverError: null,
      onConfirm: vi.fn(),
    };
    rerender(<PoReceiveDialog open={false} {...props} />);
    rerender(<PoReceiveDialog open {...props} />);
    expect(screen.getByLabelText(/SKU-A/)).toHaveValue(null);
  });
});
