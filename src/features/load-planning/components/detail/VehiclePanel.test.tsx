import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LOAD_PLAN_PRINT_LABELS, UI_LABELS } from "@/constants";

import { LAYOUT_PICKUP_KIT } from "../../__fixtures__/layouts";
import { PLAN_ID, vehicleOfLayout } from "../../__fixtures__/plans";
import { VehiclePanel } from "./VehiclePanel";

vi.mock("../viewer/VehicleViewer", () => ({ VehicleViewer: () => <div data-testid="viewer" /> }));

afterEach(cleanup);

const props = {
  planId: PLAN_ID,
  vehicle: vehicleOfLayout({ ...LAYOUT_PICKUP_KIT, seq: 2 }),
  layout: undefined,
  colorMap: new Map<string, string>(),
  pending: false,
  canDrop: false,
  onRecalculate: () => {},
  onDrop: () => {},
};

describe("VehiclePanel — print link", () => {
  it("links the vehicle to its loading-sheet print page, with or without the recalculate action", () => {
    const { rerender } = render(<VehiclePanel {...props} canRecalculate />);
    const href = `/admin/load-plans/${PLAN_ID}/vehicles/2/print`;
    expect(screen.getByRole("link", { name: LOAD_PLAN_PRINT_LABELS.printButton })).toHaveAttribute(
      "href",
      href,
    );
    expect(
      screen.getByRole("button", { name: UI_LABELS.loadPlan.detail.actions.recalculate }),
    ).toBeInTheDocument();

    rerender(<VehiclePanel {...props} canRecalculate={false} />);
    expect(screen.getByRole("link", { name: LOAD_PLAN_PRINT_LABELS.printButton })).toHaveAttribute(
      "href",
      href,
    );
    expect(
      screen.queryByRole("button", { name: UI_LABELS.loadPlan.detail.actions.recalculate }),
    ).not.toBeInTheDocument();
  });
});

describe("VehiclePanel — drop from plan (SCRUM-474 UNLOAD-DROP)", () => {
  const DROP = UI_LABELS.shipping.ftl.controlledCancel.drop.button;

  it("shows 'Bỏ xe khỏi kế hoạch' only when the lifecycle allows it, and calls onDrop", async () => {
    const onDrop = vi.fn();
    const { rerender } = render(<VehiclePanel {...props} canRecalculate={false} />);
    expect(screen.queryByRole("button", { name: DROP })).not.toBeInTheDocument();

    rerender(<VehiclePanel {...props} canRecalculate={false} canDrop onDrop={onDrop} />);
    await userEvent.setup().click(screen.getByRole("button", { name: DROP }));
    expect(onDrop).toHaveBeenCalledTimes(1);
  });
});
