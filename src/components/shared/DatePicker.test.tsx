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
    // Dở thì form chỉ nhận rỗng, chưa có ngày nào
    expect(onChange.mock.calls.every(([v]) => v === "")).toBe(true);

    await user.type(field, "7");
    expect(field).toHaveValue("15/03/2027");
    expect(onChange).toHaveBeenLastCalledWith("2027-03-15");
  });

  it("ô bắt buộc: ngày không có thật (31/02) báo RỖNG cho form (không giữ ngày cũ), hiện lý do, chữ ở lại sau khi rời ô", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2027-03-15" onChange={onChange} />);
    const field = screen.getByLabelText("Ngày");

    await user.clear(field);
    await user.type(field, "31022027");
    // Không bao giờ có lần báo nào mang ngày cũ 2027-03-15 sau khi người dùng bắt đầu sửa
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(onChange).not.toHaveBeenCalledWith("2027-03-31");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Ngày không hợp lệ/)).toBeInTheDocument();

    await user.tab();
    expect(field).toHaveValue("31/02/2027");
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("ô bắt buộc: gõ dở rồi rời ô → form nhận rỗng, ô nói 'Nhập đủ ngày'", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2027-03-15" onChange={onChange} />);
    const field = screen.getByLabelText("Ngày");
    await user.clear(field);
    await user.type(field, "1503");
    expect(onChange).toHaveBeenLastCalledWith("");
    await user.tab();
    expect(screen.getByText(/Nhập đủ ngày/)).toBeInTheDocument();
    expect(field).toHaveValue("15/03");
  });

  it("ô lọc (clearable): gõ không nhận được thì giữ bộ lọc đang áp, rời ô trả về ngày đang lọc", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2027-03-15" clearable onChange={onChange} />);
    const field = screen.getByLabelText("Ngày");
    await user.clear(field);
    onChange.mockClear();
    await user.type(field, "31022027");
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();
    expect(field).toHaveValue("");
  });

  it("ngày gõ ngoài min / max không được nhận và nói rõ khoảng được chọn", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2027-03-15" min="2027-03-10" onChange={onChange} />);
    const field = screen.getByLabelText("Ngày");

    await user.clear(field);
    await user.type(field, "01032027");
    expect(onChange).not.toHaveBeenCalledWith("2027-03-01");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Chọn ngày từ 10/03/2027 trở đi")).toBeInTheDocument();
    expect(field).toHaveAccessibleDescription("Chọn ngày từ 10/03/2027 trở đi");
  });

  it("năm gõ ngoài khoảng của lịch bị từ chối", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.type(screen.getByLabelText("Ngày"), "15032999");
    expect(onChange).not.toHaveBeenCalledWith("2999-03-15");
    expect(screen.getByText(/Ngày không hợp lệ/)).toBeInTheDocument();
  });

  it("gõ vào ô đã đầy vẫn được (không bị maxLength chặn): chọn hết rồi gõ lại", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const year = new Date().getFullYear();
    render(<Harness initial={`${year}-03-15`} onChange={onChange} />);
    const field = screen.getByLabelText("Ngày");
    await user.tripleClick(field);
    await user.keyboard(`2003${year}`);
    expect(field).toHaveValue(`20/03/${year}`);
    expect(onChange).toHaveBeenLastCalledWith(`${year}-03-20`);
  });

  it("sửa giữa chữ không làm con trỏ nhảy về cuối", async () => {
    const user = userEvent.setup();
    const year = new Date().getFullYear();
    render(<Harness initial={`${year}-03-15`} />);
    const field = screen.getByLabelText("Ngày") as HTMLInputElement;
    // Con trỏ sau chữ số thứ 2 ("15|/03/…"): gõ "9" → "159" → "15/90/…"-dạng, con trỏ ngay sau chữ số vừa gõ
    await user.type(field, "9", { initialSelectionStart: 2, initialSelectionEnd: 2 });
    expect(field.selectionStart).toBe(4);
    expect(field.selectionEnd).toBe(4);
  });

  it("nút lịch có tên kèm nhãn của ô: 'Mở lịch – Ngày'", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Mở lịch – Ngày" })).toBeInTheDocument();
  });

  it("ô ngày đã xảy ra (quickKind=past) không đề nghị ngày mai / +7 ngày; ô hạn (future) không đề nghị hôm qua", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness quickKind="past" />);
    await user.click(screen.getByRole("button", { name: /^Mở lịch/ }));
    expect(screen.getByRole("button", { name: "Hôm nay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hôm qua" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7 ngày trước" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ngày mai" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+7 ngày" })).not.toBeInTheDocument();
    unmount();

    render(<Harness quickKind="future" />);
    await user.click(screen.getByRole("button", { name: /^Mở lịch/ }));
    expect(screen.getByRole("button", { name: "Ngày mai" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hôm qua" })).not.toBeInTheDocument();
  });

  it("max là hôm nay → tự hiểu là ngày đã xảy ra (không cần quickKind)", async () => {
    const user = userEvent.setup();
    render(<Harness max={todayIso()} />);
    await user.click(screen.getByRole("button", { name: /^Mở lịch/ }));
    expect(screen.getByRole("button", { name: "Hôm qua" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+7 ngày" })).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /^Mở lịch/ })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /^Mở lịch/ }));
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("nút ngày nhanh: Hôm nay / Ngày mai điền ngay, nút ngoài min–max không hiện", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const today = todayIso();
    render(<Harness min={today} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /^Mở lịch/ }));
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
    await user.click(screen.getByRole("button", { name: /^Mở lịch/ }));
    expect(screen.queryByRole("button", { name: "Hôm nay" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hết hạn sau 30 ngày" }));
    expect(onChange).toHaveBeenLastCalledWith("2027-01-01");
  });

  it("ngày trước `min` bị khoá, không chọn được", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2027-03-15" min="2027-03-10" />);
    await user.click(screen.getByRole("button", { name: /^Mở lịch/ }));
    const cells = screen.getAllByRole("gridcell");
    const day9 = cells.find((c) => c.textContent === "9" && !c.hasAttribute("data-outside"));
    const day10 = cells.find((c) => c.textContent === "10" && !c.hasAttribute("data-outside"));
    expect(day9?.querySelector("button")).toBeDisabled();
    expect(day10?.querySelector("button")).toBeEnabled();
  });

  it("clearable → xoá chữ hoặc nút Xoá ngày đưa về rỗng; không clearable thì không có nút Xoá ngày, xoá chữ báo rỗng cho form", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount } = render(<Harness initial="2027-03-15" clearable onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /^Mở lịch/ }));
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
    await user.click(screen.getByRole("button", { name: /^Mở lịch/ }));
    expect(screen.queryByRole("button", { name: "Xoá ngày" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    // Xoá hết chữ ở ô bắt buộc: form nhận rỗng và tự báo thiếu ngày (không giữ ngày cũ âm thầm)
    await user.clear(screen.getByLabelText("Ngày"));
    expect(required).toHaveBeenLastCalledWith("");
  });

  it("aria-invalid được gắn lên ô gõ", () => {
    render(<Harness aria-invalid />);
    expect(screen.getByLabelText("Ngày")).toHaveAttribute("aria-invalid", "true");
  });
});
