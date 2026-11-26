import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { value: "percent", label: "Theo %" },
  { value: "amount", label: "Số tiền" },
] as const;

function Harness({ initial }: { initial?: "percent" | "amount" }) {
  const [value, setValue] = useState<"percent" | "amount" | undefined>(initial);
  return <SegmentedControl label="Tính theo" value={value} onChange={setValue} options={OPTIONS} />;
}

describe("SegmentedControl", () => {
  it("shows every choice up front and picks one with a single click", async () => {
    render(<Harness initial="percent" />);
    expect(screen.getByRole("radiogroup", { name: "Tính theo" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Theo %" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Số tiền" }));
    expect(screen.getByRole("radio", { name: "Số tiền" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Theo %" })).not.toBeChecked();
  });

  it("is one Tab stop and the arrow keys move the choice", async () => {
    render(<Harness initial="percent" />);
    const first = screen.getByRole("radio", { name: "Theo %" });
    expect(screen.getByRole("radio", { name: "Số tiền" })).toHaveAttribute("tabindex", "-1");
    first.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Số tiền" })).toBeChecked();
    await userEvent.keyboard("{ArrowLeft}");
    expect(first).toBeChecked();
  });

  it("with nothing chosen, the first choice takes the Tab stop", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: "Theo %" })).toHaveAttribute("tabindex", "0");
    expect(screen.queryByRole("radio", { checked: true })).toBeNull();
  });
});
