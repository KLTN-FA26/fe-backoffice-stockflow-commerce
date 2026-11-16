import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PAGE_SIZE, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { OTHER_STARTER_ID, QUEUE_PATH, STARTER_ID, queueRow } from "../__fixtures__/carton-check";
import {
  IDENTITIES,
  mockFulfillmentApi,
  pickSelectOption,
  renderFulfillmentScreen,
} from "../__fixtures__/render";
import { PICKER_ID, bePage } from "../__fixtures__/task";
import { CartonCheckQueue } from "./CartonCheckQueue";

import type { TestIdentity } from "../__fixtures__/render";
import type { CartonCheckQueueRowDto } from "../carton-check-types";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  push.mockClear();
});

const L = UI_LABELS.cartonCheck;
const WAREHOUSES = bePage([
  { id: "wh-1", prefix: "HN01", name: "Kho Hà Nội", status: "ACTIVE" },
  { id: "wh-2", prefix: "HCM01", name: "Kho TP.HCM", status: "ACTIVE" },
]);

function renderQueue(
  rows: CartonCheckQueueRowDto[] | ((params: unknown) => unknown),
  identity: TestIdentity = IDENTITIES.warehouseStaff,
) {
  const spies = mockFulfillmentApi(identity, {
    [QUEUE_PATH]: typeof rows === "function" ? rows : () => bePage(rows),
    "/warehouses": () => WAREHOUSES,
  });
  renderFulfillmentScreen(<CartonCheckQueue />);
  return spies;
}

const queueCalls = (get: ReturnType<typeof renderQueue>["get"]) =>
  get.mock.calls
    .filter(([url]) => url === QUEUE_PATH)
    .map(([, config]) => (config as { params: unknown }).params);

describe("CartonCheckQueue — hàng chờ kiểm thùng", () => {
  it("hiện đơn chờ: số đơn, kho, người lấy, người kiểm, trạng thái, tiến độ thùng, số shipment", async () => {
    const { get } = renderQueue([
      queueRow(),
      queueRow({
        taskId: "t2",
        orderNumber: "SO-20261010-000432",
        warehouseId: "wh-2",
        status: "IN_PROGRESS",
        startedBy: OTHER_STARTER_ID,
        startedByName: "Nguyễn Văn Đạt",
        cartonCount: 4,
        checkedCount: 3,
        labeledCount: 2,
        shipmentCount: 1,
      }),
    ]);

    const first = (await screen.findByText("SO-20261010-000431")).closest("tr") as HTMLElement;
    expect(within(first).getByText(L.noStarter)).toBeInTheDocument();
    expect(within(first).getByText("Chờ xử lý")).toBeInTheDocument();
    expect(within(first).getByText("Kho Hà Nội")).toBeInTheDocument();
    const second = screen.getByText("SO-20261010-000432").closest("tr") as HTMLElement;
    expect(within(second).getByText("Nguyễn Văn Đạt")).toBeInTheDocument();
    expect(within(second).getByText("Đang xử lý")).toBeInTheDocument();
    expect(within(second).getByText(L.cartonsCell(3, 2, 4))).toBeInTheDocument();
    expect(within(second).getByText("Kho TP.HCM")).toBeInTheDocument();
    // Phân trang BE: trang 0, mặc định PAGE_SIZE.md; chưa lọc thì không gửi warehouseId / status
    expect(queueCalls(get)[0]).toEqual({
      page: 0,
      size: PAGE_SIZE.md,
      warehouseId: undefined,
      status: undefined,
    });
  });

  it("người đang kiểm là chính mình → hiện 'Bạn'", async () => {
    renderQueue([
      queueRow({ status: "IN_PROGRESS", startedBy: PICKER_ID, startedByName: "Hoàng Anh Tuấn" }),
    ]);
    const row = (await screen.findByText("SO-20261010-000431")).closest("tr") as HTMLElement;
    expect(PICKER_ID).toBe(STARTER_ID);
    expect(within(row).getByText(L.status.you)).toBeInTheDocument();
  });

  it("nút Mở trạm là link; bấm hàng → sang trạm kiểm thùng của task", async () => {
    const user = userEvent.setup();
    renderQueue([queueRow()]);
    const open = await screen.findByRole("link", { name: new RegExp(L.openStation) });
    expect(open).toHaveAttribute("href", "/admin/packing/3f2c9a10-7b1d-4e55-9c0a-1d2e3f4a5b6c");
    await user.click(screen.getByText("SO-20261010-000431"));
    expect(push).toHaveBeenCalledWith("/admin/packing/3f2c9a10-7b1d-4e55-9c0a-1d2e3f4a5b6c");
  });

  it("lọc theo kho và trạng thái → gửi warehouseId / status, về trang đầu", async () => {
    const user = userEvent.setup();
    const { get } = renderQueue([queueRow()]);
    await screen.findByText("SO-20261010-000431");
    await pickSelectOption(user, L.filters.warehouse, /HCM01 · Kho TP\.HCM/);
    await waitFor(() => expect(queueCalls(get).at(-1)).toMatchObject({ warehouseId: "wh-2" }));
    await pickSelectOption(user, L.filters.status, L.statusFilter.IN_PROGRESS);
    await waitFor(() =>
      expect(queueCalls(get).at(-1)).toMatchObject({
        warehouseId: "wh-2",
        status: "IN_PROGRESS",
        page: 0,
      }),
    );
    await user.click(screen.getByRole("button", { name: L.clearFilters }));
    await waitFor(() => expect(screen.queryByRole("button", { name: L.clearFilters })).toBeNull());
    expect(screen.getByRole("combobox", { name: L.filters.status })).toHaveTextContent(
      L.filters.allWaiting,
    );
  });

  it("chưa có đơn nào → EmptyState; lọc không ra → EmptyState khác kèm nút Bỏ bộ lọc", async () => {
    const user = userEvent.setup();
    renderQueue([]);
    expect(await screen.findByText(L.emptyTitle)).toBeInTheDocument();
    await pickSelectOption(user, L.filters.status, L.statusFilter.IN_PROGRESS);
    expect(await screen.findByText(UI_LABELS.emptyList.noResultsTitle)).toBeInTheDocument();
    // Một nút ở thanh lọc, một nút trong EmptyState — bấm nút trong vùng nội dung
    const clear = screen.getAllByRole("button", { name: L.clearFilters });
    expect(clear).toHaveLength(2);
    await user.click(clear[1] as HTMLElement);
    expect(await screen.findByText(L.emptyTitle)).toBeInTheDocument();
  });

  it("lỗi tải: báo + Thử lại gọi lại API", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    let attempts = 0;
    renderQueue(() => {
      attempts += 1;
      if (attempts === 1) throw new ApiError(500, "INTERNAL_ERROR", "boom");
      return bePage([queueRow()]);
    });
    await user.click(await screen.findByRole("button", { name: UI_LABELS.common.retry }));
    expect(await screen.findByText("SO-20261010-000431")).toBeInTheDocument();
  });

  it("thiếu fulfillment-packages:READ (có VIEW_PAGE) → không gọi API hàng chờ, báo không có quyền xem", async () => {
    const identity = { permissions: ["fulfillment-packages:VIEW_PAGE" as const] };
    const { get } = renderQueue([queueRow()], identity);
    expect(await screen.findByText(UI_LABELS.loadError.noReadTitle)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === QUEUE_PATH)).toBe(false);
  });

  it("điều phối đơn theo seed BE không có packages:VIEW_PAGE → bị chặn ở cổng route", async () => {
    renderQueue([queueRow()], IDENTITIES.orderCoordinator);
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
  });
});
