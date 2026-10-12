import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TRANSFER_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  TRANSFER_ROLE_PERMISSIONS as ROLES,
  bePage,
  mockTransferApi,
  renderTransferScreen,
} from "../__fixtures__/render";
import { FROM_WH, TO_WH, TRANSFER_ID, warehouses } from "../__fixtures__/transfer";
import { TransferList } from "./TransferList";

import type { RouteHandler } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const PATH = "/inventory/transfer-orders";
const L = UI_LABELS.transfer;
const E = UI_LABELS.emptyList;

const row = {
  transferId: TRANSFER_ID,
  number: "TO-20261012-0001",
  fromWarehouseId: FROM_WH,
  toWarehouseId: TO_WH,
  status: "APPROVED",
  expectedDate: "2026-10-20",
  createdAt: "2026-10-12T02:00:00Z",
};

function renderList(list: RouteHandler, searchParams = "") {
  const spies = mockTransferApi(ROLES.inventoryPlanner, {
    [PATH]: list,
    "/warehouses": () => warehouses,
  });
  renderTransferScreen(<TransferList />, searchParams);
  return spies;
}

describe("TransferList — lọc qua URL → API → bảng", () => {
  it("tham số URL (trạng thái, kho, search, trang) → gửi đúng params BE (trang từ 0)", async () => {
    const { get } = renderList(
      () => bePage([row]),
      `?status=APPROVED&from=${FROM_WH}&q=TO-2026&page=2`,
    );
    expect(await screen.findByText("TO-20261012-0001")).toBeInTheDocument();
    const call = get.mock.calls.find(([url]) => url === PATH);
    expect(call?.[1]).toMatchObject({
      params: {
        page: 1,
        status: ["APPROVED"],
        fromWarehouseId: FROM_WH,
        search: "TO-2026",
      },
    });
  });

  it("kho trong URL không phải UUID → không gửi lên BE (tránh 400)", async () => {
    const { get } = renderList(() => bePage([row]), "?from=abc");
    await screen.findByText("TO-20261012-0001");
    const call = get.mock.calls.find(([url]) => url === PATH);
    expect(call?.[1]).toMatchObject({ params: { fromWarehouseId: undefined } });
  });
});

describe("TransferList — hai loại empty state", () => {
  it("chưa có lệnh nào (không lọc) → 'Chưa có lệnh chuyển kho' + nút tạo", async () => {
    renderList(() => bePage([]));
    expect(await screen.findByText(L.empty.noDataTitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: L.empty.noDataAction })).toBeInTheDocument();
  });

  it("đang lọc không ra kết quả → 'Không tìm thấy kết quả' + Bỏ bộ lọc (khác empty chưa có dữ liệu)", async () => {
    const user = userEvent.setup();
    const { get } = renderList(() => bePage([]), "?status=CANCELLED");
    expect(await screen.findByText(E.noResultsTitle)).toBeInTheDocument();
    expect(screen.queryByText(L.empty.noDataTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: E.clearFilters }));
    await waitFor(() => {
      const last = get.mock.calls.filter(([url]) => url === PATH).at(-1);
      expect(last?.[1]).toMatchObject({ params: { status: undefined } });
    });
  });
});

describe("TransferList — BE 400 tham số", () => {
  it("số trang sai (BE UNSUPPORTED_PARAMETER) → về trang đầu, không báo 'không tìm thấy lệnh'", async () => {
    renderList(() => {
      throw new ApiError(400, "UNSUPPORTED_PARAMETER", "bad page");
    }, "?page=3000000000");
    expect(await screen.findByText(E.invalidPageTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.firstPage })).toBeInTheDocument();
    expect(screen.queryByText(L.notFoundTitle)).not.toBeInTheDocument();
  });

  it("400 ở trang đầu → báo tham số lọc không hợp lệ + Bỏ bộ lọc", async () => {
    renderList(() => {
      throw new ApiError(400, "UNSUPPORTED_PARAMETER", "bad");
    }, "?status=APPROVED");
    expect(
      await screen.findByText(TRANSFER_ERROR_MESSAGES.UNSUPPORTED_PARAMETER),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.clearFilters })).toBeInTheDocument();
  });
});
