import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { NumberInput, groupDigits } from "./NumberInput";

function Controlled({ onValue, decimal }: { onValue?: (v: string) => void; decimal?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <NumberInput
      aria-label="Số lượng"
      suffix="thùng"
      decimal={decimal}
      grouped={!decimal}
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        onValue?.(event.target.value);
      }}
    />
  );
}

describe("NumberInput", () => {
  it("is a text field with a number keypad, the unit beside it and no arrows", () => {
    render(<NumberInput aria-label="Số thùng" suffix="thùng" defaultValue="12" />);
    const field = screen.getByRole("textbox", { name: "Số thùng" });
    expect(field).toHaveAttribute("inputmode", "numeric");
    expect(field).toHaveValue("12");
    expect(screen.getByText("thùng")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("up and down arrows never change the value", async () => {
    render(<NumberInput aria-label="Số thùng" defaultValue="12" />);
    const field = screen.getByRole("textbox", { name: "Số thùng" });
    await userEvent.click(field);
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowDown}");
    expect(field).toHaveValue("12");
  });

  it("keeps only digits as typed or pasted, and hands the form plain digits", async () => {
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);
    const field = screen.getByRole("textbox", { name: "Số lượng" });
    await userEvent.type(field, "1a2b3");
    expect(onValue).toHaveBeenLastCalledWith("123");
    await userEvent.clear(field);
    await userEvent.click(field);
    await userEvent.paste("12.345");
    expect(onValue).toHaveBeenLastCalledWith("12345");
  });

  it("groups thousands for a count the page controls, without changing the value it hands back", async () => {
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);
    const field = screen.getByRole("textbox", { name: "Số lượng" });
    await userEvent.type(field, "1500000");
    expect(field).toHaveValue("1.500.000");
    expect(onValue).toHaveBeenLastCalledWith("1500000");
  });

  it("decimal mode accepts one separator, either . or ,", async () => {
    const onValue = vi.fn();
    render(<Controlled decimal onValue={onValue} />);
    const field = screen.getByRole("textbox", { name: "Số lượng" });
    expect(field).toHaveAttribute("inputmode", "decimal");
    await userEvent.type(field, "12,5,7");
    expect(onValue).toHaveBeenLastCalledWith("12.57");
  });

  it("groupDigits", () => {
    expect(groupDigits("1234567")).toBe("1.234.567");
    expect(groupDigits("999")).toBe("999");
    expect(groupDigits("")).toBe("");
  });
});
