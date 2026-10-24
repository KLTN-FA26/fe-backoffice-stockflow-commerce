import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LOAD_PLAN_ERROR_MESSAGES as ERRORS, PLACEMENT_RULE_LABELS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { LAYOUT_PICKUP_KIT } from "../../__fixtures__/layouts";
import {
  onePlan,
  openEditor,
  putCalls,
  renderEditor,
  stoolButtons,
  twoVehiclePlan,
} from "../../__fixtures__/editor-screen";
import { LOAD_PLAN_ACTORS as ACTORS } from "../../__fixtures__/render-plan";

// jsdom không có WebGL: khung 3D thay bằng nút cho từng kiện / ô gợi ý (hình học cảnh test ở lib/editor-scene.test.ts)
vi.mock("./EditorViewer", () => ({
  EditorViewer: (props: {
    vehicle: { code: string; boxes: { ref: string; label: string }[] };
    tones: ReadonlyMap<string, string>;
    ghosts: { id: string }[];
    emptySpaces: unknown[] | null;
    onBoxPick: (ref: string, additive: boolean) => void;
    onGhostPlace: (id: string) => void;
  }) => (
    <div data-testid="editor-viewer">
      {props.emptySpaces ? (
        <p>{`xem chỗ trống: ${props.emptySpaces.length}`}</p>
      ) : (
        props.vehicle.boxes.map((box) => (
          <button
            key={box.ref}
            type="button"
            data-tone={props.tones.get(box.ref) ?? "idle"}
            onClick={(event) => props.onBoxPick(box.ref, event.shiftKey)}
          >{`kiện ${box.label}`}</button>
        ))
      )}
      {props.ghosts.map((ghost, index) => (
        <button
          key={ghost.id}
          type="button"
          onClick={() => props.onGhostPlace(ghost.id)}
        >{`ô ${index}`}</button>
      ))}
    </div>
  ),
}));

vi.mock("../viewer/VehicleViewer", () => ({ VehicleViewer: () => <div data-testid="viewer" /> }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const L = UI_LABELS.loadPlan.detail;
const E = UI_LABELS.loadPlan.editor;

describe("trình soạn xếp tay — phân quyền và trạng thái", () => {
  it("only an actor with :UPDATE sees the button, and only on a PLANNED plan that has a vehicle", async () => {
    renderEditor(ACTORS.dispatcher);
    expect(await screen.findByRole("button", { name: E.open })).toBeInTheDocument();
    cleanup();
    renderEditor(ACTORS.viewOnly);
    expect(await screen.findByText("LP-20261022-0001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: E.open })).not.toBeInTheDocument();
  });

  it.each(["DRAFT", "CONFIRMED", "CANCELLED", "DISPATCHED"] as const)(
    "%s plan: no editor button even for a dispatcher",
    async (status) => {
      const server = onePlan();
      renderEditor(ACTORS.dispatcher, { ...server, plan: { ...server.plan, status } });
      expect(await screen.findByText("LP-20261022-0001")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: E.open })).not.toBeInTheDocument();
    },
  );

  it("a PLANNED plan without any vehicle has nothing to edit", async () => {
    const server = onePlan();
    renderEditor(ACTORS.dispatcher, {
      layouts: [],
      plan: { ...server.plan, vehicles: [], packages: [], packageCount: 0, placedCount: 0 },
    });
    expect(await screen.findByText("LP-20261022-0001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: E.open })).not.toBeInTheDocument();
  });

  it("opening swaps the tabs and the plan actions for the editor; leaving brings them back", async () => {
    const user = userEvent.setup();
    renderEditor(ACTORS.dispatcher);
    await openEditor(user);
    expect(screen.queryByRole("button", { name: L.actions.confirm })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.save.save })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: E.exit }));
    expect(await screen.findByRole("button", { name: L.actions.confirm })).toBeInTheDocument();
  });
});

