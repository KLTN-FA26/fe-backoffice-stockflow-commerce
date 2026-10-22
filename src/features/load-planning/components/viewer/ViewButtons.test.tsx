import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ViewButtons } from "./ViewButtons";

describe("ViewButtons", () => {
  it("offers the four views in a labelled group", () => {
    render(<ViewButtons onSelect={() => {}} />);
    const group = screen.getByRole("group", { name: "Góc nhìn" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Chéo",
      "Trên",
      "Bên",
      "Cửa",
    ]);
  });

  it("reports the view that was clicked, again on every click", async () => {
    const onSelect = vi.fn();
    render(<ViewButtons onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "Cửa" }));
    await userEvent.click(screen.getByRole("button", { name: "Cửa" }));
    await userEvent.click(screen.getByRole("button", { name: "Trên" }));
    expect(onSelect.mock.calls).toEqual([["end"], ["end"], ["top"]]);
  });
});
