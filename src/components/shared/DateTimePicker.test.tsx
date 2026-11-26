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
    expect(onChange).not.toHaveBeenCalled();

    await user.type(field, "0");
    expect(field).toHaveValue("26/11/2026 08:30");
    expect(onChange).toHaveBeenLastCalledWith("2026-11-26T08:30");
  });

  it("giờ 25:00 hoặc ngày 31/02 không báo về, ô báo lỗi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const field = screen.getByLabelText("Giờ hẹn");
    await user.type(field, "261120262500");
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveAttribute("aria-invalid", "true");
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
    await user.click(screen.getByRole("button", { name: "Mở lịch" }));
    const time = screen.getByLabelText("Giờ (24 giờ)");
    await user.clear(time);
    await user.type(time, "1745");
    expect(onChange).toHaveBeenLastCalledWith("2026-11-26T17:45");
    expect(screen.getByLabelText("Giờ hẹn")).toHaveValue("26/11/2026 17:45");
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
