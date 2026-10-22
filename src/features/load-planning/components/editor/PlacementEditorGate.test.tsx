import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";

import { onePlan, typesPage } from "../../__fixtures__/editor-screen";
import {
  LOAD_PLAN_ACTORS as ACTORS,
  mockLoadPlanApi,
  renderLoadPlanScreen,
} from "../../__fixtures__/render-plan";

import { PlacementEditorGate } from "./PlacementEditorGate";

import type { Layout } from "../../types";

vi.mock("./EditorViewer", () => ({ EditorViewer: () => <div data-testid="editor-viewer" /> }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const E = UI_LABELS.loadPlan.editor;
function Harness({ initial }: { initial: Layout[] | undefined }) {
  const [layouts, setLayouts] = useState(initial);
  return (
    <>
      <button type="button" onClick={() => setLayouts([])}>
        refetch-breaks-data
      </button>
      <PlacementEditorGate plan={onePlan().plan} layouts={layouts} onExit={() => {}} />
    </>
  );
}

function setup(layouts: Layout[] | undefined, vehicleTypes: () => unknown = () => typesPage()) {
  mockLoadPlanApi(ACTORS.dispatcher, { get: { "/fulfillment/vehicle-types": vehicleTypes } });
  renderLoadPlanScreen(<Harness initial={layouts} />);
}

describe("PlacementEditorGate", () => {
  it("waits while the layouts have not arrived", async () => {
    setup(undefined);
    expect(await screen.findByText(E.loadingEditor)).toBeInTheDocument();
  });

  it("says the data is being reloaded when the plan and the layouts disagree, and does not open", async () => {
    setup([]);
    expect(await screen.findByText(E.notReady)).toBeInTheDocument();
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });

  it("opens once the data is consistent and then keeps the opened editor even if a background refetch makes the data disagree", async () => {
    const user = userEvent.setup();
    const { layouts } = onePlan();
    setup(layouts);
    expect(await screen.findByRole("toolbar", { name: E.toolbar.group })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "refetch-breaks-data" }));
    expect(screen.getByRole("toolbar", { name: E.toolbar.group })).toBeInTheDocument();
    expect(screen.queryByText(E.notReady)).not.toBeInTheDocument();
  });

  it("still opens when the vehicle-type catalogue cannot be read (no door pre-check, the BE still checks)", async () => {
    const { layouts } = onePlan();
    setup(layouts, () => {
      throw new Error("403");
    });
    expect(await screen.findByRole("toolbar", { name: E.toolbar.group })).toBeInTheDocument();
  });
});
