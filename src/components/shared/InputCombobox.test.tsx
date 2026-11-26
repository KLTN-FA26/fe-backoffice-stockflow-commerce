import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { CommandEmpty, CommandItem, CommandList } from "@/components/ui/command";

import { ComboboxMoreHint, InputCombobox } from "./InputCombobox";

const FRUITS = ["Apple", "Banana", "Cherry"];

function Fruits({ onPick, initial = "" }: { onPick: (fruit: string) => void; initial?: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);
  return (
    <InputCombobox
      open={open}
      onOpenChange={setOpen}
      displayValue={value}
      placeholder="Chọn quả"
      searchPlaceholder="Tìm quả..."
      ariaLabel="Quả"
      onClear={() => setValue("")}
    >
      <CommandList>
        <CommandEmpty>Không có</CommandEmpty>
        {FRUITS.map((fruit) => (
          <CommandItem
            key={fruit}
            value={fruit}
            onSelect={() => {
              setValue(fruit);
              onPick(fruit);
              setOpen(false);
            }}
          >
            {fruit}
          </CommandItem>
        ))}
      </CommandList>
    </InputCombobox>
  );
}

beforeAll(() => {
  // jsdom không có ResizeObserver / scrollIntoView mà `cmdk` dùng
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

describe("InputCombobox", () => {
  it("gõ thẳng vào ô → lọc danh sách, chọn → ô hiện giá trị và đóng", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Fruits onPick={onPick} />);
    const box = screen.getByRole("combobox", { name: "Quả" });
    expect(box).toHaveAttribute("aria-expanded", "false");

    await user.type(box, "ban");
    expect(box).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Apple" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "Banana" }));
    expect(onPick).toHaveBeenCalledWith("Banana");
    expect(box).toHaveValue("Banana");
    expect(box).toHaveAttribute("aria-expanded", "false");
  });

  it("bấm vào thân ô, Enter, ↑/↓ KHÔNG mở danh sách — chỉ đặt con trỏ", async () => {
    const user = userEvent.setup();
    render(<Fruits onPick={vi.fn()} />);
    const box = screen.getByRole("combobox", { name: "Quả" });

    await user.click(box);
    expect(box).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("nút mũi tên mở / đóng danh sách đầy đủ; Alt+↓ mở cho người dùng bàn phím", async () => {
    const user = userEvent.setup();
    render(<Fruits onPick={vi.fn()} />);
    const box = screen.getByRole("combobox", { name: "Quả" });
    const arrow = screen.getByRole("button", { name: "Mở danh sách Quả" });

    await user.click(arrow);
    expect(box).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    await user.click(arrow);
    expect(box).toHaveAttribute("aria-expanded", "false");

    box.focus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(box).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(box).toHaveValue("Banana");
  });

  it("gõ rồi xoá hết chữ → đóng; mở bằng nút mũi tên thì xoá chữ không đóng", async () => {
    const user = userEvent.setup();
    render(<Fruits onPick={vi.fn()} />);
    const box = screen.getByRole("combobox", { name: "Quả" });

    await user.type(box, "a");
    expect(box).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Backspace}");
    expect(box).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Mở danh sách Quả" }));
    await user.type(box, "a");
    await user.keyboard("{Backspace}");
    expect(box).toHaveAttribute("aria-expanded", "true");
  });

  it("giữ tên đang chọn trong ô khi bấm vào; mở bằng mũi tên không xoá tên; ✕ bỏ chọn", async () => {
    const user = userEvent.setup();
    render(<Fruits onPick={vi.fn()} initial="Banana" />);
    const box = screen.getByRole("combobox", { name: "Quả" });
    expect(box).toHaveValue("Banana");

    await user.click(box);
    expect(box).toHaveValue("Banana");
    expect(box).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Mở danh sách Quả" }));
    // Mở ra: ô tìm trống, tên đang chọn nằm ở placeholder; đóng lại thì tên hiện lại
    expect(box).toHaveValue("");
    expect(box).toHaveAttribute("placeholder", "Banana");
    await user.keyboard("{Escape}");
    expect(box).toHaveValue("Banana");

    await user.click(screen.getByRole("button", { name: "Bỏ chọn Quả" }));
    expect(box).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Bỏ chọn Quả" })).not.toBeInTheDocument();
  });

  it("đang giữ tên, gõ thêm ký tự → chỉ phần gõ thêm là từ khoá tìm", async () => {
    const user = userEvent.setup();
    render(<Fruits onPick={vi.fn()} initial="Banana" />);
    const box = screen.getByRole("combobox", { name: "Quả" });

    await user.click(box);
    await user.keyboard("{End}ch");
    expect(box).toHaveAttribute("aria-expanded", "true");
    expect(box).toHaveValue("ch");
    expect(screen.getByRole("option", { name: "Cherry" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Apple" })).not.toBeInTheDocument();
  });

  it("↓ + Enter khi đang gõ chọn mục khớp, Esc đóng", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Fruits onPick={onPick} />);
    const box = screen.getByRole("combobox", { name: "Quả" });

    await user.type(box, "a");
    await user.keyboard("{Escape}");
    expect(box).toHaveAttribute("aria-expanded", "false");
    await user.type(box, "n");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenCalled();
  });

  it("✕ vào được bằng Tab (bàn phím), Enter bỏ chọn và con trỏ về ô", async () => {
    const user = userEvent.setup();
    render(<Fruits onPick={vi.fn()} initial="Banana" />);
    const box = screen.getByRole("combobox", { name: "Quả" });
    box.focus();
    await user.tab();
    const clear = screen.getByRole("button", { name: "Bỏ chọn Quả" });
    expect(clear).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(box).toHaveValue("");
    expect(box).toHaveFocus();
  });

  it("chọn hết chữ rồi Delete khi danh sách đóng → bỏ chọn (gọi onClear), không bật lại tên cũ", async () => {
    const user = userEvent.setup();
    render(<Fruits onPick={vi.fn()} initial="Banana" />);
    const box = screen.getByRole("combobox", { name: "Quả" });
    await user.click(box);
    await user.keyboard("{Control>}a{/Control}{Delete}");
    expect(box).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Bỏ chọn Quả" })).not.toBeInTheDocument();
    expect(box).toHaveAttribute("aria-expanded", "false");
  });

  it("aria-controls trỏ tới thẻ role=listbox của danh sách (không phải khung popover)", async () => {
    const user = userEvent.setup();
    render(<Fruits onPick={vi.fn()} />);
    const box = screen.getByRole("combobox", { name: "Quả" });
    await user.click(screen.getByRole("button", { name: "Mở danh sách Quả" }));
    const controls = box.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(screen.getByRole("listbox")).toHaveAttribute("id", controls);
  });

  it("ComboboxMoreHint: báo còn N kết quả; N ≤ 0 thì ẩn", () => {
    const { rerender } = render(<ComboboxMoreHint remaining={7} />);
    expect(screen.getByRole("status")).toHaveTextContent("Còn 7 kết quả — gõ thêm để thu hẹp");
    rerender(<ComboboxMoreHint remaining={0} />);
    expect(screen.queryByText(/Còn/)).not.toBeInTheDocument();
    rerender(<ComboboxMoreHint />);
    expect(screen.getByText("Còn kết quả khác — gõ thêm để thu hẹp")).toBeInTheDocument();
  });

  it("ô đang đóng, focus bằng bàn phím rồi gõ + Enter (máy quét) → chọn mục đầu khớp", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Fruits onPick={onPick} />);
    const box = screen.getByRole("combobox", { name: "Quả" });
    box.focus();
    await user.keyboard("che{Enter}");
    expect(onPick).toHaveBeenCalledWith("Cherry");
    expect(box).toHaveValue("Cherry");
  });
});