describe("trình soạn xếp tay — thao tác", () => {
  it("selecting a box shows its spot; nudging moves it and stops flush at the wall", async () => {
    const user = userEvent.setup();
    renderEditor(ACTORS.dispatcher);
    await openEditor(user);
    await user.click(stoolButtons()[2]);
    const panel = screen.getByRole("region", { name: E.selection.title });
    expect(within(panel).getByText("(1000, 0, 1200) mm")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: E.selection.nudge.toDoor }));
    expect(within(panel).getByText("(1000, 0, 1250) mm")).toBeInTheDocument();
    // z 1250 + 500 = 1750; wall at 1800 → only 50 left, then blocked
    await user.click(within(panel).getByRole("button", { name: E.selection.nudge.toDoor }));
    expect(within(panel).getByText("(1000, 0, 1300) mm")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: E.selection.nudge.toDoor }));
    expect(
      await screen.findByText(UI_LABELS.loadPlan.editor.selection.stepNote),
    ).toBeInTheDocument();
    expect(screen.getByText("Kiện đã sát vật cản, không nhích thêm được.")).toBeInTheDocument();
  });

  it("moves a box to the tray, undo puts it back, redo takes it out again", async () => {
    const user = userEvent.setup();
    renderEditor(ACTORS.dispatcher);
    await openEditor(user);
    expect(stoolButtons()).toHaveLength(3);
    await user.click(stoolButtons()[0]);
    await user.click(screen.getByRole("button", { name: E.selection.toTray }));
    expect(stoolButtons()).toHaveLength(2);
    const tray = screen.getByRole("region", { name: E.tray.title });
    expect(within(tray).getByRole("button", { name: /Chọn Ghế bar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.save.save })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: E.toolbar.undo }));
    expect(stoolButtons()).toHaveLength(3);
    expect(screen.getByRole("button", { name: E.save.save })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: E.toolbar.redo }));
    expect(stoolButtons()).toHaveLength(2);
  });

  it("places a tray parcel on a landing spot and saves exactly what the screen shows", async () => {
    const user = userEvent.setup();
    const { put, state } = renderEditor(ACTORS.dispatcher);
    await openEditor(user);
    const moved = state.layouts[0].boxes.find((b) => b.label === "GB-01" && b.xMm === 1000);
    await user.click(stoolButtons()[2]);
    await user.click(screen.getByRole("button", { name: E.selection.toTray }));
    await user.click(screen.getByRole("button", { name: /Chọn Ghế bar/ }));
    const spot = await screen.findByRole("button", { name: /^ô 0$/ });
    await user.click(spot);
    // back on a vehicle, tray empty again
    expect(await screen.findByText(E.tray.empty)).toBeInTheDocument();
    expect(stoolButtons()).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: E.save.save }));
    await waitFor(() => expect(putCalls(put)).toHaveLength(1));
    const body = putCalls(put)[0][1] as {
      expectedVersion: number;
      vehicles: { seq: number; boxes: { ref: string; orientation: string; xMm: number }[] }[];
      tray: string[];
    };
    expect(body.expectedVersion).toBe(4);
    expect(body.tray).toEqual([]);
    expect(body.vehicles).toHaveLength(1);
    expect(body.vehicles[0].boxes).toHaveLength(LAYOUT_PICKUP_KIT.boxes.length);
    const sent = body.vehicles[0].boxes.find((b) => b.ref === moved?.ref);
    expect(sent).toMatchObject({ orientation: expect.stringMatching(/^[LWH]{3}$/) });
    // one parcel exactly once
    const refs = body.vehicles[0].boxes.map((b) => b.ref);
    expect(new Set(refs).size).toBe(refs.length);
    // saved → back to the detail page
    expect(await screen.findByRole("button", { name: E.open })).toBeInTheDocument();
  });

  it("moving a box to another vehicle goes through the shared tray and lands on the other vehicle's spots", async () => {
    const user = userEvent.setup();
    const { put } = renderEditor(ACTORS.dispatcher, twoVehiclePlan());
    await openEditor(user);
    await user.click(stoolButtons()[0]);
    await user.click(screen.getByRole("button", { name: E.selection.toVehicle(2) }));
    const tabs = screen.getByRole("group", { name: L.vehicleSwitcher });
    expect(within(tabs).getByRole("button", { name: /Xe #2/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const spot = await screen.findByRole("button", { name: /^ô 0$/ });
    await user.click(spot);
    await user.click(screen.getByRole("button", { name: E.save.save }));
    await waitFor(() => expect(putCalls(put)).toHaveLength(1));
    const body = putCalls(put)[0][1] as {
      vehicles: { seq: number; boxes: unknown[] }[];
      tray: string[];
    };
    expect(body.vehicles.map((v) => [v.seq, v.boxes.length])).toEqual([
      [1, LAYOUT_PICKUP_KIT.boxes.length - 1],
      [2, LAYOUT_PICKUP_KIT.boxes.length + 1],
    ]);
    expect(body.tray).toEqual([]);
  });

  it("bulk move-out from the product table sends the typed quantity to the tray", async () => {
    const user = userEvent.setup();
    renderEditor(ACTORS.dispatcher);
    await openEditor(user);
    const lines = screen.getByRole("region", { name: E.lines.title });
    await user.type(within(lines).getByLabelText(`${E.lines.qty}: Ghế bar`), "2");
    await user.click(within(lines).getByRole("button", { name: `${E.lines.moveOut} Ghế bar` }));
    expect(stoolButtons()).toHaveLength(1);
    expect(
      within(screen.getByRole("region", { name: E.tray.title })).getByRole("button", {
        name: /Chọn Ghế bar/,
      }),
    ).toHaveTextContent("×2");
  });

  it("the empty-space view hides the cargo and shows the largest pockets", async () => {
    const user = userEvent.setup();
    renderEditor(ACTORS.dispatcher);
    await openEditor(user);
    await user.click(screen.getByRole("button", { name: E.toolbar.emptyOff }));
    expect(await screen.findByText(/xem chỗ trống: [1-9]/)).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /kiện GB-01/ })).toHaveLength(0);
  });
});

