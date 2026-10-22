import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KIT_BAN, LAYOUT_PICKUP_KIT } from "../../__fixtures__/layouts";
import { computeKitBalance } from "../../lib/kit-balance";

import { KitBalanceBadge } from "./KitBalanceBadge";

describe("KitBalanceBadge", () => {
  it("says the kit is balanced when every vehicle holds whole sets", () => {
    render(<KitBalanceBadge balance={computeKitBalance([LAYOUT_PICKUP_KIT], [KIT_BAN])} />);
    expect(screen.getByText("Cân bằng bộ")).toBeInTheDocument();
    expect(screen.queryByText("Bộ bị lệch")).not.toBeInTheDocument();
  });

  it("warns, naming the vehicle and kit in the tooltip, when a set is split", () => {
    const boxes = LAYOUT_PICKUP_KIT.boxes.filter((b) => b.partName !== "Chân bàn");
    render(
      <KitBalanceBadge balance={computeKitBalance([{ ...LAYOUT_PICKUP_KIT, boxes }], [KIT_BAN])} />,
    );
    const badge = screen.getByText("Bộ bị lệch");
    expect(badge).toHaveAttribute("title", "Xe #1: bộ KIT-BAN-01 không đủ tỉ lệ");
    expect(screen.queryByText("Cân bằng bộ")).not.toBeInTheDocument();
  });

  it("shows nothing when the plan has no kits", () => {
    const { container } = render(
      <KitBalanceBadge balance={computeKitBalance([LAYOUT_PICKUP_KIT], [])} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
