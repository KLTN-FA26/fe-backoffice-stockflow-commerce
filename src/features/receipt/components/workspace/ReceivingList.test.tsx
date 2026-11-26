import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  RECEIPT_COUNT_LABELS,
  RECEIVING_LABELS,
  STORAGE_KEYS,
  WORKSPACE_PATHS,
} from "@/constants";
import { WorkspaceWarehouseProvider } from "@/lib/workspace";

import { HCM_ID, RECEIPT_ID, apiReceipt, apiReceiptPage } from "../../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  mockReceiptApi,
  renderReceiptScreen,
} from "../../__fixtures__/render";
import { COLUMN_LABELS } from "../list/constants";
import { ReceivingList } from "./ReceivingList";

import type { UrlUpdateEvent } from "nuqs/adapters/testing";
import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const L = RECEIVING_LABELS;
const HCM = { id: HCM_ID, prefix: "HCM", name: "Kho Hồ Chí Minh" };
const RETURN_ID = "7d1c2b3a-0000-4000-8000-000000000099";
const NUMBER = "GR-20261009-0001";
const DELIVERY_NOTE = COLUMN_LABELS.deliveryNote ?? "";

function renderTab(
  permissions: readonly PermissionCode[],
  page: unknown = apiReceiptPage(),
  searchParams = "",
) {
  const spies = mockReceiptApi(permissions, { "/goods-receipts": () => page });
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  renderReceiptScreen(
    // Adapter trong cùng ghi đè adapter của helper — để đọc được URL mà màn ghi ra
    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
      <WorkspaceWarehouseProvider value={HCM}>
        <ReceivingList />
      </WorkspaceWarehouseProvider>
    </NuqsTestingAdapter>,
  );
  return { ...spies, onUrlUpdate };
}

const listCalls = (get: ReturnType<typeof renderTab>["get"]) =>
  get.mock.calls
    .filter(([url]) => url === "/goods-receipts")
    .map(([, config]) => (config as { params?: Record<string, unknown> } | undefined)?.params);

const lastUrl = (onUrlUpdate: ReturnType<typeof renderTab>["onUrlUpdate"]) =>
  onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;

