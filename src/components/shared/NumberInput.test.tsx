import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NumberInput } from "./NumberInput";

describe("NumberInput", () => {
  it("is a number field with the unit beside it, outside the value", () => {
    render(<NumberInput aria-label="Số thùng" suffix="thùng" defaultValue={12} />);
    const field = screen.getByRole("spinbutton", { name: "Số thùng" });
    expect(field).toHaveValue(12);
    expect(screen.getByText("thùng")).toBeInTheDocument();
  });

  it("drops focus on mouse-wheel so scrolling the page never changes the number", () => {
    render(<NumberInput aria-label="Tỷ lệ" defaultValue={5} />);
    const field = screen.getByRole("spinbutton", { name: "Tỷ lệ" });
    field.focus();
    expect(field).toHaveFocus();
    fireEvent.wheel(field, { deltaY: 100 });
    expect(field).not.toHaveFocus();
    expect(field).toHaveValue(5);
  });
});
