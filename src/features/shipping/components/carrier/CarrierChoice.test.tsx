import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CarrierChoice } from "./CarrierChoice";

const OPTIONS = [
  { value: "STAGING", label: "Thử nghiệm" },
  { value: "PRODUCTION", label: "Chạy thật" },
] as const;

describe("CarrierChoice — 2–4 giá trị cố định hiện sẵn (S01-6)", () => {
  it("shows every value at once, one click picks, no dropdown", async () => {
    const onChange = vi.fn();
    render(
      <CarrierChoice label="Môi trường" value="STAGING" onChange={onChange} options={OPTIONS} />,
    );
    expect(screen.getByRole("radiogroup", { name: "Môi trường" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Thử nghiệm" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Chạy thật" }));
    expect(onChange).toHaveBeenCalledWith("PRODUCTION");
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("arrow keys move the choice; one tab stop for the group", async () => {
    const onChange = vi.fn();
    render(
      <CarrierChoice label="Môi trường" value="STAGING" onChange={onChange} options={OPTIONS} />,
    );
    screen.getByRole("radio", { name: "Thử nghiệm" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("PRODUCTION");
    expect(screen.getByRole("radio", { name: "Thử nghiệm" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Chạy thật" })).toHaveAttribute("tabindex", "-1");
  });

  it("nothing chosen yet: the first value is the tab stop and none is checked", () => {
    render(
      <CarrierChoice label="Môi trường" value={undefined} onChange={vi.fn()} options={OPTIONS} />,
    );
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
    ]);
    expect(screen.getByRole("radio", { name: "Thử nghiệm" })).toHaveAttribute("tabindex", "0");
  });
});
