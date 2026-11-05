import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, LOAD_PLAN_ERROR_MESSAGES as ERRORS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";
import {
  PLAN_ID,
  TRANSFER_NUMBER,
  TRANSFER_ORDER_ID,
  VEHICLE_TYPE_ID,
  candidateFixture,
  planWithUnplaced,
  transferPlanFixture,
  transferPlanWithUnplaced,
} from "../__fixtures__/plans";
import {
  LOAD_PLAN_ACTORS as ACTORS,
  mockLoadPlanApi,
  renderLoadPlanScreen,
} from "../__fixtures__/render-plan";
import { LoadPlanDetail } from "./LoadPlanDetail";

import type { TestActor } from "../__fixtures__/render-plan";
import type { PlanDetail } from "../plan-types";

// jsdom không có WebGL: hộp 3D thay bằng nhãn xe
vi.mock("./viewer/VehicleViewer", () => ({
  VehicleViewer: ({ layout }: { layout: { seq: number } }) => (
    <div data-testid="viewer">{`3D xe #${layout.seq}`}</div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const L = UI_LABELS.loadPlan.detail;
const T = UI_LABELS.loadPlan.transfer;
const D = UI_LABELS.loadPlan.dialog;
const PATH = `/fulfillment/load-plans/${PLAN_ID}`;

function renderDetail(actor: TestActor, plan: PlanDetail) {
  const layouts = plan.vehicles.map((v) => ({ ...LAYOUT_PICKUP_KIT, seq: v.seq }));
  const step = () => ({ ...plan, version: plan.version + 1 });
  const spies = mockLoadPlanApi(actor, {
    get: {
      [PATH]: () => plan,
      [`${PATH}/layouts`]: () => layouts,
      [`${PATH}/reconciliation`]: () => ({
        pieceCheck: {
          key: PLAN_ID,
          code: plan.code,
          packagesIn: 23,
          placed: 23,
          unplaced: 0,
          leftBehind: 0,
          notInPlan: 0,
          balanced: true,
        },
        shipments: [],
        orders: [],
      }),
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
      [`${PATH}/confirmation`]: step,
      [`${PATH}/unplaced-acknowledgement`]: step,
    },
    put: { [`${PATH}/inputs`]: step },
  });
  renderLoadPlanScreen(<LoadPlanDetail id={PLAN_ID} />);
  return spies;
}

const calls = (spy: { mock: { calls: unknown[][] } }, url: string) =>
  spy.mock.calls.filter(([u]) => u === url);

describe("LoadPlanDetail — kế hoạch nguồn TRANSFER (BE PR #164)", () => {
  it("hiện nguồn 'Lệnh chuyển kho', số lệnh (liên kết sang lệnh) và kho đích thay cho lô giao", async () => {
    renderDetail(ACTORS.viewOnly, transferPlanFixture());
    expect(await screen.findByText("LP-20261022-0001")).toBeInTheDocument();
    expect(screen.getByText(T.detail.source)).toBeInTheDocument();
    // Nguồn và nhãn ô "Lệnh chuyển kho" cùng chữ: một ô nguồn, một ô số lệnh
    expect(screen.getAllByText(UI_LABELS.loadPlan.source.TRANSFER)).toHaveLength(2);
    const link = screen.getByRole("link", { name: TRANSFER_NUMBER });
    expect(link).toHaveAttribute("href", ADMIN_ROUTES.transfers.detail(TRANSFER_ORDER_ID));
    expect(await screen.findByText("HCM · Kho TP.HCM")).toBeInTheDocument();
    // Không còn ô "Lô giao" của kế hoạch đơn khách
    expect(screen.queryByText(L.shipments)).not.toBeInTheDocument();
  });

  it("kiện còn ở khay: nhắc lệnh phải đi nguyên, KHÔNG có nút 'để lại kiện chưa xếp'; Chốt khoá", async () => {
    renderDetail(ACTORS.dispatcher, transferPlanWithUnplaced());
    expect(await screen.findByText(T.detail.shipsWhole)).toBeInTheDocument();
    expect(screen.queryByText(L.unplaced.pending)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.actions.acknowledge })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.actions.confirm })).toBeDisabled();
  });

  it("kế hoạch đơn khách cùng tình huống vẫn có nút để lại (không đổi hành vi cũ)", async () => {
    renderDetail(ACTORS.dispatcher, planWithUnplaced());
    expect(await screen.findAllByRole("button", { name: L.actions.acknowledge })).not.toHaveLength(
      0,
    );
    expect(screen.queryByText(T.detail.shipsWhole)).not.toBeInTheDocument();
  });

  it("chốt kế hoạch lệnh chuyển kho: BE 409 TRANSFER_SHIPS_WHOLE → câu tiếng Việt trong hộp thoại", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(ACTORS.dispatcher, transferPlanFixture());
    post.mockRejectedValueOnce(
      new ApiError(409, "TRANSFER_SHIPS_WHOLE", "A transfer order leaves whole"),
    );
    await user.click(await screen.findByRole("button", { name: L.actions.confirm }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: D.confirm.confirm }));
    expect(await within(dialog).findByText(ERRORS.TRANSFER_SHIPS_WHOLE)).toBeInTheDocument();
    expect(calls(post, `${PATH}/confirmation`)).toHaveLength(1);
  });

  it("đổi đầu vào: lệnh cố định (chỉ xem), chỉ loại xe / chế độ đổi được; PUT gửi sourceType + transferOrderIds, không shipmentIds, không hỏi lô ứng viên", async () => {
    const user = userEvent.setup();
    const { put, get } = renderDetail(
      ACTORS.dispatcher,
      transferPlanFixture({ status: "DRAFT", vehicles: [] }),
    );
    await user.click(await screen.findByRole("button", { name: L.actions.editInputs }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(T.detail.editInputsFixed)).toBeInTheDocument();
    expect(within(dialog).getAllByText(TRANSFER_NUMBER).length).toBeGreaterThan(0);
    expect(
      within(dialog).queryByRole("radio", { name: new RegExp(T.transferNumber) }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("checkbox", {
        name: new RegExp(UI_LABELS.loadPlan.createForm.shipmentCode),
      }),
    ).not.toBeInTheDocument();
    await within(dialog).findByRole("checkbox", { name: /PICKUP/ });
    await user.click(within(dialog).getByRole("radio", { name: /Ít xe nhất/ }));
    await user.click(within(dialog).getByRole("button", { name: D.editInputs.confirm }));
    await waitFor(() => expect(calls(put, `${PATH}/inputs`)).toHaveLength(1));
    expect(calls(put, `${PATH}/inputs`)[0][1]).toEqual({
      expectedVersion: 4,
      sourceType: "TRANSFER",
      transferOrderIds: [TRANSFER_ORDER_ID],
      vehicleTypeIds: [VEHICLE_TYPE_ID],
      selectionMode: "FEWEST_VEHICLES",
    });
    expect(calls(get, "/fulfillment/load-plan-candidates")).toHaveLength(0);
  });
});
