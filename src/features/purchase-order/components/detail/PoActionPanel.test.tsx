import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("PoActionPanel — Sửa nháp", () => {
  it("Draft STANDARD + PO:UPDATE → nút Sửa nháp gọi onAction với mã edit", async () => {
    const onAction = vi.fn();
    const edit = PO_ACTIONS.filter((a) => a.code === "edit");
    render(
      <PoActionPanel
        status="DRAFT"
        actions={edit}
        isMutating={false}
        conflictError={null}
        onAction={onAction}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Sửa nháp" }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ code: "edit" }));
  });
});
