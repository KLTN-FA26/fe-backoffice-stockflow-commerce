import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LOAD_PLAN_EDITOR_STALE_MESSAGES,
  LOAD_PLAN_ERROR_MESSAGES as ERRORS,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  onePlan,
  openEditor,
  putCalls,
  renderEditor,
  stoolButtons,
} from "../../__fixtures__/editor-screen";
import { unplacedParcel } from "../../__fixtures__/plans";
import { LOAD_PLAN_ACTORS as ACTORS } from "../../__fixtures__/render-plan";

import type { Server } from "../../__fixtures__/editor-screen";

vi.mock("./EditorViewer", () => ({
  EditorViewer: (props: {
    vehicle: { boxes: { ref: string; label: string }[] };
    onBoxPick: (ref: string, additive: boolean) => void;
  }) => (
    <div>
      {props.vehicle.boxes.map((box) => (
        <button
          key={box.ref}
          type="button"
          onClick={() => props.onBoxPick(box.ref, false)}
        >{`kiện ${box.label}`}</button>
      ))}
    </div>
  ),
}));
vi.mock("../viewer/VehicleViewer", () => ({ VehicleViewer: () => <div /> }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const E = UI_LABELS.loadPlan.editor;
const C = E.conflict;

/** Người khác dời kiện ghế bar cuối cùng 50 mm rồi lưu: kế hoạch lên version 5. */
function someoneElseMovesAStool(server: Server) {
  const layout = server.layouts[0];
  const last = layout.boxes.findLastIndex((b) => b.label === "GB-01");
  server.layouts = [
    { ...layout, boxes: layout.boxes.map((b, i) => (i === last ? { ...b, zMm: b.zMm - 50 } : b)) },
  ];
  server.plan = { ...server.plan, version: server.plan.version + 1 };
}

/** Lần lưu đầu bị 409 vì người khác đã đổi (mô phỏng bằng `change`); các lần sau thành công. */
function lockedOnce(server: Server, change: (s: Server) => void) {
  let first = true;
  return (_body: unknown) => {
    if (first) {
      first = false;
      change(server);
      throw new ApiError(409, "OPTIMISTIC_LOCK", "changed");
    }
    return { ...server.plan, version: server.plan.version + 1 };
  };
}

async function editAndSave(user: ReturnType<typeof userEvent.setup>) {
  await user.click(stoolButtons()[0]);
  await user.click(screen.getByRole("button", { name: E.selection.nudge.toDoor }));
  await user.click(screen.getByRole("button", { name: E.save.save }));
}

describe("lưu bị 409 OPTIMISTIC_LOCK", () => {
  it("keeps the local edit and offers Reload or Overwrite-after-review", async () => {
    const user = userEvent.setup();
    const server = onePlan();
    const view = renderEditor(ACTORS.dispatcher, server, {
      put: lockedOnce(server, someoneElseMovesAStool),
    });
    await openEditor(user);
    await editAndSave(user);
    expect(await screen.findByText(C.title)).toBeInTheDocument();
    expect(view.put).toHaveBeenCalledTimes(1);
    // the edit is still there
    expect(screen.getByRole("button", { name: E.toolbar.undo })).toBeEnabled();
    expect(screen.getByText(E.save.dirty)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: C.reload })).toBeEnabled());
    expect(screen.getByRole("button", { name: C.review })).toBeEnabled();
  });

  it("'Ghi đè sau khi xem' lists what the other person changed, then resends the local edit with the NEW version", async () => {
    const user = userEvent.setup();
    const server = onePlan();
    const view = renderEditor(ACTORS.dispatcher, server, {
      put: lockedOnce(server, someoneElseMovesAStool),
    });
    await openEditor(user);
    await editAndSave(user);
    await waitFor(() => expect(screen.getByRole("button", { name: C.review })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: C.review }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(C.changes(1))).toBeInTheDocument();
    expect(within(dialog).getByText(/GB-01: xe #1 → xe #1/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: C.overwrite }));
    await waitFor(() => expect(putCalls(view.put)).toHaveLength(2));
    const [first, second] = putCalls(view.put).map(
      ([, body]) => body as { expectedVersion: number; vehicles: { boxes: { zMm: number }[] }[] },
    );
    expect(first.expectedVersion).toBe(4);
    expect(second.expectedVersion).toBe(5);
    // the resent payload is the LOCAL edit (stool nudged to z 1250), not the server's version
    expect(second.vehicles[0].boxes.map((b) => b.zMm)).toEqual(
      first.vehicles[0].boxes.map((b) => b.zMm),
    );
    expect(await screen.findByRole("button", { name: E.open })).toBeInTheDocument();
  });

  it("'Tải lại' drops the local edit and shows the server's version as the new starting point", async () => {
    const user = userEvent.setup();
    const server = onePlan();
    renderEditor(ACTORS.dispatcher, server, { put: lockedOnce(server, someoneElseMovesAStool) });
    await openEditor(user);
    await editAndSave(user);
    await waitFor(() => expect(screen.getByRole("button", { name: C.reload })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: C.reload }));
    await waitFor(() => expect(screen.queryByText(C.title)).not.toBeInTheDocument());
    expect(screen.getByText(E.save.clean)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.toolbar.undo })).toBeDisabled();
    // the server's moved stool is what is on screen now
    await user.click(stoolButtons()[2]);
    expect(screen.getByText("(1000, 0, 1150) mm")).toBeInTheDocument();
  });

  it("cannot overwrite when the set of parcels changed on the server — only reload", async () => {
    const user = userEvent.setup();
    const server = onePlan();
    renderEditor(ACTORS.dispatcher, server, {
      put: lockedOnce(server, (s) => {
        s.plan = {
          ...s.plan,
          version: s.plan.version + 1,
          packages: [...s.plan.packages, unplacedParcel("MANUAL")],
          packageCount: s.plan.packageCount + 1,
          unplacedCount: 1,
        };
      }),
    });
    await openEditor(user);
    await editAndSave(user);
    await waitFor(() => expect(screen.getByRole("button", { name: C.review })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: C.review }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(C.added(1))).toBeInTheDocument();
    expect(within(dialog).getByText(C.cannotOverwrite)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: C.overwrite })).toBeDisabled();
  });
});

