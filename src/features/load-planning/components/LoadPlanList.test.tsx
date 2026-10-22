import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";
import { ApiError } from "@/lib/api/error";

import { PLAN_ID, WAREHOUSE_ID } from "../__fixtures__/plans";
import {
  LOAD_PLAN_ACTORS as ACTORS,
  bePage,
  mockLoadPlanApi,
  renderLoadPlanScreen,
} from "../__fixtures__/render-plan";
import { LoadPlanList } from "./LoadPlanList";

import type { TestActor } from "../__fixtures__/render-plan";
import type { PlanRow } from "../plan-types";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  push.mockClear();
});

const L = UI_LABELS.loadPlan;
const PATH = "/fulfillment/load-plans";

const row = (overrides: Partial<PlanRow> = {}): PlanRow => ({
  loadPlanId: PLAN_ID,
  code: "LP-20261022-0001",
  warehouseId: WAREHOUSE_ID,
  status: "PLANNED",
  selectionMode: "SINGLE_TYPE",
  shipmentCount: 2,
  packageCount: 61,
  vehicleCount: 3,
  unplacedCount: 1,
  createdAt: "2026-10-22T02:00:00Z",
  version: 4,
  ...overrides,
});

function renderList(actor: TestActor, search = "", rows: PlanRow[] = [row()]) {
  const spies = mockLoadPlanApi(actor, { get: { [PATH]: () => bePage(rows) } });
  renderLoadPlanScreen(<LoadPlanList />, search);
  return spies;
}

describe("LoadPlanList — hiển thị", () => {
  it("shows code, status, mode, shipments, vehicles, parcels and unplaced of each plan", async () => {
    renderList(ACTORS.viewOnly);
    const cell = await screen.findByText("LP-20261022-0001");
    const inRow = within(cell.closest("tr") as HTMLElement);
    expect(inRow.getByText("Đã tính xếp")).toBeInTheDocument();
    expect(inRow.getByText("Một loại xe")).toBeInTheDocument();
    for (const value of ["2", "3", "61", "1"])
      expect(inRow.getAllByText(value).length).toBeGreaterThan(0);
  });

  it("shows each BE status with its Vietnamese label", async () => {
    renderList(ACTORS.viewOnly, "", [
      row({ loadPlanId: "a", code: "LP-A", status: "DRAFT" }),
      row({ loadPlanId: "b", code: "LP-B", status: "CONFIRMED" }),
      row({ loadPlanId: "c", code: "LP-C", status: "CANCELLED" }),
    ]);
    await screen.findByText("LP-A");
    for (const label of ["Bản nháp", "Đã chốt", "Đã huỷ"])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it("filters / search / page on the URL reach the BE as status, warehouseId, search and a 0-based page", async () => {
    const { get } = renderList(
      ACTORS.viewOnly,
      `?status=DRAFT&warehouse=${WAREHOUSE_ID}&q=LP-1&page=2`,
    );
    await screen.findByText("LP-20261022-0001");
    await waitFor(() => {
      const params = get.mock.calls.find(([url]) => url === PATH)?.[1]?.params;
      expect(params).toMatchObject({
        status: "DRAFT",
        warehouseId: WAREHOUSE_ID,
        search: "LP-1",
        page: 1,
        size: 15,
      });
    });
  });

  it("no data and no results are different messages", async () => {
    renderList(ACTORS.viewOnly, "", []);
    expect(await screen.findByText(L.empty.noDataTitle)).toBeInTheDocument();
    cleanup();
    renderList(ACTORS.viewOnly, "?q=zzz", []);
    expect(await screen.findByText(UI_LABELS.emptyList.noResultsTitle)).toBeInTheDocument();
    expect(screen.getByText(L.empty.noResultsDescription)).toBeInTheDocument();
  });

  it("a load error shows the network message with a retry button", async () => {
    mockLoadPlanApi(ACTORS.viewOnly, {
      get: {
        [PATH]: () => {
          throw new ApiError(0, "NETWORK_ERROR", "offline");
        },
      },
    });
    renderLoadPlanScreen(<LoadPlanList />);
    expect(await screen.findByText(L.loadFailedTitle)).toBeInTheDocument();
    expect(screen.getByText(UI_LABELS.loadError.networkDescription)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: UI_LABELS.common.retry })).toBeInTheDocument();
  });
});

describe("LoadPlanList — cổng quyền theo mã", () => {
  it("a dispatcher (:CREATE) sees the create link to /admin/load-plans/create", async () => {
    renderList(ACTORS.dispatcher);
    const link = await screen.findByRole("link", { name: new RegExp(L.create) });
    expect(link).toHaveAttribute("href", ADMIN_ROUTES.loadPlans.create);
  });

  it("view-only users get the list but no create link", async () => {
    renderList(ACTORS.viewOnly);
    await screen.findByText("LP-20261022-0001");
    expect(screen.queryByRole("link", { name: new RegExp(L.create) })).not.toBeInTheDocument();
  });

  it("without VIEW_PAGE the page is denied and the plans are never requested", async () => {
    const { get } = renderList(ACTORS.noAccess);
    expect(await screen.findByText(PERMISSION_UI.deniedTitle)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === PATH)).toBe(false);
  });

  it("VIEW_PAGE without READ: no request for data, a clear message instead", async () => {
    const { get } = renderList(ACTORS.noRead);
    expect(await screen.findByText(L.noReadTitle)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === PATH)).toBe(false);
  });
});
