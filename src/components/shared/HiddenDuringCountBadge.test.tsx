import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { INVENTORY_LABELS } from "@/constants/inventory";

import { HiddenDuringCountBadge } from "./HiddenDuringCountBadge";

describe("HiddenDuringCountBadge", () => {
  it("says the slot is being counted and explains why there is no number", () => {
    render(<HiddenDuringCountBadge />);
    const badge = screen.getByText(INVENTORY_LABELS.hiddenDuringCount);
    expect(badge).toHaveAttribute("title", INVENTORY_LABELS.hiddenDuringCountHint);
    expect(badge.textContent).not.toMatch(/\d/);
  });
});
