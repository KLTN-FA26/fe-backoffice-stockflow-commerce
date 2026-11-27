import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { patchCmdk } from "../../__fixtures__/render";

import { CodeCombobox } from "./CodeCombobox";

import type { CodeOption } from "../../pick-line-selectors";

// Cố ý KHÔNG theo thứ tự: mã dài hơn ("A-01-10") đứng trước mã ngắn ("A-01-1") chứa trong nó
const OPTIONS: CodeOption[] = ["A-01-10", "A-01-1", "A-01-11", "B-02-1"].map((code) => ({
  value: code,
  label: code,
}));

function Harness({ onPick }: { onPick: (code: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <CodeCombobox
      id="loc"
      label="Vị trí"
      value={value}
      onChange={(next) => {
        setValue(next);
        onPick(next);
      }}
      options={OPTIONS}
      placeholder="Chọn vị trí"
    />
  );
}

beforeAll(() => patchCmdk());

describe("CodeCombobox — quét / gõ đủ mã rồi Enter (máy quét kiểu bàn phím)", () => {
  it("gõ đủ 'A-01-1' + Enter → chọn đúng A-01-1, không phải A-01-10", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    const box = screen.getByRole("combobox", { name: "Vị trí" });
    await user.click(box);
    await user.type(box, "A-01-1{Enter}");
    expect(onPick).toHaveBeenLastCalledWith("A-01-1");
    expect(box).toHaveValue("A-01-1");
  });

  it("không phân biệt hoa thường: 'a-01-1' + Enter → A-01-1", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    await user.type(screen.getByRole("combobox", { name: "Vị trí" }), "a-01-1{Enter}");
    expect(onPick).toHaveBeenLastCalledWith("A-01-1");
  });

  it("gõ đủ mã dài 'A-01-10' + Enter → A-01-10", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    await user.type(screen.getByRole("combobox", { name: "Vị trí" }), "A-01-10{Enter}");
    expect(onPick).toHaveBeenLastCalledWith("A-01-10");
  });

  it("mã chưa gõ đủ: mã trùng hệt / bắt đầu bằng đứng trước, vẫn có 'Còn N' khi hơn 10 mục", async () => {
    const user = userEvent.setup();
    render(<Harness onPick={vi.fn()} />);
    await user.type(screen.getByRole("combobox", { name: "Vị trí" }), "A-01");
    const names = screen.getAllByRole("option").map((o) => o.textContent);
    expect(names).toEqual(["A-01-10", "A-01-1", "A-01-11"]);
  });
});
