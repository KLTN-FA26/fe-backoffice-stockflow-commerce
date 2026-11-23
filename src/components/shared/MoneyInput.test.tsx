import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MoneyInput, groupMoney, moneyDigits, parseMoney } from "./MoneyInput";

function Harness({
  initial = "",
  onChange = () => {},
  echo,
}: {
  initial?: string;
  onChange?: (digits: string) => void;
  echo?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="m">Số tiền</label>
      <MoneyInput
        id="m"
        value={value}
        echo={echo}
        onChange={(digits) => {
          setValue(digits);
          onChange(digits);
        }}
      />
    </>
  );
}

describe("moneyDigits / groupMoney", () => {
  it("keeps digits only, drops leading zeros, keeps a lone 0", () => {
    expect(moneyDigits("1.500.000")).toBe("1500000");
    expect(moneyDigits("1,500,000 ₫")).toBe("1500000");
    expect(moneyDigits("0012")).toBe("12");
    expect(moneyDigits("0")).toBe("0");
    expect(moneyDigits("")).toBe("");
    expect(moneyDigits("9".repeat(20))).toHaveLength(15);
  });

  it("reads a decimal part in either locale instead of taking its digits as more VND", () => {
    // Zero decimals are dropped: 1.500.000 ₫, never 150.000.000 ₫.
    expect(parseMoney("1,500,000.00")).toEqual({ digits: "1500000", fraction: "zero" });
    expect(parseMoney("1.500.000,00")).toEqual({ digits: "1500000", fraction: "zero" });
    expect(parseMoney("1500000.00")).toEqual({ digits: "1500000", fraction: "zero" });
    expect(parseMoney("1.500.000,0 ₫")).toEqual({ digits: "1500000", fraction: "zero" });
    expect(moneyDigits("1,500,000.00")).toBe("1500000");
    expect(moneyDigits("1.500.000,00")).toBe("1500000");
    // Non-zero decimals are flagged: VND has no smaller unit.
    expect(parseMoney("1,500,000.50").fraction).toBe("nonzero");
    expect(parseMoney("1.500.000,5").fraction).toBe("nonzero");
    expect(parseMoney("1.500.000,05 ₫").fraction).toBe("nonzero");
  });

  it("does not take a thousands group for a decimal part", () => {
    expect(parseMoney("1500000")).toEqual({ digits: "1500000", fraction: "none" });
    expect(parseMoney("1.500.000")).toEqual({ digits: "1500000", fraction: "none" });
    expect(parseMoney("1,500,000")).toEqual({ digits: "1500000", fraction: "none" });
    expect(parseMoney("1,500,000 ₫")).toEqual({ digits: "1500000", fraction: "none" });
    expect(parseMoney("1 500 000 đ")).toEqual({ digits: "1500000", fraction: "none" });
  });

  it("groups thousands with dots", () => {
    expect(groupMoney("1500000")).toBe("1.500.000");
    expect(groupMoney("999")).toBe("999");
    expect(groupMoney("")).toBe("");
  });
});

describe("MoneyInput", () => {
  it("groups as you type and hands out plain digits", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Số tiền");
    await user.type(input, "1500000");
    expect(input).toHaveValue("1.500.000");
    expect(onChange).toHaveBeenLastCalledWith("1500000");
  });

  it("a pasted '1.500.000' is read as one million five hundred thousand", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Số tiền");
    await user.click(input);
    await user.paste("1.500.000");
    expect(input).toHaveValue("1.500.000");
    expect(onChange).toHaveBeenLastCalledWith("1500000");
  });

  it("a pasted amount with zero decimals keeps its whole VND, in either locale", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Số tiền");
    await user.click(input);
    await user.paste("1,500,000.00");
    expect(input).toHaveValue("1.500.000");
    expect(onChange).toHaveBeenLastCalledWith("1500000");
    await user.clear(input);
    await user.paste("1.500.000,00");
    expect(input).toHaveValue("1.500.000");
    expect(onChange).toHaveBeenLastCalledWith("1500000");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("refuses non-zero decimals with a field message and keeps the amount", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2000" onChange={onChange} />);
    const input = screen.getByLabelText("Số tiền");
    await user.tripleClick(input);
    await user.paste("1,500,000.50");
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("2.000");
    expect(screen.getByRole("alert")).toHaveTextContent("Số tiền VND không có phần lẻ");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe("m-fraction");

    await user.tripleClick(input);
    await user.paste("1.500.000,5");
    expect(onChange).not.toHaveBeenCalled();

    // The next accepted amount clears the message.
    await user.tripleClick(input);
    await user.paste("1.500.000");
    expect(onChange).toHaveBeenLastCalledWith("1500000");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("backspacing the last digit is not read as a decimal part", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="1500" onChange={onChange} />);
    const input = screen.getByLabelText("Số tiền");
    await user.click(input);
    await user.keyboard("{End}{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith("150");
    expect(input).toHaveValue("150");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a deletion without an input type is still read as plain digits", () => {
    const onChange = vi.fn();
    render(<Harness initial="1500" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Số tiền"), { target: { value: "1.50" } });
    expect(onChange).toHaveBeenLastCalledWith("150");
  });

  it("shows the ₫ suffix and, with echo, a short reading of the amount", async () => {
    render(<Harness initial="15000000" echo />);
    expect(screen.getByText("₫")).toBeInTheDocument();
    const input = screen.getByLabelText("Số tiền");
    expect(screen.getByText("= 15 tr ₫")).toBeInTheDocument();
    expect(input.getAttribute("aria-describedby")).toBe("m-echo");
  });

  it("keeps the caret after the digit just typed in the middle", () => {
    render(<Harness initial="150000" />);
    const input = screen.getByLabelText<HTMLInputElement>("Số tiền");
    input.focus();
    // "150.000" → the user types "2" after "15": the browser value is "1520.000" with the caret at 3.
    input.setSelectionRange(3, 3);
    fireEvent.change(input, { target: { value: "1520.000", selectionStart: 3, selectionEnd: 3 } });
    expect(input).toHaveValue("1.520.000");
    // Three digits were before the caret ("152"): it now sits after the "2", past the inserted dot.
    expect(input.selectionStart).toBe(4);
  });

  it("clearing gives an empty value, not 0", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="5000" onChange={onChange} />);
    await user.clear(screen.getByLabelText("Số tiền"));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByLabelText("Số tiền")).toHaveValue("");
  });
});
