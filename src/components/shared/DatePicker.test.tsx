import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { addDaysIso, todayIso } from "@/lib/format";
import { pickDate } from "@/test/date-picker";

import { DatePicker } from "./DatePicker";

function Harness({
  initial = "",
  onChange = () => {},
  ...props
}: Partial<React.ComponentProps<typeof DatePicker>> & { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="d">Ngày</label>
      <DatePicker
        id="d"
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

describe("DatePicker", () => {
  it("chưa chọn → ô trống hiện gợi ý dd/mm/yyyy; chọn ngày trên lịch → trả YYYY-MM-DD và hiện dd/MM/yyyy", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const field = screen.getByLabelText("Ngày");
    expect(field).toHaveValue("");
    expect(field).toHaveAttribute("placeholder", "dd/mm/yyyy");

    await pickDate(user, field, "2027-03-15");
    expect(onChange).toHaveBeenLastCalledWith("2027-03-15");
    expect(field).toHaveValue("15/03/2027");
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("gõ được: 8 chữ số liền → tự thêm dấu /, đủ ngày thật mới báo YYYY-MM-DD", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const field = screen.getByLabelText("Ngày");

    await user.type(field, "1503202");
    expect(field).toHaveValue("15/03/202");
    expect(onChange).not.toHaveBeenCalled();

    await user.type(field, "7");
    expect(field).toHaveValue("15/03/2027");
    expect(onChange).toHaveBeenLastCalledWith("2027-03-15");
  });

  it("ngày không có thật (31/02) không báo về, ô báo lỗi; rời ô thì về lại ngày đang giữ", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2027-03-15" onChange={onChange} />);
    const field = screen.getByLabelText("Ngày");

    await user.clear(field);
    await user.type(field, "31022027");
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveAttribute("aria-invalid", "true");

    await user.tab();
    expect(field).toHaveValue("15/03/2027");
  });

  it("ngày gõ ngoài min / max không được nhận", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2027-03-15" min="2027-03-10" onChange={onChange} />);
    const field = screen.getByLabelText("Ngày");

    await user.clear(field);
    await user.type(field, "01032027");
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("Tab đi tiếp không bật lịch; chỉ nút Mở lịch mới mở", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness />
        <button type="button">Ô sau</button>
      </>,
    );
    await user.click(screen.getByLabelText("Ngày"));
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    await user.tab();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở lịch" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Mở lịch" }));
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("nút ngày nhanh: Hôm nay / Ngày mai điền ngay, nút ngoài min–max không hiện", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const today = todayIso();
    render(<Harness min={today} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Mở lịch" }));
    expect(screen.queryByRole("button", { name: "Hôm qua" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+7 ngày" }));
    expect(onChange).toHaveBeenLastCalledWith(addDaysIso(today, 7));
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("quickDates do caller truyền thay cho bộ mặc định", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Harness
        quickDates={[{ label: "Hết hạn sau 30 ngày", value: "2027-01-01" }]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Mở lịch" }));
    expect(screen.queryByRole("button", { name: "Hôm nay" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hết hạn sau 30 ngày" }));
    expect(onChange).toHaveBeenLastCalledWith("2027-01-01");
  });

  it("ngày trước `min` bị khoá, không chọn được", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2027-03-15" min="2027-03-10" />);
    await user.click(screen.getByRole("button", { name: "Mở lịch" }));
    const cells = screen.getAllByRole("gridcell");
    const day9 = cells.find((c) => c.textContent === "9" && !c.hasAttribute("data-outside"));
    const day10 = cells.find((c) => c.textContent === "10" && !c.hasAttribute("data-outside"));
    expect(day9?.querySelector("button")).toBeDisabled();
    expect(day10?.querySelector("button")).toBeEnabled();
  });

  it("clearable → xoá chữ hoặc nút Xoá ngày đưa về rỗng; không clearable thì không có nút, xoá chữ không bỏ chọn", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount } = render(<Harness initial="2027-03-15" clearable onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Mở lịch" }));
    await user.click(screen.getByRole("button", { name: "Xoá ngày" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByLabelText("Ngày")).toHaveValue("");
    unmount();

    const typed = vi.fn();
    const second = render(<Harness initial="2027-03-15" clearable onChange={typed} />);
    await user.clear(screen.getByLabelText("Ngày"));
    expect(typed).toHaveBeenLastCalledWith("");
    second.unmount();

    const required = vi.fn();
    render(<Harness initial="2027-03-15" onChange={required} />);
    await user.click(screen.getByRole("button", { name: "Mở lịch" }));
    expect(screen.queryByRole("button", { name: "Xoá ngày" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.clear(screen.getByLabelText("Ngày"));
    expect(required).not.toHaveBeenCalled();
    await user.tab();
    expect(screen.getByLabelText("Ngày")).toHaveValue("15/03/2027");
  });

  it("aria-invalid được gắn lên ô gõ", () => {
    render(<Harness aria-invalid />);
    expect(screen.getByLabelText("Ngày")).toHaveAttribute("aria-invalid", "true");
  });
});
