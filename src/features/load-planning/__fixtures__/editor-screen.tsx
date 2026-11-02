/**
 * Dựng màn chi tiết kế hoạch ở chế độ soạn cho test: kế hoạch một / hai xe với kiện riêng từng xe (ref duy nhất theo kế
 * hoạch như BE), API giả lập theo URL, và các thao tác mở trình soạn. Khung 3D phải được mock ở chính file test
 * (`vi.mock("./EditorViewer")`) vì jsdom không có WebGL.
 */

import { screen } from "@testing-library/react";

import { UI_LABELS } from "@/constants";

import { LAYOUT_PICKUP_KIT } from "./layouts";
import { PLAN_ID, VEHICLE_TYPE_ID, planFixture, vehicleOfLayout } from "./plans";
import { mockLoadPlanApi, renderLoadPlanScreen } from "./render-plan";
import { LoadPlanDetail } from "../components/LoadPlanDetail";

import type userEvent from "@testing-library/user-event";
import type { TestActor } from "./render-plan";
import type { PlanDetail } from "../plan-types";
import type { Layout } from "../types";

const E = UI_LABELS.loadPlan.editor;
export const PATH = `/fulfillment/load-plans/${PLAN_ID}`;

export const parcelsOf = (layout: Layout) =>
  layout.boxes.map((box, index) => ({
    packageId: box.ref,
    labelCode: `PKG-${layout.seq}-${index + 1}`,
    shipmentId: "22222222-0000-4000-8000-000000000001",
    shipmentCode: "SO-20261004-000001-S1",
    partName: box.partName,
    lengthMm: box.origMm.l,
    widthMm: box.origMm.w,
    heightMm: box.origMm.h,
    weightKg: box.weightKg,
    rotatable: box.rotatable,
    kitGroupId: box.kitGroup,
    kitPartNo: null,
    kitPartCount: null,
    vehicleSeq: layout.seq,
    unplacedReason: null,
  }));

export const SECOND: Layout = {
  ...LAYOUT_PICKUP_KIT,
  seq: 2,
  boxes: LAYOUT_PICKUP_KIT.boxes.map((box) => ({
    ...box,
    ref: `${box.ref}-v2`,
    kitGroup: box.kitGroup ? `${box.kitGroup}-v2` : null,
  })),
};

/** Kế hoạch hai xe, mỗi xe có kiện riêng (ref duy nhất theo kế hoạch, như BE). */
export function twoVehiclePlan(): { plan: PlanDetail; layouts: Layout[] } {
  const packages = [...parcelsOf(LAYOUT_PICKUP_KIT), ...parcelsOf(SECOND)];
  const plan = planFixture({
    vehicles: [vehicleOfLayout(LAYOUT_PICKUP_KIT), vehicleOfLayout(SECOND)],
    packages,
    packageCount: packages.length,
    placedCount: packages.length,
  });
  return { plan, layouts: [LAYOUT_PICKUP_KIT, SECOND] };
}

export function onePlan(): { plan: PlanDetail; layouts: Layout[] } {
  const plan = planFixture();
  return {
    plan: { ...plan, packages: parcelsOf(LAYOUT_PICKUP_KIT) },
    layouts: [LAYOUT_PICKUP_KIT],
  };
}

export const typesPage = (door: { doorWidthMm?: number; doorHeightMm?: number } = {}) => ({
  items: [
    {
      vehicleTypeId: VEHICLE_TYPE_ID,
      code: "PICKUP",
      name: "Pickup truck",
      kind: "PICKUP",
      innerLengthMm: 1800,
      innerWidthMm: 1500,
      innerHeightMm: 500,
      maxPayloadKg: 1000,
      availableCount: 10,
      status: "ACTIVE",
      ...door,
    },
  ],
  page: 0,
  size: 100,
  totalElements: 1,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});

export interface Server {
  plan: PlanDetail;
  layouts: Layout[];
}

export function renderEditor(
  actor: TestActor,
  server: Server = onePlan(),
  options: {
    door?: { doorWidthMm?: number; doorHeightMm?: number };
    put?: (body: unknown) => unknown;
  } = {},
) {
  // Cùng một đối tượng: test đổi `server.plan` / `server.layouts` để mô phỏng người khác sửa giữa chừng
  const state = server;
  const spies = mockLoadPlanApi(actor, {
    get: {
      [PATH]: () => state.plan,
      [`${PATH}/layouts`]: () => state.layouts,
      "/fulfillment/vehicle-types": () => typesPage(options.door),
      "/fulfillment/load-plan-candidates": () => [],
      [`${PATH}/reconciliation`]: () => ({
        pieceCheck: {
          key: PLAN_ID,
          code: "LP",
          packagesIn: 0,
          placed: 0,
          unplaced: 0,
          leftBehind: 0,
          notInPlan: 0,
          balanced: true,
        },
        shipments: [],
        orders: [],
      }),
    },
    put: {
      [`${PATH}/placements`]: (_params, body) =>
        options.put ? options.put(body) : { ...state.plan, version: state.plan.version + 1 },
    },
  });
  renderLoadPlanScreen(<LoadPlanDetail id={PLAN_ID} />);
  return { ...spies, state };
}

export async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: E.open }));
  await screen.findByRole("toolbar", { name: E.toolbar.group });
}

export const stoolButtons = () => screen.getAllByRole("button", { name: /kiện GB-01/ });
export const putCalls = (put: { mock: { calls: unknown[][] } }) =>
  put.mock.calls.filter(([url]) => url === `${PATH}/placements`);