describe("lưu bị từ chối vì dữ liệu cũ theo cách khác", () => {
  it("INVALID_LOAD_PLAN_TRANSITION (someone confirmed the plan): message + reload only, no overwrite", async () => {
    const user = userEvent.setup();
    const server = onePlan();
    renderEditor(ACTORS.dispatcher, server, {
      put: () => {
        server.plan = { ...server.plan, status: "CONFIRMED", version: 5 };
        throw new ApiError(409, "INVALID_LOAD_PLAN_TRANSITION", "no");
      },
    });
    await openEditor(user);
    await editAndSave(user);
    expect(await screen.findByText(ERRORS.INVALID_LOAD_PLAN_TRANSITION)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: C.reload })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: C.review })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.toolbar.undo })).toBeEnabled();
  });

  it("BE's 'package missing' (the plan gained a parcel) is explained, not shown as a generic failure", async () => {
    const user = userEvent.setup();
    const server = onePlan();
    renderEditor(ACTORS.dispatcher, server, {
      put: () => {
        throw new ApiError(400, "VALIDATION_FAILED", "x", undefined, undefined, undefined, [
          { field: "p-1", code: "LOAD_PLAN_PACKAGE_MISSING", message: "x" },
        ]);
      },
    });
    await openEditor(user);
    await editAndSave(user);
    expect(
      await screen.findByText(LOAD_PLAN_EDITOR_STALE_MESSAGES.LOAD_PLAN_PACKAGE_MISSING),
    ).toBeInTheDocument();
  });
});

describe("thoát khi còn thay đổi chưa lưu", () => {
  it("asks first; 'Tiếp tục chỉnh sửa' stays, 'Bỏ thay đổi' leaves without sending anything", async () => {
    const user = userEvent.setup();
    const view = renderEditor(ACTORS.dispatcher);
    await openEditor(user);
    await user.click(stoolButtons()[0]);
    await user.click(screen.getByRole("button", { name: E.selection.toTray }));
    await user.click(screen.getByRole("button", { name: E.exit }));
    let dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: E.discard.keep }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("toolbar", { name: E.toolbar.group })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: E.exit }));
    dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: E.discard.confirm }));
    expect(await screen.findByRole("button", { name: E.open })).toBeInTheDocument();
    expect(putCalls(view.put)).toHaveLength(0);
  });
});
