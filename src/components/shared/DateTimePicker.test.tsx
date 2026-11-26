import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DateTimePicker } from "./DateTimePicker";

function Harness({
  initial = "",
  onChange = () => {},
  ...props
}: Partial<React.ComponentProps<typeof DateTimePicker>> & { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="dt">Giờ hẹn</label>
      <DateTimePicker
        id="dt"
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
        {...props}
      />
    </>
  );
}

describe("DateTimePicker", () => {
  it("không phải ô gốc của trình duyệt: ô chữ dd/mm/yyyy hh:mm, không AM/PM", () => {
    render(<Harness />);
    const field = screen.getByLabelText("Giờ hẹn");
    expect(field).toHaveAttribute("type", "text");
    expect(field).toHaveAttribute("placeholder", "dd/mm/yyyy hh:mm");
  });

  it("hiện giá trị yyyy-MM-ddTHH:mm dưới dạng dd/MM/yyyy HH:mm 24 giờ", () => {
    render(<Harness initial="2026-11-26T20:30" />);
    expect(screen.getByLabelText("Giờ hẹn")).toHaveValue("26/11/2026 20:30");
  });

  it("gõ liền 12 chữ số → tự thêm / : và dấu cách, đủ mới báo yyyy-MM-ddTHH:mm (đúng dạng BE đang đọc)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const field = screen.getByLabelText("Giờ hẹn");

    await user.type(field, "26112026083");
    expect(field).toHaveValue("26/11/2026 08:3");
    // Dở: báo nguyên chữ (form giữ lỗi), chưa có giá trị yyyy-MM-ddTHH:mm nào
    expect(onChange).toHaveBeenLastCalledWith("26/11/2026 08:3");
    expect(onChange.mock.calls.some(([v]) => /^\d{4}-/.test(v))).toBe(false);

    await user.type(field, "0");
    expect(field).toHaveValue("26/11/2026 08:30");
    expect(onChange).toHaveBeenLastCalledWith("2026-11-26T08:30");
  });

  it("ngày không có thật (31/11/2026 08:30): báo về NGUYÊN CHỮ gõ — không phải giá trị cũ hay rỗng — và ô báo lỗi bằng chữ", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2026-11-26T08:30" onChange={onChange} />);
    const field = screen.getByLabelText("Giờ hẹn");
    await user.clear(field);
    onChange.mockClear();
    await user.type(field, "311120260830");
    expect(field).toHaveValue("31/11/2026 08:30");
    expect(onChange).toHaveBeenLastCalledWith("31/11/2026 08:30");
    expect(onChange).not.toHaveBeenCalledWith("");
    expect(onChange).not.toHaveBeenCalledWith("2026-11-26T08:30");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Ngày giờ không hợp lệ/)).toBeInTheDocument();
    // Rời ô: chữ vẫn ở đó cùng lý do (không âm thầm đổi về giờ cũ)
    await user.tab();
    expect(field).toHaveValue("31/11/2026 08:30");
    expect(onChange).toHaveBeenLastCalledWith("31/11/2026 08:30");
  });

  it("giờ 25:00 hoặc gõ dở báo về nguyên chữ, không bao giờ thành rỗng", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const field = screen.getByLabelText("Giờ hẹn");
    await user.type(field, "261120262500");
    expect(onChange).toHaveBeenLastCalledWith("26/11/2026 25:00");
    expect(onChange).not.toHaveBeenCalledWith("");
    await user.clear(field);
    await user.type(field, "2611");
    expect(onChange).toHaveBeenLastCalledWith("26/11");
    await user.tab();
    expect(screen.getByText(/Nhập đủ ngày giờ/)).toBeInTheDocument();
  });

  it("xoá hết chữ báo rỗng (không chọn)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2026-11-26T08:30" onChange={onChange} />);
    await user.clear(screen.getByLabelText("Giờ hẹn"));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("ô giờ trong lịch có tên đọc được; nút lịch kèm nhãn của ô", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Mở lịch – Giờ hẹn" }));
    expect(screen.getByRole("textbox", { name: "Giờ (24 giờ) – Giờ hẹn" })).toBeInTheDocument();
  });

  it("sửa giữa chữ không làm con trỏ nhảy về cuối; gõ vào ô đầy vẫn được", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2026-11-26T08:30" onChange={onChange} />);
    const field = screen.getByLabelText("Giờ hẹn") as HTMLInputElement;
    await user.type(field, "1", { initialSelectionStart: 2, initialSelectionEnd: 2 });
    expect(field.selectionStart).toBe(4);
    await user.tripleClick(field);
    await user.keyboard("271120260915");
    expect(field).toHaveValue("27/11/2026 09:15");
    expect(onChange).toHaveBeenLastCalledWith("2026-11-27T09:15");
  });

  it("nút nhanh: điền giá trị của nút; 'Sớm nhất' = bỏ trống", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Harness
        initial="2026-11-26T08:30"
        onChange={onChange}
        quick={[
          { label: "Sớm nhất", value: () => "" },
          { label: "Hôm nay 08:30", value: () => "2026-11-27T08:30" },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Hôm nay 08:30" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-11-27T08:30");
    expect(screen.getByLabelText("Giờ hẹn")).toHaveValue("27/11/2026 08:30");
    await user.click(screen.getByRole("button", { name: "Sớm nhất" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByLabelText("Giờ hẹn")).toHaveValue("");
  });

  it("lịch: chọn ngày giữ giờ đang có; gõ giờ trong lịch đổi giờ", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2026-11-26T08:30" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /^Mở lịch/ }));
    const time = screen.getByLabelText("Giờ (24 giờ)");
    await user.clear(time);
    await user.type(time, "1745");
    expect(onChange).toHaveBeenLastCalledWith("2026-11-26T17:45");
    expect(screen.getByLabelText("Giờ hẹn")).toHaveValue("26/11/2026 17:45");
  });

  it("showReason=false: caller tự hiện lỗi nên ô không hiện thêm câu", async () => {
    const user = userEvent.setup();
    render(<Harness showReason={false} />);
    await user.type(screen.getByLabelText("Giờ hẹn"), "311120260830");
    expect(screen.getByLabelText("Giờ hẹn")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/Ngày giờ không hợp lệ/)).not.toBeInTheDocument();
  });

  it("giờ gõ ngoài min/max vẫn báo về (caller nói lý do) và ô đổi viền báo lỗi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness max="2026-11-26T10:00" onChange={onChange} />);
    const field = screen.getByLabelText("Giờ hẹn");
    await user.type(field, "261120261130");
    expect(onChange).toHaveBeenLastCalledWith("2026-11-26T11:30");
    expect(field).toHaveAttribute("aria-invalid", "true");
  });
});