describe("trình soạn xếp tay — đặt kiện từ khay bằng bàn phím", () => {
  const spotName = /^Xe #1 · vị trí \((\d+), (\d+), (\d+)\) mm · .+ · đỡ \d+%$/;

  async function trayStool(user: ReturnType<typeof userEvent.setup>) {
    await user.click(stoolButtons()[2]);
    await user.click(screen.getByRole("button", { name: E.selection.toTray }));
  }

  it("a tray item is focusable and Enter selects it; its landing spots are a labelled listbox with accessible names", async () => {
    const user = userEvent.setup();
    renderEditor(ACTORS.dispatcher);
    await openEditor(user);
    await trayStool(user);
    const chip = screen.getByRole("button", { name: /Chọn Ghế bar/ });
    chip.focus();
    await user.keyboard("{Enter}");
    expect(chip).toHaveAttribute("aria-pressed", "true");
    const list = await screen.findByRole("listbox", { name: E.tray.spotList.aria });
    const options = within(list).getAllByRole("option");
    expect(options.length).toBeGreaterThan(1);
    for (const option of options) expect(option).toHaveAccessibleName(spotName);
  });

  it("arrow keys move through the spots, Enter places the chosen one, and that exact spot is what is saved", async () => {
    const user = userEvent.setup();
    const { put } = renderEditor(ACTORS.dispatcher);
    await openEditor(user);
    await trayStool(user);
    await user.click(screen.getByRole("button", { name: /Chọn Ghế bar/ }));
    const list = await screen.findByRole("listbox", { name: E.tray.spotList.aria });
    list.focus();
    const options = () => within(list).getAllByRole("option");
    expect(options()[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(options()[1]).toHaveAttribute("aria-selected", "true");
    expect(options()[0]).toHaveAttribute("aria-selected", "false");
    expect(list).toHaveAttribute("aria-activedescendant", options()[1].id);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(options()[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(options().at(-1)).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    const chosen = options()[options().length - 2];
    const [, x, y, z] =
      spotName.exec(chosen.getAttribute("aria-label") ?? chosen.textContent ?? "") ?? [];
    await user.keyboard("{Enter}");
    expect(await screen.findByText(E.tray.empty)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: E.save.save }));
    await waitFor(() => expect(putCalls(put)).toHaveLength(1));
    const body = putCalls(put)[0][1] as {
      vehicles: { boxes: { ref: string; xMm: number; yMm: number; zMm: number }[] }[];
    };
    const placed = body.vehicles[0].boxes.at(-1);
    expect([placed?.xMm, placed?.yMm, placed?.zMm]).toEqual([Number(x), Number(y), Number(z)]);
  });

  it("Space also places; arrow keys alone place nothing", async () => {
    const user = userEvent.setup();
    renderEditor(ACTORS.dispatcher);
    await openEditor(user);
    await trayStool(user);
    await user.click(screen.getByRole("button", { name: /Chọn Ghế bar/ }));
    const list = await screen.findByRole("listbox", { name: E.tray.spotList.aria });
    list.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.queryByText(E.tray.empty)).not.toBeInTheDocument();
    await user.keyboard(" ");
    expect(await screen.findByText(E.tray.empty)).toBeInTheDocument();
  });
});

describe("trình soạn xếp tay — kiểm tra trước khi lưu", () => {
  it("taking one part of a kit out flags the whole kit (LP-3) and Save asks before sending", async () => {
    const user = userEvent.setup();
    const { put } = renderEditor(ACTORS.dispatcher);
    await openEditor(user);
    await user.click(screen.getAllByRole("button", { name: /kiện BAN-CB/ })[0]);
    await user.click(screen.getByRole("button", { name: E.selection.toTray }));
    const issues = screen.getByRole("region", { name: E.issues.title });
    expect(within(issues).getAllByText(PLACEMENT_RULE_LABELS.KIT_SPLIT).length).toBeGreaterThan(1);
    expect(screen.getAllByRole("button", { name: /kiện BAN-MB/ })[0]).toHaveAttribute(
      "data-tone",
      "violation",
    );
    await user.click(screen.getByRole("button", { name: E.save.save }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(E.save.confirmTitle)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: E.save.confirmSend }));
    await waitFor(() => expect(putCalls(put)).toHaveLength(1));
  });

  it("a box wider than the vehicle's door is flagged only once the door size is known", async () => {
    const user = userEvent.setup();
    renderEditor(ACTORS.dispatcher, onePlan(), { door: { doorWidthMm: 700 } });
    await openEditor(user);
    const top = screen.getAllByRole("button", { name: /kiện BAN-MB/ })[0];
    expect(top).toHaveAttribute("data-tone", "violation");
    expect(
      within(screen.getByRole("region", { name: E.issues.title })).getAllByText(
        PLACEMENT_RULE_LABELS.DOOR,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("without door data nothing is flagged on a valid plan", async () => {
    const user = userEvent.setup();
    renderEditor(ACTORS.dispatcher);
    await openEditor(user);
    expect(screen.getByText(E.issues.ok)).toBeInTheDocument();
  });
});

describe("trình soạn xếp tay — lỗi khi lưu", () => {
  const violation = (entries: { field: string; code: string }[]) =>
    new ApiError(
      422,
      "PLACEMENT_RULE_VIOLATION",
      "x",
      undefined,
      undefined,
      undefined,
      entries.map((e) => ({
        ...e,
        message: PLACEMENT_RULE_LABELS[e.code as keyof typeof PLACEMENT_RULE_LABELS],
      })),
    );

  it("422 puts the BE's violations on the boxes with the Vietnamese rule text and keeps the edit", async () => {
    const user = userEvent.setup();
    const server = onePlan();
    const target = server.layouts[0].boxes.find((b) => b.label === "GB-01")?.ref ?? "";
    renderEditor(ACTORS.dispatcher, server, {
      put: () => {
        throw violation([
          { field: target, code: "UNSUPPORTED" },
          { field: "vehicle:1", code: "OVERWEIGHT" },
        ]);
      },
    });
    await openEditor(user);
    await user.click(stoolButtons()[0]);
    await user.click(screen.getByRole("button", { name: E.selection.nudge.toDoor }));
    await user.click(screen.getByRole("button", { name: E.save.save }));
    expect(await screen.findByText(E.save.violation(2))).toBeInTheDocument();
    const issues = screen.getByRole("region", { name: E.issues.title });
    expect(
      within(issues).getByText(`${PLACEMENT_RULE_LABELS.UNSUPPORTED} (${E.issues.server})`),
    ).toBeInTheDocument();
    expect(
      within(issues).getByText(`${PLACEMENT_RULE_LABELS.OVERWEIGHT} (${E.issues.server})`),
    ).toBeInTheDocument();
    // nothing was lost: still editing, still dirty
    expect(screen.getByRole("button", { name: E.save.save })).toBeEnabled();
    expect(screen.getByRole("button", { name: E.toolbar.undo })).toBeEnabled();
  });

  it("the server's violation disappears from a box once the user moves that box", async () => {
    const user = userEvent.setup();
    const server = onePlan();
    const target = server.layouts[0].boxes.filter((b) => b.label === "GB-01")[0].ref;
    renderEditor(ACTORS.dispatcher, server, {
      put: () => {
        throw violation([{ field: target, code: "OVERLAP" }]);
      },
    });
    await openEditor(user);
    await user.click(stoolButtons()[1]);
    await user.click(screen.getByRole("button", { name: E.selection.nudge.toDoor }));
    await user.click(screen.getByRole("button", { name: E.save.save }));
    expect(await screen.findByText(E.save.violation(1))).toBeInTheDocument();
    expect(stoolButtons()[0]).toHaveAttribute("data-tone", "violation");
    await user.click(stoolButtons()[0]);
    await user.click(screen.getByRole("button", { name: E.selection.nudge.toDoor }));
    await waitFor(() => expect(screen.queryByText(E.save.violation(1))).not.toBeInTheDocument());
  });

  it("another error keeps the edit and offers to retry", async () => {
    const user = userEvent.setup();
    renderEditor(ACTORS.dispatcher, onePlan(), {
      put: () => {
        throw new ApiError(500, "INTERNAL_ERROR", "boom");
      },
    });
    await openEditor(user);
    await user.click(stoolButtons()[0]);
    await user.click(screen.getByRole("button", { name: E.selection.nudge.toDoor }));
    await user.click(screen.getByRole("button", { name: E.save.save }));
    expect(await screen.findByText(ERRORS.generic)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.save.save })).toBeEnabled();
  });
});
