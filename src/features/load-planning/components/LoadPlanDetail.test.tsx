import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOAD_PLAN_ERROR_MESSAGES as ERRORS, UI_LABELS } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";
import { ApiError } from "@/lib/api/error";

import { LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";
import {
  PLAN_ID,
  SHIPMENT_ID,
  VEHICLE_TYPE_ID,
  candidateFixture,
  planFixture,
  planWithUnplaced,
  unplacedParcel,
  vehicleOfLayout,
} from "../__fixtures__/plans";
import {
  LOAD_PLAN_ACTORS as ACTORS,
  mockLoadPlanApi,
  renderLoadPlanScreen,
} from "../__fixtures__/render-plan";
import { LoadPlanDetail } from "./LoadPlanDetail";

import type { TestActor } from "../__fixtures__/render-plan";
import type { PlanDetail } from "../plan-types";

// jsdom không có WebGL: hộp 3D thay bằng nhãn xe (hình học cảnh đã test ở lib/scene.test.ts)
vi.mock("./viewer/VehicleViewer", () => ({
  VehicleViewer: ({ layout }: { layout: { seq: number; code: string; boxes: unknown[] } }) => (
    <div data-testid="viewer">{`3D xe #${layout.seq} ${layout.code} (${layout.boxes.length} kiện)`}</div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const L = UI_LABELS.loadPlan.detail;
const D = UI_LABELS.loadPlan.dialog;
const PATH = `/fulfillment/load-plans/${PLAN_ID}`;
const TWO_VEHICLES = planFixture({
  vehicles: [
    vehicleOfLayout(LAYOUT_PICKUP_KIT),
    vehicleOfLayout({ ...LAYOUT_PICKUP_KIT, seq: 2 }, { needsRecalculation: true }),
  ],
});

/** Bản kế hoạch mà BE trả cho GET chi tiết — đổi giữa chừng để mô phỏng người khác sửa. */
const latest: { plan: PlanDetail } = { plan: planFixture() };

const RECONCILIATION = {
  pieceCheck: {
    key: PLAN_ID,
    code: "LP-20261022-0001",
    packagesIn: 23,
    placed: 23,
    unplaced: 0,
    leftBehind: 0,
    notInPlan: 0,
    balanced: true,
  },
  shipments: [
    {
      key: "s",
      code: "SO-20261004-000001-S1",
      packagesIn: 23,
      placed: 20,
      unplaced: 2,
      leftBehind: 0,
      notInPlan: 0,
      balanced: false,
    },
  ],
  orders: [],
  vsEstimate: {
    estimateIds: ["e-1"],
    notEstimated: ["o-2"],
    vehiclesCompared: false,
    vehiclesByType: [],
    orders: [
      {
        orderId: "o-1",
        estimateId: "e-1",
        vehiclesByType: [{ code: "PICKUP-1T", estimated: 1, actual: 1 }],
      },
    ],
    cartonsByLine: [{ orderLineId: "l-1", sku: "SKU-1", estimated: 10, actual: 12 }],
    volumeMm3: { estimated: 1_000_000_000, actual: 1_200_000_000, deltaPct: 20 },
    weightKg: { estimated: 100, actual: 105, deltaPct: 5 },
    flags: ["ESTIMATE_INCOMPLETE", "VOLUME_ABOVE"],
  },
};

function renderDetail(actor: TestActor, plan: PlanDetail = planFixture(), search = "") {
  latest.plan = plan;
  const layouts = plan.vehicles.map((v) => ({ ...LAYOUT_PICKUP_KIT, seq: v.seq }));
  const step = (kind: string) => () => ({
    ...latest.plan,
    version: latest.plan.version + 1,
    note: kind,
  });
  const spies = mockLoadPlanApi(actor, {
    get: {
      [PATH]: () => latest.plan,
      [`${PATH}/layouts`]: () => layouts,
      [`${PATH}/reconciliation`]: () => RECONCILIATION,
      "/fulfillment/load-plan-candidates": () => [candidateFixture()],
      "/fulfillment/vehicle-types": () => ({
        items: [
          {
            vehicleTypeId: VEHICLE_TYPE_ID,
            code: "PICKUP",
            name: "Pickup truck",
            kind: "PICKUP",
            innerLengthMm: 1500,
            innerWidthMm: 1140,
            innerHeightMm: 500,
            maxPayloadKg: 800,
            availableCount: 10,
            status: "ACTIVE",
          },
        ],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      }),
    },
    post: {
      [`${PATH}/calculation`]: step("calculate"),
      [`${PATH}/confirmation`]: step("confirm"),
      [`${PATH}/reopening`]: step("reopen"),
      [`${PATH}/cancellation`]: step("cancel"),
      [`${PATH}/unplaced-acknowledgement`]: step("acknowledge"),
      [`${PATH}/vehicles/1/recalculation`]: step("recalculate"),
      [`${PATH}/vehicles/2/recalculation`]: step("recalculate"),
    },
    put: { [`${PATH}/inputs`]: step("inputs") },
  });
  renderLoadPlanScreen(<LoadPlanDetail id={PLAN_ID} />, search);
  return spies;
}

const calls = (spy: { mock: { calls: unknown[][] } }, url: string) =>
  spy.mock.calls.filter(([u]) => u === url);

describe("LoadPlanDetail — hiển thị", () => {
  it("shows the code, status, mode, shipments, vehicle types and the 3D viewer of the first vehicle", async () => {
    renderDetail(ACTORS.viewOnly);
    expect(await screen.findByText("LP-20261022-0001")).toBeInTheDocument();
    expect(screen.getByText("Đã tính xếp")).toBeInTheDocument();
    expect(screen.getByText("Một loại xe")).toBeInTheDocument();
    expect(screen.getByText("SO-20261004-000001-S1")).toBeInTheDocument();
    expect(screen.getByText(/PICKUP \(Xe bán tải\)/)).toBeInTheDocument();
    expect(await screen.findByTestId("viewer")).toHaveTextContent("3D xe #1 PICKUP-1T");
    // Warehouse resolved from the directory, not shown as an id
    expect(await screen.findByText("HN · Kho Hà Nội")).toBeInTheDocument();
  });

  it("shows the plan metrics and the per-vehicle item table grouped by SKU and size", async () => {
    renderDetail(ACTORS.viewOnly);
    expect((await screen.findAllByText("Số kiện đã xếp theo xe")).length).toBeGreaterThan(0);
    for (const name of ["Mặt bàn", "Chân bàn", "Ghế bar"])
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    expect(screen.getByText("Hiệu suất")).toBeInTheDocument();
  });

  it("switches between vehicles; a vehicle that needs recalculation carries a badge and a page notice", async () => {
    const user = userEvent.setup();
    renderDetail(ACTORS.dispatcher, TWO_VEHICLES);
    const group = await screen.findByRole("group", { name: L.vehicleSwitcher });
    const second = within(group).getByRole("button", { name: /Xe #2/ });
    expect(within(second).getByText(L.needsRecalculation)).toBeInTheDocument();
    expect(
      within(within(group).getByRole("button", { name: /Xe #1/ })).queryByText(
        L.needsRecalculation,
      ),
    ).toBeNull();
    expect(screen.getAllByText(L.needsRecalculationAlert).length).toBeGreaterThan(0);
    await user.click(second);
    expect(await screen.findByTestId("viewer")).toHaveTextContent("3D xe #2");
  });

  it("the unplaced tray names each reason in Vietnamese, including SEARCH_CUT_OFF", async () => {
    const reasons = [
      "TOO_LARGE",
      "TOO_HEAVY",
      "NO_VEHICLE_AVAILABLE",
      "NO_SPACE",
      "SEARCH_CUT_OFF",
      "MANUAL",
    ] as const;
    const base = planFixture();
    const plan = planFixture({
      packages: [...base.packages, ...reasons.map((reason, i) => unplacedParcel(reason, i))],
      unplacedCount: reasons.length,
    });
    renderDetail(ACTORS.viewOnly, plan);
    const tray = await screen.findByRole("region", { name: new RegExp(L.unplaced.title) });
    for (const text of [
      "Quá lớn: không loại xe nào đã chọn chứa nổi",
      "Quá nặng so với tải trọng xe",
      "Hết xe của loại phù hợp",
      "Không còn chỗ trên xe",
      "Dừng do hết thời gian tính",
      "Được bỏ ra khỏi xe thủ công",
    ])
      expect(within(tray).getByText(text)).toBeInTheDocument();
    expect(within(tray).getByText(L.unplaced.pending)).toBeInTheDocument();
  });

  it("an empty tray says everything is placed", async () => {
    renderDetail(ACTORS.viewOnly);
    expect(await screen.findByText(L.unplaced.empty)).toBeInTheDocument();
  });

  it("the reconciliation tab shows the piece check and the vsEstimate flags as advisory, not blocking", async () => {
    renderDetail(ACTORS.viewOnly, planFixture(), "?tab=reconciliation");
    const R = L.reconciliation;
    expect(await screen.findByText(R.pieceCheck, { selector: "h3" })).toBeInTheDocument();
    expect(await screen.findByText(R.balanced)).toBeInTheDocument();
    expect(screen.getByText(R.unbalanced)).toBeInTheDocument();
    expect(await screen.findByText(R.advisory)).toBeInTheDocument();
    expect(screen.getByText("Ước lượng bỏ sót dòng hàng vì thiếu kích thước")).toBeInTheDocument();
    expect(screen.getByText("Thể tích vượt ước lượng trên 10%")).toBeInTheDocument();
    expect(screen.getByText(R.notEstimated(1))).toBeInTheDocument();
    expect(screen.getByText(R.vehiclesNotCompared)).toBeInTheDocument();
    expect(screen.getByText("+20,00%")).toBeInTheDocument();
  });
});

describe("LoadPlanDetail — hộp thoại xác nhận ngay trong trang", () => {
  it("confirming sends expectedVersion and closes the dialog", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(ACTORS.dispatcher);
    await user.click(await screen.findByRole("button", { name: L.actions.confirm }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: D.confirm.confirm }));
    await waitFor(() => expect(calls(post, `${PATH}/confirmation`)).toHaveLength(1));
    expect(calls(post, `${PATH}/confirmation`)[0][1]).toEqual({ expectedVersion: 4 });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("cancel needs a reason: the confirm button stays off until one is typed, then it is sent trimmed", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(ACTORS.dispatcher);
    await user.click(await screen.findByRole("button", { name: L.actions.cancel }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: D.cancel.confirm });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "  Khách đổi lịch  ");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => expect(calls(post, `${PATH}/cancellation`)).toHaveLength(1));
    expect(calls(post, `${PATH}/cancellation`)[0][1]).toEqual({
      expectedVersion: 4,
      reason: "Khách đổi lịch",
    });
  });

  it("reopening a CONFIRMED plan needs a reason too", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(ACTORS.dispatcher, planFixture({ status: "CONFIRMED" }));
    await user.click(await screen.findByRole("button", { name: L.actions.reopen }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: D.reopen.confirm })).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Đổi xe");
    await user.click(within(dialog).getByRole("button", { name: D.reopen.confirm }));
    await waitFor(() =>
      expect(calls(post, `${PATH}/reopening`)[0]?.[1]).toEqual({
        expectedVersion: 4,
        reason: "Đổi xe",
      }),
    );
  });

  it("acknowledging the unplaced parcels posts the version; LP-4 refusal names the order in the dialog", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(ACTORS.dispatcher, planWithUnplaced());
    post.mockRejectedValueOnce(
      new ApiError(409, "ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED", "x", {
        orderNumber: "SO-20261004-000001",
      }),
    );
    await user.click((await screen.findAllByRole("button", { name: L.actions.acknowledge }))[0]);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: D.acknowledge.confirm }));
    expect(await within(dialog).findByText(/SO-20261004-000001/)).toBeInTheDocument();
    // Dialog stays open so the dispatcher can read the reason; a second try is allowed
    await user.click(within(dialog).getByRole("button", { name: D.acknowledge.confirm }));
    await waitFor(() => expect(calls(post, `${PATH}/unplaced-acknowledgement`)).toHaveLength(2));
    expect(calls(post, `${PATH}/unplaced-acknowledgement`)[1][1]).toEqual({ expectedVersion: 4 });
  });

  it("every mutation carries expectedVersion: a 409 OPTIMISTIC_LOCK reloads the plan, says so, and the retry sends the NEW version", async () => {
    const user = userEvent.setup();
    const { get, post } = renderDetail(ACTORS.dispatcher);
    await user.click(await screen.findByRole("button", { name: L.actions.confirm }));
    const dialog = await screen.findByRole("dialog");
    const before = calls(get, PATH).length;
    // Người khác sửa kế hoạch → BE trả version 5
    latest.plan = { ...latest.plan, version: 5 };
    post.mockRejectedValueOnce(new ApiError(409, "OPTIMISTIC_LOCK", "changed"));
    await user.click(within(dialog).getByRole("button", { name: D.confirm.confirm }));
    expect(await within(dialog).findByText(ERRORS.OPTIMISTIC_LOCK)).toBeInTheDocument();
    await waitFor(() => expect(calls(get, PATH).length).toBeGreaterThan(before));
    await user.click(within(dialog).getByRole("button", { name: D.confirm.confirm }));
    await waitFor(() => expect(calls(post, `${PATH}/confirmation`)).toHaveLength(2));
    expect(calls(post, `${PATH}/confirmation`).map(([, body]) => body)).toEqual([
      { expectedVersion: 4 },
      { expectedVersion: 5 },
    ]);
  });

  it("a plan with a vehicle type that went INACTIVE: it is left out of the inputs sent, with a notice", async () => {
    const user = userEvent.setup();
    const base = planFixture();
    const retired = {
      ...base.vehicleTypes[0],
      vehicleTypeId: "retired-type",
      code: "OLD-TRUCK",
      status: "INACTIVE" as const,
    };
    const { put } = renderDetail(
      ACTORS.dispatcher,
      planFixture({ status: "DRAFT", vehicles: [], vehicleTypes: [base.vehicleTypes[0], retired] }),
    );
    await user.click(await screen.findByRole("button", { name: L.actions.editInputs }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(D.editInputs.inactiveDropped("OLD-TRUCK"))).toBeInTheDocument();
    await within(dialog).findByText(candidateFixture().code);
    await user.click(within(dialog).getByRole("button", { name: D.editInputs.confirm }));
    await waitFor(() => expect(calls(put, `${PATH}/inputs`)).toHaveLength(1));
    expect(calls(put, `${PATH}/inputs`)[0][1]).toMatchObject({ vehicleTypeIds: [VEHICLE_TYPE_ID] });
  });

  it("changing the inputs (PUT) sends the whole selection with the version; the plan's own parcels count as free", async () => {
    const user = userEvent.setup();
    const { get, put } = renderDetail(
      ACTORS.dispatcher,
      planFixture({ status: "DRAFT", vehicles: [], packages: [], packageCount: 0, placedCount: 0 }),
    );
    await user.click(await screen.findByRole("button", { name: L.actions.editInputs }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(D.editInputs.description)).toBeInTheDocument();
    await within(dialog).findByText(candidateFixture().code);
    await user.click(within(dialog).getByRole("radio", { name: /Ít xe nhất/ }));
    await user.click(within(dialog).getByRole("button", { name: D.editInputs.confirm }));
    await waitFor(() => expect(calls(put, `${PATH}/inputs`)).toHaveLength(1));
    expect(calls(put, `${PATH}/inputs`)[0][1]).toEqual({
      expectedVersion: 4,
      shipmentIds: [SHIPMENT_ID],
      vehicleTypeIds: [VEHICLE_TYPE_ID],
      selectionMode: "FEWEST_VEHICLES",
    });
    const params = get.mock.calls.find(([url]) => url === "/fulfillment/load-plan-candidates")?.[1]
      ?.params;
    expect(params).toMatchObject({ loadPlanId: PLAN_ID });
  });
});

describe("LoadPlanDetail — tính lại xe và đưa kiện lại vào xe", () => {
  it("recalculates the viewed vehicle with its seq and the plan version", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(ACTORS.dispatcher, TWO_VEHICLES);
    await user.click(await screen.findByRole("button", { name: L.actions.recalculate }));
    await waitFor(() => expect(calls(post, `${PATH}/vehicles/1/recalculation`)).toHaveLength(1));
    expect(calls(post, `${PATH}/vehicles/1/recalculation`)[0][1]).toEqual({ expectedVersion: 4 });
  });

  it("'đưa lại vào xe' recalculates the viewed vehicle with addPackageIds taken from the tray", async () => {
    const user = userEvent.setup();
    const plan = planWithUnplaced("NO_SPACE");
    const { post } = renderDetail(ACTORS.dispatcher, plan);
    const checkbox = await screen.findByRole("checkbox", { name: /PKG-U1/ });
    const button = screen.getByRole("button", { name: L.unplaced.returnToVehicle(1) });
    expect(button).toBeDisabled();
    await user.click(checkbox);
    await user.click(button);
    await waitFor(() => expect(calls(post, `${PATH}/vehicles/1/recalculation`)).toHaveLength(1));
    expect(calls(post, `${PATH}/vehicles/1/recalculation`)[0][1]).toEqual({
      expectedVersion: 4,
      addPackageIds: ["unplaced-NO_SPACE-1"],
    });
  });

  it("a ticked parcel that left the tray meanwhile is dropped: it is not sent in addPackageIds", async () => {
    const user = userEvent.setup();
    const base = planFixture();
    const [a, b] = [unplacedParcel("NO_SPACE", 1), unplacedParcel("NO_SPACE", 2)];
    const withTray = (tray: typeof base.packages, version: number) =>
      planFixture({
        packages: [...base.packages, ...tray],
        packageCount: base.packageCount + 2,
        unplacedCount: tray.filter((p) => p.vehicleSeq == null).length,
        version,
      });
    const { post } = renderDetail(ACTORS.dispatcher, withTray([a, b], 4));
    await user.click(await screen.findByRole("checkbox", { name: /PKG-U1/ }));
    await user.click(screen.getByRole("checkbox", { name: /PKG-U2/ }));
    // Another recalculation put A on vehicle 1: after the refetch only B is still on the tray
    latest.plan = withTray([{ ...a, vehicleSeq: 1, unplacedReason: null }, b], 5);
    await user.click(screen.getByRole("button", { name: L.actions.recalculate }));
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: /PKG-U1/ })).toBeNull());
    await user.click(screen.getByRole("button", { name: L.unplaced.returnToVehicle(1) }));
    await waitFor(() => expect(calls(post, `${PATH}/vehicles/1/recalculation`)).toHaveLength(2));
    expect(calls(post, `${PATH}/vehicles/1/recalculation`)[1][1]).toEqual({
      expectedVersion: 5,
      addPackageIds: [b.packageId],
    });
  });

  it("a recalculation refused by the BE shows its Vietnamese reason on the page", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(ACTORS.dispatcher);
    post.mockRejectedValueOnce(new ApiError(409, "INVALID_LOAD_PLAN_TRANSITION", "x"));
    await user.click(await screen.findByRole("button", { name: L.actions.recalculate }));
    expect(await screen.findByText(ERRORS.INVALID_LOAD_PLAN_TRANSITION)).toBeInTheDocument();
  });
});

