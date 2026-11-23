import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, RECEIVING_LABELS, WORKSPACE_PATHS } from "@/constants";
import { WorkspaceWarehouseProvider } from "@/lib/workspace";

import { HCM_ID, RECEIPT_ID, apiReceipt, apiReceiptPage } from "../../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  mockReceiptApi,
  renderReceiptScreen,
} from "../../__fixtures__/render";
import { ReceivingList } from "./ReceivingList";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const L = RECEIVING_LABELS;
const HCM = { id: HCM_ID, prefix: "HCM", name: "Kho Hồ Chí Minh" };
const RETURN_ID = "7d1c2b3a-0000-4000-8000-000000000099";

function renderTab(permissions: readonly PermissionCode[], page: unknown = apiReceiptPage()) {
  const spies = mockReceiptApi(permissions, { "/goods-receipts": () => page });
  renderReceiptScreen(
    <WorkspaceWarehouseProvider value={HCM}>
      <ReceivingList />
    </WorkspaceWarehouseProvider>,
  );
  return spies;
}

const listCalls = (get: ReturnType<typeof renderTab>["get"]) =>
  get.mock.calls
    .filter(([url]) => url === "/goods-receipts")
    .map(([, config]) => (config as { params?: Record<string, unknown> } | undefined)?.params);

describe("ReceivingList — Nhận hàng trong tab theo kho (docs 03)", () => {
  it("mặc định tab Đang nhận: gửi warehouseId của kho trên URL + status DRAFT, không có ô chọn kho", async () => {
    const { get } = renderTab(ROLES.warehouseStaff);
    await screen.findByRole("link", { name: "GR-20261009-0001" });
    expect(listCalls(get)[0]).toMatchObject({ warehouseId: HCM_ID, status: ["DRAFT"] });
    expect(screen.queryByRole("combobox", { name: /kho/i })).not.toBeInTheDocument();
  });

  it("link chi tiết ở lại trong tab: phiếu Đơn sản xuất → receiving/{id}, phiếu hàng hoàn → receiving/returns/{id}", async () => {
    renderTab(
      ROLES.warehouseStaff,
      apiReceiptPage([
        apiReceipt(),
        apiReceipt({ id: RETURN_ID, number: "GR-RT-0001", receiptType: "RETURN" }),
      ]),
    );
    expect(await screen.findByRole("link", { name: "GR-20261009-0001" })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.warehouseMap.page("HCM", WORKSPACE_PATHS.receivingReceipt(RECEIPT_ID)),
    );
    expect(screen.getByRole("link", { name: "GR-RT-0001" })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.warehouseMap.page("HCM", WORKSPACE_PATHS.receivingReturn(RETURN_ID)),
    );
  });

  it("chuyển tab Tất cả → bỏ lọc trạng thái, vẫn giữ kho", async () => {
    const user = userEvent.setup();
    const { get } = renderTab(ROLES.warehouseStaff);
    await screen.findByRole("link", { name: "GR-20261009-0001" });
    await user.click(screen.getByRole("tab", { name: L.tabs.all }));
    await waitFor(() =>
      expect(listCalls(get).at(-1)).toMatchObject({ warehouseId: HCM_ID, status: undefined }),
    );
  });

  it("kho chưa có phiếu đang nhận → empty state chỉ chỗ lập phiếu", async () => {
    renderTab(ROLES.warehouseStaff, apiReceiptPage([]));
    expect(await screen.findByText(L.emptyDraftTitle)).toBeInTheDocument();
    expect(screen.getByText(L.emptyDescription)).toBeInTheDocument();
  });

  it("chỉ có VIEW_PAGE (thiếu READ) → không gọi API danh sách", async () => {
    const { get } = renderTab(ROLES.viewOnly);
    await waitFor(() =>
      expect(get.mock.calls.some(([url]) => url === "/identity/me/permissions")).toBe(true),
    );
    expect(listCalls(get)).toHaveLength(0);
  });
});
