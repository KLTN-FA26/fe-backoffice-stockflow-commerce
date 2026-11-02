import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";

import { LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";
import { PLAN_ID, planFixture, vehicleOfLayout } from "../__fixtures__/plans";
import {
  LOAD_PLAN_ACTORS as ACTORS,
  mockLoadPlanApi,
  renderLoadPlanScreen,
} from "../__fixtures__/render-plan";
import { LoadPlanDetail } from "./LoadPlanDetail";

import type { TestActor } from "../__fixtures__/render-plan";
import type { PlanDetail } from "../plan-types";

// jsdom không có WebGL: hộp 3D thay bằng nhãn
vi.mock("./viewer/VehicleViewer", () => ({
  VehicleViewer: () => <div data-testid="viewer" />,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PATH = `/fulfillment/load-plans/${PLAN_ID}`;
const C = UI_LABELS.shipping.ftl.controlledCancel;

const planWithVehicle = (status: string, patch: Partial<PlanDetail> = {}): PlanDetail =>
  planFixture({
    status: "CONFIRMED",
    vehicles: [
      vehicleOfLayout(LAYOUT_PICKUP_KIT, { load: { loadId: "l-1", code: "LD-1", status } }),
    ],
    ...patch,
  });

function renderPlan(actor: TestActor, plan: PlanDetail, after?: PlanDetail) {
  const spies = mockLoadPlanApi(actor, {
    get: {
      [PATH]: () => plan,
      [`${PATH}/layouts`]: () => [LAYOUT_PICKUP_KIT],
      [`${PATH}/reconciliation`]: () => ({
        pieceCheck: {
          key: PLAN_ID,
          code: plan.code,
          packagesIn: 1,
          placed: 1,
          unplaced: 0,
          leftBehind: 0,
          notInPlan: 0,
          balanced: true,
        },
        shipments: [],
        orders: [],
        vsEstimate: null,
      }),
    },
    post: { [`${PATH}/controlled-cancellation`]: () => after ?? plan },
  });
  renderLoadPlanScreen(<LoadPlanDetail id={PLAN_ID} />);
  return spies;
}

describe("Huỷ có kiểm soát cả kế hoạch (SCRUM-474 UNLOAD-DESIGN)", () => {
  it("quản lý kho (mã fulfillment-controlled-cancellations:UPDATE) thấy nút khi xe đang xếp; huỷ thường đã mất", async () => {
    renderPlan(ACTORS.manager, planWithVehicle("LOADING"));
    expect(await screen.findByRole("button", { name: C.cancelButton })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: UI_LABELS.loadPlan.detail.actions.cancel }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["nhân viên kho (chỉ :UPDATE)", ACTORS.dispatcher],
    ["chỉ xem", ACTORS.viewOnly],
  ])("%s không thấy nút huỷ có kiểm soát", async (_name, actor) => {
    renderPlan(actor, planWithVehicle("LOADING"));
    await screen.findByText(/LP-/);
    expect(screen.queryByRole("button", { name: C.cancelButton })).not.toBeInTheDocument();
  });

  it("chưa xe nào xếp hàng: vẫn là huỷ thường, chưa có nút huỷ có kiểm soát", async () => {
    renderPlan(ACTORS.manager, planWithVehicle("VEHICLE_BOOKED"));
    expect(
      await screen.findByRole("button", { name: UI_LABELS.loadPlan.detail.actions.cancel }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: C.cancelButton })).not.toBeInTheDocument();
  });

  it("đã có xe rời kho: nút bị khoá (huỷ từng xe thay vì cả kế hoạch)", async () => {
    renderPlan(ACTORS.manager, planWithVehicle("DISPATCHED"));
    expect(await screen.findByRole("button", { name: C.cancelButton })).toBeDisabled();
  });

  it("chọn mã lý do + ghi chú → POST /controlled-cancellation {expectedVersion, reasonCode, note}", async () => {
    const user = userEvent.setup();
    const plan = planWithVehicle("LOADING", { version: 7 });
    const { post } = renderPlan(ACTORS.manager, plan, { ...plan, status: "CANCELLED", version: 8 });
    await user.click(await screen.findByRole("button", { name: C.cancelButton }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: C.plan.confirm });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Khách đổi lịch");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: C.reasonCode.KHAC }));
    await user.click(within(dialog).getByRole("button", { name: C.plan.confirm }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/controlled-cancellation`, {
        expectedVersion: 7,
        reasonCode: "KHAC",
        note: "Khách đổi lịch",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("UNLOAD-REOPEN: đã huỷ có kiểm soát một xe thì kế hoạch coi như đã bắt đầu xếp hàng", () => {
  it("không xe nào đang xếp nhưng không còn nút mở lại / huỷ thường; vẫn còn huỷ có kiểm soát (quản lý kho)", async () => {
    const plan = planWithVehicle("PLANNED", { controlledCancelled: true });
    renderPlan(ACTORS.manager, plan);
    expect(await screen.findByRole("button", { name: C.cancelButton })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: UI_LABELS.loadPlan.detail.actions.reopen }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: UI_LABELS.loadPlan.detail.actions.cancel }),
    ).not.toBeInTheDocument();
  });

  it("nhân viên kho (chỉ :UPDATE): không còn nút mở lại / huỷ nào", async () => {
    renderPlan(ACTORS.dispatcher, planWithVehicle("PLANNED", { controlledCancelled: true }));
    await screen.findByText(/LP-/);
    for (const name of [
      UI_LABELS.loadPlan.detail.actions.reopen,
      UI_LABELS.loadPlan.detail.actions.cancel,
      C.cancelButton,
    ]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});

describe("UNLOAD-DROP: Bỏ xe khỏi kế hoạch", () => {
  const DROP = C.drop;
  const second = { ...LAYOUT_PICKUP_KIT, seq: 2 };
  const twoVehicles = (first: string, patch: Partial<PlanDetail> = {}): PlanDetail =>
    planFixture({
      status: "CONFIRMED",
      vehicles: [
        vehicleOfLayout(LAYOUT_PICKUP_KIT, {
          load: { loadId: "l-1", code: "LD-1", status: first },
        }),
        vehicleOfLayout(second, { load: { loadId: "l-2", code: "LD-2", status: "PLANNED" } }),
      ],
      ...patch,
    });

  function renderTwo(actor: TestActor, plan: PlanDetail) {
    const spies = mockLoadPlanApi(actor, {
      get: {
        [PATH]: () => plan,
        [`${PATH}/layouts`]: () => [LAYOUT_PICKUP_KIT, second],
        [`${PATH}/reconciliation`]: () => ({
          pieceCheck: {
            key: PLAN_ID,
            code: plan.code,
            packagesIn: 1,
            placed: 1,
            unplaced: 0,
            leftBehind: 0,
            notInPlan: 0,
            balanced: true,
          },
          shipments: [],
          orders: [],
          vsEstimate: null,
        }),
      },
      post: { "/fulfillment/loads/l-2/plan-removal": () => ({}) },
    });
    renderLoadPlanScreen(<LoadPlanDetail id={PLAN_ID} />);
    return spies;
  }

  const selectSecond = async (user: ReturnType<typeof userEvent.setup>) => {
    const group = await screen.findByRole("group", {
      name: UI_LABELS.loadPlan.detail.vehicleSwitcher,
    });
    await user.click(within(group).getAllByRole("button")[1] as HTMLElement);
  };

  it("quản lý kho thấy nút ở xe còn PLANNED khi xe kia đã đi; chọn mã lý do + ghi chú → POST …/plan-removal {reasonCode, note}", async () => {
    const user = userEvent.setup();
    const { post } = renderTwo(ACTORS.manager, twoVehicles("DISPATCHED"));
    await screen.findByText(/LP-/);
    // Xe số 1 đã đi: không bỏ được; chuyển sang xe số 2 mới có nút
    expect(screen.queryByRole("button", { name: DROP.button })).not.toBeInTheDocument();
    await selectSecond(user);
    await user.click(await screen.findByRole("button", { name: DROP.button }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: DROP.confirm });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Không còn xe nào");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: C.reasonCode.KHAC }));
    await user.click(within(dialog).getByRole("button", { name: DROP.confirm }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/fulfillment/loads/l-2/plan-removal", {
        reasonCode: "KHAC",
        note: "Không còn xe nào",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it.each([
    ["xe kia chưa đi (đang xếp)", ACTORS.manager, twoVehicles("LOADING")],
    ["xe kia mới đặt", ACTORS.manager, twoVehicles("VEHICLE_BOOKED")],
    ["nhân viên kho không có mã huỷ có kiểm soát", ACTORS.dispatcher, twoVehicles("DISPATCHED")],
    ["chỉ xem", ACTORS.viewOnly, twoVehicles("DISPATCHED")],
  ])("%s: không có nút Bỏ xe khỏi kế hoạch", async (_name, actor, plan) => {
    const user = userEvent.setup();
    renderTwo(actor, plan);
    await screen.findByText(/LP-/);
    await selectSecond(user);
    expect(screen.queryByRole("button", { name: DROP.button })).not.toBeInTheDocument();
  });
});

describe("Kiện còn phải dỡ khỏi xe của kế hoạch đã huỷ", () => {
  const cancelled = planFixture({
    status: "CANCELLED",
    cancelReasonCode: "XE_HONG",
    cancelReason: "Gãy trục sau",
    cancelledAt: "2026-10-29T03:00:00Z",
    pendingUnloads: [
      {
        loadId: "l-1",
        loadCode: "LD-1",
        vehicleSeq: 1,
        packageId: "p-1",
        labelCode: "PKG-SO-1-1",
        shipmentCode: "SO-1-S1",
        reasonCode: "XE_HONG",
        reason: "Gãy trục sau",
        requestedAt: "2026-10-29T03:00:00Z",
      },
    ],
  });

  it("liệt kê kiện bị khoá, mã lý do, và dẫn tới chuyến cần quét dỡ", async () => {
    renderPlan(ACTORS.viewOnly, cancelled);
    const heading = await screen.findByText(`${C.plan.pendingTitle} (1)`);
    const card = heading.closest("section") as HTMLElement;
    expect(within(card).getByText("PKG-SO-1-1")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: `${C.plan.pendingOpen} LD-1` })).toHaveAttribute(
      "href",
      "/admin/loads/l-1",
    );
    // Mã lý do + ghi chú cũng hiện ở thông tin chung của kế hoạch
    expect(screen.getAllByText(/Xe hỏng/).length).toBeGreaterThan(1);
    expect(screen.queryByRole("button", { name: C.cancelButton })).not.toBeInTheDocument();
  });

  it("hết kiện cần dỡ thì không hiện thẻ", async () => {
    renderPlan(ACTORS.viewOnly, { ...cancelled, pendingUnloads: [] });
    await screen.findByText(/LP-/);
    expect(screen.queryByText(new RegExp(C.plan.pendingTitle))).not.toBeInTheDocument();
  });
});