describe("LoadPlanDetail — cổng quyền và trạng thái", () => {
  it("view-only: no action button anywhere, and a sentence says why", async () => {
    renderDetail(ACTORS.viewOnly, planWithUnplaced());
    await screen.findByText("LP-20261022-0001");
    for (const name of Object.values(L.actions))
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText(L.viewOnly)).toBeInTheDocument();
  });

  it.each(["CANCELLED", "DISPATCHED"] as const)(
    "%s is final: no mutating button even for a dispatcher",
    async (status) => {
      renderDetail(ACTORS.dispatcher, planFixture({ status }));
      await screen.findByText("LP-20261022-0001");
      for (const name of Object.values(L.actions))
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      expect(screen.getByText(L.finalState)).toBeInTheDocument();
    },
  );

  it("DRAFT offers calculate / edit inputs / cancel, not confirm or reopen", async () => {
    renderDetail(
      ACTORS.dispatcher,
      planFixture({ status: "DRAFT", vehicles: [], packages: [], packageCount: 0, placedCount: 0 }),
    );
    expect(await screen.findByRole("button", { name: L.actions.calculate })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.actions.editInputs })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.actions.cancel })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.actions.confirm })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.actions.reopen })).not.toBeInTheDocument();
    expect(screen.getByText(L.noVehicles)).toBeInTheDocument();
  });

  it("confirm is shown but disabled while the unplaced parcels are not acknowledged (BR-13)", async () => {
    renderDetail(ACTORS.dispatcher, planWithUnplaced());
    expect(await screen.findByRole("button", { name: L.actions.confirm })).toBeDisabled();
  });

  it("an unknown plan is 'not found'; a failing server offers a retry; no READ is a permission message", async () => {
    mockLoadPlanApi(ACTORS.viewOnly, {
      get: {
        [PATH]: () => {
          throw new ApiError(404, "LOAD_PLAN_NOT_FOUND", "x");
        },
      },
    });
    renderLoadPlanScreen(<LoadPlanDetail id={PLAN_ID} />);
    expect(await screen.findByText(UI_LABELS.loadPlan.notFoundTitle)).toBeInTheDocument();
    cleanup();
    vi.restoreAllMocks();
    renderDetail(ACTORS.noRead);
    expect(await screen.findByText(UI_LABELS.loadPlan.noReadTitle)).toBeInTheDocument();
    cleanup();
    vi.restoreAllMocks();
    renderDetail(ACTORS.noAccess);
    expect(await screen.findByText(PERMISSION_UI.deniedTitle)).toBeInTheDocument();
  });
});

beforeEach(() => {
  latest.plan = planFixture();
});
