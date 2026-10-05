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

  it("closeOnConfirm=false → bấm xác nhận giữ dialog + lý do, chỉ gọi onConfirm", async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Huỷ đơn hàng"
        description="Mô tả"
        requireReason
        reasonLabel="Lý do huỷ"
        onConfirm={onConfirm}
        closeOnConfirm={false}
      />,
    );

    await userEvent.type(screen.getByLabelText(/Lý do huỷ/), "Khách đổi ý");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(onConfirm).toHaveBeenCalledWith("Khách đổi ý");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Lý do huỷ/)).toHaveValue("Khách đổi ý");
  });

  it("bên gọi đóng qua prop open → mở lại thì ô lý do trống", async () => {
    const props = {
      onOpenChange: vi.fn(),
      title: "Huỷ đơn hàng",
      description: "Mô tả",
      requireReason: true,
      reasonLabel: "Lý do huỷ",
      onConfirm: vi.fn(),
      closeOnConfirm: false,
    };
    const { rerender } = render(<ConfirmDialog open {...props} />);
    await userEvent.type(screen.getByLabelText(/Lý do huỷ/), "Khách đổi ý");

    rerender(<ConfirmDialog open={false} {...props} />);
    rerender(<ConfirmDialog open {...props} />);

    expect(screen.getByLabelText(/Lý do huỷ/)).toHaveValue("");
  });

  it("reasonMaxLength → ô lý do chặn quá giới hạn và hiện bộ đếm", async () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Huỷ đơn hàng"
        description="Mô tả"
        requireReason
        reasonLabel="Lý do huỷ"
        reasonMaxLength={5}
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/Lý do huỷ/), "1234567");

    expect(screen.getByLabelText(/Lý do huỷ/)).toHaveValue("12345");
    expect(screen.getByText("5/5")).toBeInTheDocument();
  });

  it("Ctrl + Enter trong ô lý do → xác nhận (không cần chuột)", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Huỷ đơn hàng"
        description="Mô tả"
        requireReason
        reasonLabel="Lý do huỷ"
        onConfirm={onConfirm}
      />,
    );

    await userEvent.type(
      screen.getByLabelText(/Lý do huỷ/),
      "Khách đổi ý{Control>}{Enter}{/Control}",
    );

    expect(onConfirm).toHaveBeenCalledWith("Khách đổi ý");
  });

  it("Ctrl + Enter khi lý do trống → không xác nhận", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Huỷ đơn hàng"
        description="Mô tả"
        requireReason
        reasonLabel="Lý do huỷ"
        onConfirm={onConfirm}
      />,
    );

    await userEvent.type(screen.getByLabelText(/Lý do huỷ/), "{Control>}{Enter}{/Control}");

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Enter thường → xuống dòng trong lý do, không xác nhận", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Huỷ đơn hàng"
        description="Mô tả"
        requireReason
        reasonLabel="Lý do huỷ"
        onConfirm={onConfirm}
      />,
    );

    await userEvent.type(screen.getByLabelText(/Lý do huỷ/), "Dòng 1{Enter}Dòng 2");

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Lý do huỷ/)).toHaveValue("Dòng 1\nDòng 2");
  });
});
