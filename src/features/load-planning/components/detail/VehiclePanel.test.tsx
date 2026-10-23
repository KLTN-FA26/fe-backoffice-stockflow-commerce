import { cleanup, render, screen } from "@testing-library/react";
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
  onRecalculate: () => {},
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
