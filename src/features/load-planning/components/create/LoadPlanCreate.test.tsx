import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, LOAD_PLAN_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";
import { ApiError } from "@/lib/api/error";
import { useAppStore } from "@/lib/store/use-app-store";

import {
  PLAN_ID,
  SHIPMENT_ID,
  VEHICLE_TYPE_ID,
  WAREHOUSE_ID,
  candidateFixture,
  planFixture,
} from "../../__fixtures__/plans";
import {
  LOAD_PLAN_ACTORS as ACTORS,
  mockLoadPlanApi,
  renderLoadPlanScreen,
} from "../../__fixtures__/render-plan";
import { clearCreatePlanRequestId } from "../../request-ids";
import { LoadPlanCreate } from "./LoadPlanCreate";

import type { TestActor } from "../../__fixtures__/render-plan";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const L = UI_LABELS.loadPlan.createForm;
const PATH = "/fulfillment/load-plans";
const VEHICLE_TYPES = "/fulfillment/vehicle-types";
const CANDIDATES = "/fulfillment/load-plan-candidates";

const vehicleType = {
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
};

beforeEach(() => {
  clearCreatePlanRequestId();
  window.sessionStorage.clear();
  useAppStore.setState({ warehouseId: WAREHOUSE_ID });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  push.mockClear();
  useAppStore.setState({ warehouseId: null });
});

function renderCreate(actor: TestActor, calc: () => unknown = () => planFixture({ version: 5 })) {
  const spies = mockLoadPlanApi(actor, {
    get: {
      [CANDIDATES]: () => [candidateFixture()],
      [VEHICLE_TYPES]: () => ({
        items: [vehicleType],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      }),
    },
    post: {
      [PATH]: () => planFixture({ status: "DRAFT", version: 0, vehicles: [] }),
      [`${PATH}/${PLAN_ID}/calculation`]: calc,
    },
  });
  renderLoadPlanScreen(<LoadPlanCreate />);
  return spies;
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("checkbox", { name: `${L.shipmentCode} ${candidateFixture().code}` }),
  );
  await user.click(await screen.findByRole("checkbox", { name: /PICKUP/ }));
  await user.click(screen.getByRole("button", { name: L.submit }));
  return user;
}

