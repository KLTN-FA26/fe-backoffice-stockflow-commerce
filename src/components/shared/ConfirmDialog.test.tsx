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

  it("hiện lỗi truyền vào bên trong dialog (role=alert) — không có lỗi thì không render", () => {
    const { rerender } = render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Từ chối"
        description="Mô tả"
        onConfirm={vi.fn()}
        closeOnConfirm={false}
      />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    rerender(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Từ chối"
        description="Mô tả"
        onConfirm={vi.fn()}
        closeOnConfirm={false}
        error="Không thực hiện được"
      />,
    );
    expect(screen.getByRole("dialog")).toContainElement(screen.getByRole("alert"));
    expect(screen.getByRole("alert")).toHaveTextContent("Không thực hiện được");
  });

  it("children hiện dưới phần mô tả, trước ô lý do", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Ngừng kinh doanh?"
        description="Mô tả"
        requireReason
        onConfirm={vi.fn()}
      >
        <p>Chi tiết bổ sung</p>
      </ConfirmDialog>,
    );
    const extra = screen.getByText("Chi tiết bổ sung");
    const reason = screen.getByRole("textbox");
    expect(extra.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("reasonMinLength: dưới ngưỡng thì khoá xác nhận và nhắc số ký tự; đủ rồi thì mở", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Khoá tài khoản"
        description="Mô tả"
        requireReason
        reasonLabel="Lý do"
        reasonMinLength={5}
        reasonMaxLength={500}
        confirmLabel="Khoá"
        onConfirm={onConfirm}
      />,
    );
    const confirm = screen.getByRole("button", { name: "Khoá" });

    await userEvent.type(screen.getByLabelText(/Lý do/), "  ab  ");
    expect(confirm).toBeDisabled();
    expect(screen.getByText("Nhập tối thiểu 5 ký tự")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Lý do/), "cde");
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("  ab  cde");
  });

  it("reasonMinLength counts code points after trimming Unicode spaces", async () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Khoá"
        description="Mô tả"
        requireReason
        reasonLabel="Lý do"
        reasonMinLength={5}
        confirmLabel="Khoá"
        onConfirm={vi.fn()}
      />,
    );
    const box = screen.getByLabelText(/Lý do/);
    const confirm = screen.getByRole("button", { name: "Khoá" });

    await userEvent.type(box, "\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0");
    expect(confirm).toBeDisabled();
    await userEvent.clear(box);
    await userEvent.type(box, "\u{1F512}\u{1F512}\u{1F512}\u{1F512}");
    expect(confirm).toBeDisabled(); // 8 UTF-16 units, 4 characters
    await userEvent.type(box, "\u{1F512}");
    expect(confirm).toBeEnabled();
  });
});
