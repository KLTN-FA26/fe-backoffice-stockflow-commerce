import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  LOAD_ESTIMATE_PERMISSIONS,
  LOAD_PLAN_ERROR_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";
import { ApiError } from "@/lib/api/error";
import { useAppStore } from "@/lib/store/use-app-store";

import { apiEstimate } from "../../__fixtures__/estimate";
import { LAYOUT_PICKUP_KIT } from "../../__fixtures__/layouts";
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

const OTHER_SHIPMENT = candidateFixture({
  shipmentId: "22222222-0000-4000-8000-000000000009",
  code: "SO-20261004-000002-S1",
  orderId: "order-2",
  orderNumber: "SO-20261004-000002",
  readyAt: "2026-10-21T01:30:00Z",
});

const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 100,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});

/** Mặc định hai lô ứng viên: không lô nào được chọn sẵn (một lô duy nhất mới được chọn sẵn — R6). */
function renderCreate(
  actor: TestActor,
  calc: () => unknown = () => planFixture({ version: 5 }),
  candidate = candidateFixture(),
  candidates: unknown[] = [candidate, OTHER_SHIPMENT],
  extraGet: Record<string, () => unknown> = {},
) {
  const spies = mockLoadPlanApi(actor, {
    get: {
      [CANDIDATES]: () => candidates,
      [VEHICLE_TYPES]: () => page([vehicleType]),
      ...extraGet,
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
  await user.click(await screen.findByRole("checkbox", { name: /Pickup truck/ }));
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

  it("only the customers' shipments are a source: no sourceType asked or sent (BE: sourceType is ORDER only)", async () => {
    const { get, post } = renderCreate(ACTORS.dispatcher);
    expect(await screen.findByText(candidateFixture().code)).toBeInTheDocument();
    expect(
      get.mock.calls.some(
        ([, config]) => (config?.params as { sourceType?: string } | undefined)?.sourceType,
      ),
    ).toBe(false);
    await fillAndSubmit();
    await waitFor(() => expect(post).toHaveBeenCalledWith(PATH, expect.anything()));
    const body = post.mock.calls.find(([url]) => url === PATH)?.[1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("sourceType");
    expect(body).not.toHaveProperty("transferOrderIds");
  });

  it("every vehicle-type checkbox is named by its Vietnamese name; the code is only the hover hint (R3)", async () => {
    renderCreate(ACTORS.dispatcher);
    const box = await screen.findByRole("checkbox", { name: "Pickup truck" });
    expect(box).toBeInTheDocument();
    expect(box.closest("label")).toHaveAttribute("title", "PICKUP");
    expect(screen.queryByText(/PICKUP/)).not.toBeInTheDocument();
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

  it("shows the six rows of docs 09 §4.2: five modes to choose, each with its hint, and 'Chỉnh tay' done on the plan page (WF4-LP-MODES)", async () => {
    renderCreate(ACTORS.dispatcher);
    const radios = await screen.findAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("value"))).toEqual([
      "SINGLE_TYPE",
      "FEWEST_VEHICLES",
      "KEEP_LINES",
      "PRIORITY_FILL",
      "OVER_CAPACITY",
    ]);
    expect(screen.getByRole("radio", { name: /Ưu tiên \+ hàng chèn/ })).toBeInTheDocument();
    // "Chỉnh tay" là dòng chú thích, không phải ô trông như bấm được (S16-3)
    expect(screen.getByText(L.manualModeNote)).toBeInTheDocument();
    expect(screen.getByText(L.manualModeNote).closest("label")).toBeNull();
    expect(screen.getByRole("radio", { name: /Giữ nguyên dòng/ })).toBeInTheDocument();
    expect(screen.getByText(/cùng một dòng hàng của đơn đi chung một xe/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Vượt sức chứa/ })).toBeInTheDocument();
  });

  it("RTM-LPGROUP: 'Ưu tiên + hàng chèn' shows a tick per order line of the chosen shipments, main cargo by default; the ticked lines are sent", async () => {
    const base = candidateFixture();
    const half = Math.ceil(base.packages.length / 2);
    const candidate = candidateFixture({
      packages: base.packages.map((p, i) => ({
        ...p,
        orderLineId: i < half ? "LINE-A" : "LINE-B",
        partName: i < half ? "SKU-A" : "SKU-B",
      })),
    });
    const { post } = renderCreate(ACTORS.dispatcher, undefined, candidate);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("checkbox", { name: `${L.shipmentCode} ${candidate.code}` }),
    );
    expect(screen.queryByText(L.fillTitle)).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Ưu tiên \+ hàng chèn/ }));
    const lineA = await screen.findByRole("checkbox", {
      name: L.fillAria(candidate.code, "SKU-A"),
    });
    const lineB = screen.getByRole("checkbox", { name: L.fillAria(candidate.code, "SKU-B") });
    expect(lineA).not.toBeChecked();
    expect(lineB).not.toBeChecked();
    expect(
      screen.getByText(L.fillLine(candidate.code, "SKU-B", base.packages.length - half)),
    ).toBeInTheDocument();
    await user.click(lineB);
    await user.click(await screen.findByRole("checkbox", { name: /Pickup truck/ }));
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({
      selectionMode: "PRIORITY_FILL",
      fillOrderLineIds: ["LINE-B"],
    });
  });

  it("another mode sends no filler lines, even after ticking some under 'Ưu tiên + hàng chèn'", async () => {
    const base = candidateFixture();
    const candidate = candidateFixture({
      packages: base.packages.map((p) => ({ ...p, orderLineId: "LINE-A", partName: "SKU-A" })),
    });
    const { post } = renderCreate(ACTORS.dispatcher, undefined, candidate);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("checkbox", { name: `${L.shipmentCode} ${candidate.code}` }),
    );
    await user.click(screen.getByRole("radio", { name: /Ưu tiên \+ hàng chèn/ }));
    await user.click(
      await screen.findByRole("checkbox", { name: L.fillAria(candidate.code, "SKU-A") }),
    );
    await user.click(screen.getByRole("radio", { name: /Một loại xe/ }));
    await user.click(await screen.findByRole("checkbox", { name: /Pickup truck/ }));
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(
      (post.mock.calls[0][1] as { fillOrderLineIds?: unknown }).fillOrderLineIds,
    ).toBeUndefined();
  });

  it("sends the chosen mode (KEEP_LINES)", async () => {
    const { post } = renderCreate(ACTORS.dispatcher);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: /Giữ nguyên dòng/ }));
    await user.click(
      await screen.findByRole("checkbox", { name: `${L.shipmentCode} ${candidateFixture().code}` }),
    );
    await user.click(await screen.findByRole("checkbox", { name: /Pickup truck/ }));
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({ selectionMode: "KEEP_LINES" });
  });

  it("sends the chosen mode (FEWEST_VEHICLES)", async () => {
    const { post } = renderCreate(ACTORS.dispatcher);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: /Ít xe nhất/ }));
    await user.click(
      await screen.findByRole("checkbox", { name: `${L.shipmentCode} ${candidateFixture().code}` }),
    );
    await user.click(await screen.findByRole("checkbox", { name: /Pickup truck/ }));
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({ selectionMode: "FEWEST_VEHICLES" });
  });

  it("R7: with nothing chosen the create button is locked and says what is missing, no request", async () => {
    const { post } = renderCreate(ACTORS.dispatcher);
    const user = userEvent.setup();
    await screen.findByText(candidateFixture().code);
    const button = screen.getByRole("button", { name: L.submit });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(`${L.missingPrefix}: ${L.missingShipments}, ${L.missingVehicleTypes}`),
    ).toBeInTheDocument();
    await user.click(button);
    expect(post).not.toHaveBeenCalled();
    // Chọn lô + loại xe thì dòng "Còn thiếu" biến mất và nút mở
    await user.click(
      screen.getByRole("checkbox", { name: `${L.shipmentCode} ${candidateFixture().code}` }),
    );
    await user.click(await screen.findByRole("checkbox", { name: /Pickup truck/ }));
    expect(button).toBeEnabled();
    expect(screen.queryByText(new RegExp(`^${L.missingPrefix}`))).not.toBeInTheDocument();
  });

  it("S16-2 (BE PR #488): customer and province columns appear only when the BE sends them, and the search covers them", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 5 }, (_, i) =>
      candidateFixture({
        shipmentId: `s-${i}`,
        code: `SO-2026110${i}-S1`,
        orderNumber: `SO-2026110${i}`,
        customerName: i === 3 ? "Quán Trà Sữa Mây" : `Khách ${i}`,
        deliveryProvinceName: i === 3 ? "Đà Nẵng" : "Hà Nội",
      }),
    );
    renderCreate(ACTORS.dispatcher, undefined, undefined, many);
    await screen.findByText("SO-20261100-S1");
    expect(screen.getByRole("columnheader", { name: L.customer })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: L.province })).toBeInTheDocument();
    expect(screen.getByText("Quán Trà Sữa Mây")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: L.searchPlaceholder }), "đà nẵng");
    expect(
      screen.getAllByRole("checkbox", { name: new RegExp(`^${L.shipmentCode} `) }),
    ).toHaveLength(1);
    expect(screen.getByText("SO-20261103-S1")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: L.searchPlaceholder }));
    await user.type(screen.getByRole("searchbox", { name: L.searchPlaceholder }), "trà sữa");
    expect(
      screen.getAllByRole("checkbox", { name: new RegExp(`^${L.shipmentCode} `) }),
    ).toHaveLength(1);
  });

  it("before BE #488 (no customer / province fields) the table has no empty columns", async () => {
    renderCreate(ACTORS.dispatcher);
    await screen.findByText(candidateFixture().code);
    expect(screen.queryByRole("columnheader", { name: L.customer })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: L.province })).not.toBeInTheDocument();
  });

  it("S16-4 (BE PR #488): the filler list shows the product name next to the SKU when present", async () => {
    const base = candidateFixture();
    const candidate = candidateFixture({
      packages: base.packages.map((p) => ({
        ...p,
        orderLineId: "LINE-A",
        partName: "SKU-A",
        productName: "Ly giấy 2 lớp 12oz",
      })),
    });
    renderCreate(ACTORS.dispatcher, undefined, candidate);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("checkbox", { name: `${L.shipmentCode} ${candidate.code}` }),
    );
    await user.click(screen.getByRole("radio", { name: /Ưu tiên \+ hàng chèn/ }));
    expect(
      await screen.findByText(
        L.fillLine(candidate.code, "SKU-A", base.packages.length, "Ly giấy 2 lớp 12oz"),
      ),
    ).toBeInTheDocument();
  });

  it("R6: a warehouse with exactly one shipment to plan has it chosen already", async () => {
    renderCreate(ACTORS.dispatcher, undefined, undefined, [candidateFixture()]);
    const box = await screen.findByRole("checkbox", {
      name: `${L.shipmentCode} ${candidateFixture().code}`,
    });
    await waitFor(() => expect(box).toBeChecked());
    expect(screen.getByText(/Đã chọn 1 lô/)).toBeInTheDocument();
  });

  it("the shipments are sorted by ready time, earliest first", async () => {
    renderCreate(ACTORS.dispatcher);
    await screen.findByText(candidateFixture().code);
    const codes = screen
      .getAllByRole("checkbox", { name: new RegExp(`^${L.shipmentCode} `) })
      .map((box) => box.getAttribute("aria-label"));
    expect(codes).toEqual([
      `${L.shipmentCode} ${OTHER_SHIPMENT.code}`,
      `${L.shipmentCode} ${candidateFixture().code}`,
    ]);
  });

  it("UX-Q4: with a load estimate for the chosen shipment its vehicle type is chosen and marked; the user can still change it", async () => {
    const estimate = apiEstimate({
      sourceId: "order-1",
      vehicles: [{ ...LAYOUT_PICKUP_KIT, code: "PICKUP" }],
    });
    const estimator = {
      permissions: [...ACTORS.dispatcher.permissions, LOAD_ESTIMATE_PERMISSIONS.read],
    };
    const { post } = renderCreate(estimator, undefined, undefined, undefined, {
      "/fulfillment/load-estimates": () => estimate,
    });
    const user = userEvent.setup();
    const vehicle = await screen.findByRole("checkbox", { name: "Pickup truck" });
    expect(vehicle).not.toBeChecked();
    await user.click(
      screen.getByRole("checkbox", { name: `${L.shipmentCode} ${candidateFixture().code}` }),
    );
    await waitFor(() => expect(vehicle).toBeChecked());
    expect(screen.getByText(L.recommended)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({ vehicleTypeIds: [VEHICLE_TYPE_ID] });
  });

  it("UX-Q4: without an estimate no vehicle type is chosen; a type the user unticked is not put back", async () => {
    renderCreate(ACTORS.dispatcher, undefined, undefined, undefined, {
      "/fulfillment/load-estimates": () => {
        throw new ApiError(404, "LOAD_ESTIMATE_NOT_FOUND", "none");
      },
    });
    const user = userEvent.setup();
    const vehicle = await screen.findByRole("checkbox", { name: "Pickup truck" });
    await user.click(
      screen.getByRole("checkbox", { name: `${L.shipmentCode} ${candidateFixture().code}` }),
    );
    expect(vehicle).not.toBeChecked();
  });

  it("UX-Q4: types that carry the whole load in one vehicle come first, smallest first; a container is last", async () => {
    const big = {
      ...vehicleType,
      vehicleTypeId: "33333333-0000-4000-8000-000000000002",
      code: "20DC",
      name: "Container 20' Dry (20DC)",
      kind: "CONTAINER",
      innerLengthMm: 5898,
      innerWidthMm: 2352,
      innerHeightMm: 2393,
      maxPayloadKg: 28200,
    };
    const mid = {
      ...vehicleType,
      vehicleTypeId: "33333333-0000-4000-8000-000000000003",
      code: "TRUCK-5T",
      name: "Box truck 5 t (xe tải 5 tấn)",
      kind: "TRUCK",
      innerLengthMm: 5200,
      innerWidthMm: 2050,
      innerHeightMm: 2050,
      maxPayloadKg: 5000,
    };
    mockLoadPlanApi(ACTORS.dispatcher, {
      get: {
        [CANDIDATES]: () => [candidateFixture(), OTHER_SHIPMENT],
        [VEHICLE_TYPES]: () => page([big, mid, vehicleType]),
      },
    });
    renderLoadPlanScreen(<LoadPlanCreate />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("checkbox", { name: `${L.shipmentCode} ${candidateFixture().code}` }),
    );
    const names = () =>
      screen
        .getAllByRole("checkbox")
        .map((box) => box.getAttribute("aria-label") ?? "")
        .filter((label) => /Pickup|Xe tải|Container/.test(label));
    // Tải 201 kg · 8,0 m³: bán tải (0,86 m³) không chở hết trong một xe → xếp sau loại chở được; container cuối nhóm vừa
    await waitFor(() =>
      expect(names()).toEqual(["Xe tải 5 tấn", "Container 20' Dry", "Pickup truck"]),
    );
    expect(screen.getByText(L.vehicleTypesOthers)).toBeInTheDocument();
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
    const user = await fillAndSubmit();
    expect(
      await screen.findByText(LOAD_PLAN_ERROR_MESSAGES.LOAD_PLAN_PACKAGE_TAKEN),
    ).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    // The BE refused outright (no plan made): the next try must NOT replay the refused requestId
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const ids = post.mock.calls
      .filter(([url]) => url === PATH)
      .map(([, body]) => (body as { requestId: string }).requestId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
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
