import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PO_ACTIONS } from "@/features/purchase-order";

import { PoActionPanel } from "./PoActionPanel";

const TERMINAL_TEXT = /không có hành động khả dụng/;
const recordConfirmation = PO_ACTIONS.filter((a) => a.code === "recordConfirmation");

function renderPanel(actions: typeof PO_ACTIONS) {
  render(
    <PoActionPanel
      status="CLOSED"
      actions={actions}
      isMutating={false}
      conflictError={null}
      onAction={vi.fn()}
    />,
  );
}

describe("PoActionPanel — thông báo trạng thái kết thúc", () => {
  it("PO đã đóng nhưng còn 'Ghi nhận NCC phản hồi' → không báo 'không có hành động'", () => {
    renderPanel(recordConfirmation);
    expect(screen.getByRole("button", { name: /Ghi nhận NCC phản hồi/ })).toBeInTheDocument();
    expect(screen.queryByText(TERMINAL_TEXT)).not.toBeInTheDocument();
  });

  it("PO đã đóng và không còn thao tác nào → báo trạng thái kết thúc", () => {
    renderPanel([]);
    expect(screen.getByText(TERMINAL_TEXT)).toBeInTheDocument();
  });
});
