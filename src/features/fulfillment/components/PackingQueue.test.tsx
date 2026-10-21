import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PAGE_SIZE, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { OTHER_PACKER_ID, queueRow } from "../__fixtures__/packing";
import {
  IDENTITIES,
  mockFulfillmentApi,
  pickSelectOption,
  renderFulfillmentScreen,
} from "../__fixtures__/render";
import { PICKER_ID, bePage } from "../__fixtures__/task";
import { PackingQueue } from "./PackingQueue";

import type { TestIdentity } from "../__fixtures__/render";
import type { PackingQueueRowDto } from "../packing-types";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  push.mockClear();
});

const P = UI_LABELS.packing;
const QUEUE = "/fulfillment/packing-queue";
const WAREHOUSES = bePage([
  { id: "wh-1", prefix: "HN01", name: "Kho Hà Nội", status: "ACTIVE" },
  { id: "wh-2", prefix: "HCM01", name: "Kho TP.HCM", status: "ACTIVE" },
]);

function renderQueue(
  rows: PackingQueueRowDto[] | ((params: unknown) => unknown),
  identity: TestIdentity = IDENTITIES.warehouseStaff,
) {
  const spies = mockFulfillmentApi(identity, {
    [QUEUE]: typeof rows === "function" ? rows : () => bePage(rows),
    "/warehouses": () => WAREHOUSES,
  });
  renderFulfillmentScreen(<PackingQueue />);
  return spies;
}

const queueCalls = (get: ReturnType<typeof renderQueue>["get"]) =>
  get.mock.calls
    .filter(([url]) => url === QUEUE)
    .map(([, config]) => (config as { params: unknown }).params);

describe("PackingQueue — hàng chờ đóng gói", () => {
  it("hiện đơn chờ: số đơn, kho, người lấy, người nhận đóng, trạng thái, kiện niêm phong / tổng, số lô giao", async () => {
    const { get } = renderQueue([
      queueRow(),
      queueRow({
        taskId: "t2",
        orderNumber: "SO-20261010-000432",
        warehouseId: "wh-2",
        packStatus: "PACKING",
        packerId: OTHER_PACKER_ID,
        packerName: "Nguyễn Văn Đạt",
        packageCount: 2,
        sealedPackageCount: 1,
        shipmentCount: 1,
      }),
      queueRow({ taskId: "t3", orderNumber: "SO-20261010-000433", packStatus: "ON_HOLD" }),
    ]);

    const first = (await screen.findByText("SO-20261010-000431")).closest("tr") as HTMLElement;
    expect(within(first).getByText(P.noPacker)).toBeInTheDocument();
    expect(within(first).getByText("Chờ xử lý")).toBeInTheDocument();
    expect(within(first).getByText("Kho Hà Nội")).toBeInTheDocument();
    const second = screen.getByText("SO-20261010-000432").closest("tr") as HTMLElement;
    expect(within(second).getByText("Nguyễn Văn Đạt")).toBeInTheDocument();
    expect(within(second).getByText("Đang đóng gói")).toBeInTheDocument();
    expect(within(second).getByText(P.packagesCell(1, 2))).toBeInTheDocument();
    expect(within(second).getByText("Kho TP.HCM")).toBeInTheDocument();
    expect(
      within(screen.getByText("SO-20261010-000433").closest("tr") as HTMLElement).getByText(
        "Tạm giữ",
      ),
    ).toBeInTheDocument();
    // Phân trang BE: trang 0, mặc định PAGE_SIZE.md; chưa lọc thì không gửi warehouseId / status
    expect(queueCalls(get)[0]).toEqual({
      page: 0,
      size: PAGE_SIZE.md,
      warehouseId: undefined,
      status: undefined,
    });
  });

  it("người đang đóng là chính mình → hiện 'Bạn'", async () => {
    renderQueue([
      queueRow({ packStatus: "PACKING", packerId: PICKER_ID, packerName: "Hoàng Anh Tuấn" }),
    ]);
    const row = (await screen.findByText("SO-20261010-000431")).closest("tr") as HTMLElement;
    expect(within(row).getByText(P.status.you)).toBeInTheDocument();
  });

  it("nút Mở trạm là link; bấm hàng → sang trạm đóng gói của task", async () => {
    const user = userEvent.setup();
    renderQueue([queueRow()]);
    const open = await screen.findByRole("link", { name: new RegExp(P.openStation) });
    expect(open).toHaveAttribute("href", "/admin/packing/3f2c9a10-7b1d-4e55-9c0a-1d2e3f4a5b6c");
    await user.click(screen.getByText("SO-20261010-000431"));
    expect(push).toHaveBeenCalledWith("/admin/packing/3f2c9a10-7b1d-4e55-9c0a-1d2e3f4a5b6c");
  });

  it("lọc theo kho và trạng thái → gửi warehouseId / status, về trang đầu", async () => {
    const user = userEvent.setup();
    const { get } = renderQueue([queueRow()]);
    await screen.findByText("SO-20261010-000431");
    await pickSelectOption(user, P.filters.warehouse, /HCM01 · Kho TP\.HCM/);
    await waitFor(() => expect(queueCalls(get).at(-1)).toMatchObject({ warehouseId: "wh-2" }));
    await pickSelectOption(user, P.filters.status, P.statusFilter.ON_HOLD);
    await waitFor(() =>
      expect(queueCalls(get).at(-1)).toMatchObject({
        warehouseId: "wh-2",
        status: "ON_HOLD",
        page: 0,
      }),
    );
    await user.click(screen.getByRole("button", { name: P.clearFilters }));
    // Bộ lọc về mặc định (kết quả của khoá truy vấn này đã có trong cache nên không gọi lại BE)
    await waitFor(() => expect(screen.queryByRole("button", { name: P.clearFilters })).toBeNull());
    expect(screen.getByRole("combobox", { name: P.filters.status })).toHaveTextContent(
      P.filters.allWaiting,
    );
  });

  it("chưa có đơn nào → EmptyState; lọc không ra → EmptyState khác kèm nút Bỏ bộ lọc", async () => {
    const user = userEvent.setup();
    renderQueue([]);
    expect(await screen.findByText(P.emptyTitle)).toBeInTheDocument();
    await pickSelectOption(user, P.filters.status, P.statusFilter.PACKING);
    expect(await screen.findByText(UI_LABELS.emptyList.noResultsTitle)).toBeInTheDocument();
    // Một nút ở thanh lọc, một nút trong EmptyState — bấm nút trong vùng nội dung
    const clear = screen.getAllByRole("button", { name: P.clearFilters });
    expect(clear).toHaveLength(2);
    await user.click(clear[1] as HTMLElement);
    expect(await screen.findByText(P.emptyTitle)).toBeInTheDocument();
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
    const identity = {
      permissions: ["fulfillment-packages:VIEW_PAGE" as const],
    };
    const { get } = renderQueue([queueRow()], identity);
    expect(await screen.findByText(UI_LABELS.loadError.noReadTitle)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === QUEUE)).toBe(false);
  });

  it("điều phối đơn theo seed BE không có packages:VIEW_PAGE → bị chặn ở cổng route", async () => {
    renderQueue([queueRow()], IDENTITIES.orderCoordinator);
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
  });
});
