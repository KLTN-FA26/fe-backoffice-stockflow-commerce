import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";

function renderDialog(loading: boolean) {
  const onOpenChange = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Ngừng hợp tác?"
      description="Mô tả"
      confirmLabel="Ngừng hợp tác"
      onConfirm={vi.fn()}
      loading={loading}
    />,
  );
  return onOpenChange;
}

describe("ConfirmDialog", () => {
  it("đang xử lý (loading) → ESC không đóng dialog, nút xác nhận bị khoá", async () => {
    const onOpenChange = renderDialog(true);
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: "Đang xử lý..." })).toBeDisabled();
  });

  it("không xử lý → ESC đóng dialog như bình thường", async () => {
    const onOpenChange = renderDialog(false);
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