describe("LoadPlanCreate — lập kế hoạch rồi tính xếp xe", () => {
  it("lists the candidate shipments of the warehouse, whole, with the active vehicle types", async () => {
    const { get } = renderCreate(ACTORS.dispatcher);
    expect(await screen.findByText(candidateFixture().code)).toBeInTheDocument();
    expect(await screen.findByText(/Pickup truck/)).toBeInTheDocument();
    const params = get.mock.calls.find(([url]) => url === CANDIDATES)?.[1]?.params;
    expect(params).toMatchObject({ warehouseId: WAREHOUSE_ID });
    expect(get.mock.calls.find(([url]) => url === VEHICLE_TYPES)?.[1]?.params).toMatchObject({
      status: "ACTIVE",
    });
  });

  it("every vehicle-type checkbox has an accessible name (code · name)", async () => {
    renderCreate(ACTORS.dispatcher);
    expect(
      await screen.findByRole("checkbox", { name: "PICKUP · Pickup truck" }),
    ).toBeInTheDocument();
  });

  it("a warehouse outside the caller's scope (403 on the candidates) says so instead of a generic failure", async () => {
    mockLoadPlanApi(ACTORS.dispatcher, {
      get: {
        [CANDIDATES]: () => {
          throw new ApiError(403, "OUT_OF_DATA_SCOPE", "Not authorised for this data");
        },
        [VEHICLE_TYPES]: () => ({
          items: [vehicleType],
          page: 0,
          size: 100,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      },
    });
    renderLoadPlanScreen(<LoadPlanCreate />);
    expect(await screen.findByText(LOAD_PLAN_ERROR_MESSAGES.OUT_OF_DATA_SCOPE)).toBeInTheDocument();
  });

  it("shows the LP-4 hint and the parcels another plan holds", async () => {
    mockLoadPlanApi(ACTORS.dispatcher, {
      get: {
        [CANDIDATES]: () => [candidateFixture({ packagesInOtherPlans: 5 })],
        [VEHICLE_TYPES]: () => ({
          items: [vehicleType],
          page: 0,
          size: 100,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      },
    });
    renderLoadPlanScreen(<LoadPlanCreate />);
    expect(await screen.findByText(L.partialNotAllowed)).toBeInTheDocument();
    expect(screen.getByText(L.inOtherPlans(5))).toBeInTheDocument();
  });

  it("creates the plan (client requestId, inputs), then calculates with its version, then opens the detail", async () => {
    const { post } = renderCreate(ACTORS.dispatcher);
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith(ADMIN_ROUTES.loadPlans.detail(PLAN_ID)));
    const [createUrl, createBody] = post.mock.calls[0];
    expect(createUrl).toBe(PATH);
    expect(createBody).toMatchObject({
      warehouseId: WAREHOUSE_ID,
      shipmentIds: [SHIPMENT_ID],
      vehicleTypeIds: [VEHICLE_TYPE_ID],
      selectionMode: "SINGLE_TYPE",
    });
    expect((createBody as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/);
    const [calcUrl, calcBody] = post.mock.calls[1];
    expect(calcUrl).toBe(`${PATH}/${PLAN_ID}/calculation`);
    expect(calcBody).toEqual({ expectedVersion: 0 });
  });

  it("sends the chosen mode (FEWEST_VEHICLES)", async () => {
    const { post } = renderCreate(ACTORS.dispatcher);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: /Ít xe nhất/ }));
    await user.click(
      await screen.findByRole("checkbox", { name: `${L.shipmentCode} ${candidateFixture().code}` }),
    );
    await user.click(await screen.findByRole("checkbox", { name: /PICKUP/ }));
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({ selectionMode: "FEWEST_VEHICLES" });
  });

  it("validates before calling the BE: nothing chosen → inline message, no request", async () => {
    const { post } = renderCreate(ACTORS.dispatcher);
    const user = userEvent.setup();
    await screen.findByText(candidateFixture().code);
    await user.click(screen.getByRole("button", { name: L.submit }));
    expect(await screen.findByText("Chọn ít nhất một lô giao.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("a retry after a lost response reuses the SAME requestId (idempotent create)", async () => {
    const { post } = renderCreate(ACTORS.dispatcher);
    post.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline"));
    const user = await fillAndSubmit();
    expect(await screen.findByText(L.errorTitle)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const ids = post.mock.calls
      .filter(([url]) => url === PATH)
      .map(([, body]) => (body as { requestId: string }).requestId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it("CONFLICT (requestId already used elsewhere) is explained and the retry gets a NEW requestId", async () => {
    const { post } = renderCreate(ACTORS.dispatcher);
    post.mockRejectedValueOnce(new ApiError(409, "CONFLICT", "Conflicting state"));
    const user = await fillAndSubmit();
    expect(await screen.findByText(LOAD_PLAN_ERROR_MESSAGES.CONFLICT)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const ids = post.mock.calls
      .filter(([url]) => url === PATH)
      .map(([, body]) => (body as { requestId: string }).requestId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("BE refusals (BR-09 taken) are shown in Vietnamese and nothing is calculated", async () => {
    const { post } = renderCreate(ACTORS.dispatcher);
    post.mockRejectedValueOnce(new ApiError(409, "LOAD_PLAN_PACKAGE_TAKEN", "A package ..."));
    await fillAndSubmit();
    expect(
      await screen.findByText(LOAD_PLAN_ERROR_MESSAGES.LOAD_PLAN_PACKAGE_TAKEN),
    ).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("when the plan is created but the calculation fails, it still opens the draft", async () => {
    const { post } = renderCreate(ACTORS.dispatcher, () => {
      throw new ApiError(409, "LOAD_PLAN_EMPTY", "nothing");
    });
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith(ADMIN_ROUTES.loadPlans.detail(PLAN_ID)));
    expect(post).toHaveBeenCalledTimes(2);
  });
});

describe("LoadPlanCreate — cổng quyền", () => {
  it("needs :CREATE: a view-only user sees a no-permission message and no form", async () => {
    renderCreate(ACTORS.viewOnly);
    expect(await screen.findByText(UI_LABELS.loadPlan.noCreateTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.submit })).not.toBeInTheDocument();
  });

  it("without VIEW_PAGE the whole page is denied", async () => {
    renderCreate(ACTORS.noAccess);
    expect(await screen.findByText(PERMISSION_UI.deniedTitle)).toBeInTheDocument();
  });
});
