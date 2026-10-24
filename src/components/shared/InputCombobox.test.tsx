import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { CommandEmpty, CommandItem, CommandList } from "@/components/ui/command";

import { InputCombobox } from "./InputCombobox";

const FRUITS = ["Apple", "Banana", "Cherry"];

function Fruits({ onPick }: { onPick: (fruit: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  return (
    <InputCombobox
      open={open}
      onOpenChange={setOpen}
      displayValue={value}
      placeholder="Chọn quả"
      searchPlaceholder="Tìm quả..."
      ariaLabel="Quả"
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

  it("bàn phím: ↓ mở danh sách, ↓ + Enter chọn, Esc đóng", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Fruits onPick={onPick} />);
    const box = screen.getByRole("combobox", { name: "Quả" });

    await user.click(box);
    await user.keyboard("{Escape}");
    expect(box).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenCalledWith("Banana");
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