describe("ReceivingList — Nhận hàng trong tab theo kho (docs 03)", () => {
  it("mặc định Đang nhận: gửi warehouseId của kho trên URL + status DRAFT, không có ô chọn kho", async () => {
    const { get } = renderTab(ROLES.warehouseStaff);
    await screen.findByRole("link", { name: NUMBER });
    expect(listCalls(get)[0]).toMatchObject({ warehouseId: HCM_ID, status: ["DRAFT"] });
    expect(screen.queryByRole("combobox", { name: /kho/i })).not.toBeInTheDocument();
    expect(screen.getByText(`${L.summaryStatus}: ${L.tabs.draft}`)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("link chi tiết ở lại trong tab: phiếu Đơn sản xuất → receiving/{id}, phiếu hàng hoàn → receiving/returns/{id}", async () => {
    renderTab(
      ROLES.warehouseStaff,
      apiReceiptPage([
        apiReceipt(),
        apiReceipt({ id: RETURN_ID, number: "GR-RT-0001", receiptType: "RETURN" }),
      ]),
    );
    expect(await screen.findByRole("link", { name: NUMBER })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.warehouseMap.page("HCM", WORKSPACE_PATHS.receivingReceipt(RECEIPT_ID)),
    );
    expect(screen.getByRole("link", { name: "GR-RT-0001" })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.warehouseMap.page("HCM", WORKSPACE_PATHS.receivingReturn(RETURN_ID)),
    );
  });

  it("lọc trạng thái chọn Tất cả → ?tab=all, bỏ status gửi BE, vẫn giữ kho; X chip → về Đang nhận", async () => {
    const user = userEvent.setup();
    const { get, onUrlUpdate } = renderTab(ROLES.warehouseStaff);
    await screen.findByRole("link", { name: NUMBER });
    await user.click(screen.getByRole("button", { name: "Lọc trạng thái" }));
    await user.click(screen.getByRole("option", { name: L.tabs.all }));
    await waitFor(() =>
      expect(listCalls(get).at(-1)).toMatchObject({ warehouseId: HCM_ID, status: undefined }),
    );
    expect(lastUrl(onUrlUpdate)?.get("tab")).toBe("all");
    expect(screen.getByText(`${L.summaryStatus}: ${L.tabs.all}`)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: `Xoá ${L.summaryStatus}` }));
    // Đang nhận đã có trong cache React Query → không gọi lại; kiểm qua chip + URL
    expect(await screen.findByText(`${L.summaryStatus}: ${L.tabs.draft}`)).toBeInTheDocument();
    expect(lastUrl(onUrlUpdate)?.has("tab")).toBe(false);
  });

  it("link cũ ?tab=all vẫn mở Tất cả: không gửi status", async () => {
    const { get } = renderTab(ROLES.warehouseStaff, apiReceiptPage(), "?tab=all");
    await screen.findByRole("link", { name: NUMBER });
    expect(listCalls(get)[0]).toMatchObject({ warehouseId: HCM_ID, status: undefined });
    expect(screen.getByText(`${L.summaryStatus}: ${L.tabs.all}`)).toBeInTheDocument();
  });

  it("Đang nhận rỗng → kho chưa có phiếu đang nhận, không phải 'không tìm thấy'", async () => {
    renderTab(ROLES.warehouseStaff, apiReceiptPage([]));
    expect(await screen.findByText(L.emptyDraftTitle)).toBeInTheDocument();
    expect(screen.getByText(L.emptyDescription)).toBeInTheDocument();
    expect(screen.queryByText("Không tìm thấy kết quả")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bỏ bộ lọc" })).not.toBeInTheDocument();
  });

  it("Tất cả rỗng → kho chưa có phiếu nhận, không phải 'không tìm thấy'", async () => {
    renderTab(ROLES.warehouseStaff, apiReceiptPage([]), "?tab=all");
    expect(await screen.findByText(L.emptyAllTitle)).toBeInTheDocument();
    expect(screen.getByText(L.emptyDescription)).toBeInTheDocument();
    expect(screen.queryByText("Không tìm thấy kết quả")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bỏ bộ lọc" })).not.toBeInTheDocument();
  });

  it("ẩn hiện cột: tắt Phiếu giao → mất cột, chip 5/6; Số phiếu khoá; X trả lại", async () => {
    const user = userEvent.setup();
    renderTab(ROLES.warehouseStaff);
    await screen.findByRole("link", { name: NUMBER });
    const header = () => screen.queryByRole("columnheader", { name: DELIVERY_NOTE });
    expect(header()).toBeInTheDocument();
    expect(screen.getByText("Cột hiển thị: 6/6")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ẩn hiện cột" }));
    const numberOption = screen.getByRole("option", { name: COLUMN_LABELS.number });
    expect(numberOption).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("option", { name: DELIVERY_NOTE }));
    expect(header()).not.toBeInTheDocument();
    expect(screen.getByText("Cột hiển thị: 5/6")).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEYS.adminReceivingColumns) ?? "{}"),
    ).toMatchObject({ visibleColumns: expect.not.arrayContaining(["deliveryNote"]) });

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Xoá Cột hiển thị" }));
    expect(header()).toBeInTheDocument();
  });

  it("cột đã lưu có key lạ / thiếu cột khoá → bỏ key lạ, giữ Số phiếu", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.adminReceivingColumns,
      JSON.stringify({ visibleColumns: ["status", "bogus"] }),
    );
    renderTab(ROLES.warehouseStaff);
    await screen.findByRole("link", { name: NUMBER });
    await waitFor(() =>
      expect(
        within(screen.getByRole("table"))
          .getAllByRole("columnheader")
          .map((cell) => cell.textContent?.trim())
          .filter(Boolean),
      ).toEqual([COLUMN_LABELS.number, COLUMN_LABELS.status]),
    );
  });

  it("chỉ có VIEW_PAGE (thiếu READ) → không gọi API danh sách, không có toolbar", async () => {
    const { get } = renderTab(ROLES.viewOnly);
    await waitFor(() =>
      expect(get.mock.calls.some(([url]) => url === "/identity/me/permissions")).toBe(true),
    );
    expect(listCalls(get)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Lọc trạng thái" })).not.toBeInTheDocument();
  });
});

describe("ReceivingList — Lập phiếu nhập ngay tại màn nhận hàng của kho (S12-2)", () => {
  it("quản lý kho có nút 'Lập phiếu nhập' trên thanh công cụ; nhân viên chỉ đọc thì không", async () => {
    renderTab(ROLES.warehouseManager);
    expect(
      await screen.findByRole("button", { name: RECEIPT_COUNT_LABELS.create.button }),
    ).toBeInTheDocument();
  });

  it("kho chưa có phiếu: trạng thái trống có nút 'Lập phiếu nhập', toolbar vẫn còn nút của nó", async () => {
    renderTab(ROLES.warehouseManager, apiReceiptPage([]));
    expect(await screen.findByText(L.emptyDraftTitle)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: RECEIPT_COUNT_LABELS.create.button }),
    ).toHaveLength(2);
  });

  it("không có goods-receipts:CREATE → không nút nào", async () => {
    renderTab(ROLES.reader);
    await screen.findByText(NUMBER);
    expect(screen.queryByRole("button", { name: RECEIPT_COUNT_LABELS.create.button })).toBeNull();
  });
});
