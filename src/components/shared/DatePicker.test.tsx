import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
  it("chưa chọn → hiện placeholder; chọn ngày → trả YYYY-MM-DD và hiện ngày đã chọn", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByLabelText("Ngày");
    expect(trigger).toHaveTextContent("Chọn ngày");

    await pickDate(user, trigger, "2027-03-15");
    expect(onChange).toHaveBeenLastCalledWith("2027-03-15");
    expect(trigger).toHaveTextContent(/15 thg 3, 2027/);
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("ngày trước `min` bị khoá, không chọn được", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2027-03-15" min="2027-03-10" />);
    await user.click(screen.getByLabelText("Ngày"));
    const cells = screen.getAllByRole("gridcell");
    const day9 = cells.find((c) => c.textContent === "9" && !c.hasAttribute("data-outside"));
    const day10 = cells.find((c) => c.textContent === "10" && !c.hasAttribute("data-outside"));
    expect(day9?.querySelector("button")).toBeDisabled();
    expect(day10?.querySelector("button")).toBeEnabled();
  });

  it("clearable → nút Xoá ngày đưa về rỗng; không clearable thì không có nút", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount } = render(<Harness initial="2027-03-15" clearable onChange={onChange} />);
    await user.click(screen.getByLabelText("Ngày"));
    await user.click(screen.getByRole("button", { name: "Xoá ngày" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByLabelText("Ngày")).toHaveTextContent("Chọn ngày");
    unmount();

    render(<Harness initial="2027-03-15" />);
    await user.click(screen.getByLabelText("Ngày"));
    expect(screen.queryByRole("button", { name: "Xoá ngày" })).not.toBeInTheDocument();
  });

  it("aria-invalid được gắn lên nút mở lịch", () => {
    render(<Harness aria-invalid />);
    expect(screen.getByLabelText("Ngày")).toHaveAttribute("aria-invalid", "true");
  });
});
