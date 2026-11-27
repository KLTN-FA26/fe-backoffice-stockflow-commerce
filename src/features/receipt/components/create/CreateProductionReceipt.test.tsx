import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, RECEIPT_COUNT_LABELS, RECEIPT_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { HCM_ID, RECEIPT_ID, apiReceipt, apiReceiptPage } from "../../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  bePage,
  mockReceiptApi,
  renderReceiptScreen,
} from "../../__fixtures__/render";
import { ReceiptList } from "../ReceiptList";

import type { PermissionCode } from "@/lib/auth";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

const L = RECEIPT_COUNT_LABELS.create;

function productionOrder(id: string, code: string, status: string, sampleApprovalRequired = false) {
  return {
    id,
    code,
    status,
    receivingWarehouseId: HCM_ID,
    sampleApprovalRequired,
    needByDate: "2026-11-30",
    lines: [
      {
        id: `${id}-L1`,
        sku: "CUP-PRINT-ACME-12OZ",
        cartons: 10,
        unitsPerCarton: 50,
        receivedCartons: 4,
      },
    ],
  };
}

/** BE lọc một `status` mỗi lần — mock trả đơn theo đúng status được hỏi. */
const ORDERS_BY_STATUS: Record<string, unknown[]> = {
  IN_PRODUCTION: [productionOrder("po-1", "PRD-20261101-0001", "IN_PRODUCTION")],
  PARTIALLY_RECEIVED: [],
  // BR-15: đơn bật cờ duyệt mẫu in còn SENT → không nhận được, không hiện trong ô chọn
  SENT: [productionOrder("po-2", "PRD-20261101-0002", "SENT", true)],
  ACCEPTED: [productionOrder("po-3", "PRD-20261101-0003", "ACCEPTED")],
};

function renderList(permissions: readonly PermissionCode[], onCreate?: (body: unknown) => unknown) {
  const spies = mockReceiptApi(
    permissions,
    {
      "/goods-receipts": () => apiReceiptPage(),
      "/production-orders": (params) => {
        const status = (params as { status: string }).status;
        return bePage(ORDERS_BY_STATUS[status] ?? []);
      },
    },
    { "/goods-receipts/production": (_p, body) => (onCreate ? onCreate(body) : apiReceipt()) },
  );
  renderReceiptScreen(<ReceiptList />);
  return spies;
}

describe("Lập phiếu nhập theo Đơn sản xuất (docs 03 §4.1 bước 1)", () => {
  it("chọn Đơn sản xuất nhận được hàng → POST đúng body, sang trang chi tiết để kiểm đếm", async () => {
    const user = userEvent.setup();
    const { post, get } = renderList(ROLES.warehouseManager);

    await user.click(await screen.findByRole("button", { name: L.button }));
    await user.click(await screen.findByRole("combobox", { name: L.productionOrder }));
    expect(await screen.findByRole("option", { name: /PRD-20261101-0001/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /PRD-20261101-0003/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /PRD-20261101-0002/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /PRD-20261101-0001/ }));
    await user.type(screen.getByLabelText(L.deliveryNote), "PG-7781");
    await user.click(screen.getByRole("button", { name: L.submit }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(ADMIN_ROUTES.receipts.detail(RECEIPT_ID)),
    );
    expect(post).toHaveBeenCalledWith("/goods-receipts/production", {
      productionOrderId: "po-1",
      deliveryNote: "PG-7781",
      note: undefined,
    });
    const statuses = get.mock.calls
      .filter(([url]) => url === "/production-orders")
      .map(([, config]) => (config as { params: { status: string } }).params.status);
    expect(new Set(statuses)).toEqual(
      new Set(["IN_PRODUCTION", "PARTIALLY_RECEIVED", "SENT", "ACCEPTED"]),
    );
  });

  it("chưa chọn Đơn sản xuất → báo lỗi ở ô, không gọi BE", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ROLES.warehouseManager);
    await user.click(await screen.findByRole("button", { name: L.button }));
    await user.click(screen.getByRole("button", { name: L.submit }));
    expect(await screen.findByText("Chọn đơn sản xuất")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("BE từ chối (Đơn sản xuất vừa hết nhận được) → câu tiếng Việt trong dialog, không điều hướng", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ROLES.warehouseManager, () => {
      throw new ApiError(409, "PRODUCTION_ORDER_NOT_RECEIVABLE", "Production order is RECEIVED");
    });
    const listCalls = () => get.mock.calls.filter(([url]) => url === "/production-orders").length;
    await user.click(await screen.findByRole("button", { name: L.button }));
    await user.click(await screen.findByRole("combobox", { name: L.productionOrder }));
    await user.click(await screen.findByRole("option", { name: /PRD-20261101-0001/ }));
    const before = listCalls();
    await user.click(screen.getByRole("button", { name: L.submit }));
    expect(
      await screen.findByText(RECEIPT_ERROR_MESSAGES.PRODUCTION_ORDER_NOT_RECEIVABLE),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    // Câu báo "Dữ liệu đã được tải lại" phải đúng: ô chọn Đơn sản xuất tải lại danh sách
    await waitFor(() => expect(listCalls()).toBeGreaterThan(before));
  });

  it("NV kho thiếu production-orders:READ → nút khoá kèm lý do", async () => {
    renderList(ROLES.warehouseStaff);
    const button = await screen.findByRole("button", { name: L.button });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(RECEIPT_COUNT_LABELS.noProductionRead);
  });

  it("chỉ đọc phiếu (không có goods-receipts:CREATE) → không có nút lập phiếu", async () => {
    renderList(ROLES.reader);
    await screen.findByRole("link", { name: "GR-20261009-0001" });
    expect(screen.queryByRole("button", { name: L.button })).not.toBeInTheDocument();
  });
});

/** Đơn tuỳ biến cho các ca chọn sẵn / dòng hai tầng (S12-1). */
function receivable(id: string, code: string, extra: Record<string, unknown> = {}, received = 4) {
  return {
    ...productionOrder(id, code, "IN_PRODUCTION"),
    producerName: "Xưởng In Ly Giấy Long Xuyên",
    expectedCompletionDate: "2026-12-05",
    lines: [
      {
        id: `${id}-L1`,
        sku: "LYG12-DA1-0318800259-01",
        cartons: 10,
        unitsPerCarton: 1000,
        receivedCartons: received,
      },
    ],
    ...extra,
  };
}

function renderWith(
  orders: unknown[],
  options: { search?: string; failList?: boolean; onCreate?: (body: unknown) => unknown } = {},
) {
  const spies = mockReceiptApi(
    ROLES.warehouseManager,
    {
      "/goods-receipts": () => apiReceiptPage(),
      "/production-orders": (params) => {
        if (options.failList) throw new ApiError(500, "INTERNAL", "x");
        return bePage((params as { status: string }).status === "IN_PRODUCTION" ? orders : []);
      },
    },
    {
      "/goods-receipts/production": (_p, body) =>
        options.onCreate ? options.onCreate(body) : apiReceipt(),
    },
  );
  renderReceiptScreen(<ReceiptList />, options.search ?? "");
  return spies;
}

describe("Lập phiếu nhập — chọn Đơn sản xuất dễ hơn (S12-1)", () => {
  it("chỉ có một Đơn sản xuất nhận được hàng → chọn sẵn, lập luôn không phải chọn lại", async () => {
    const user = userEvent.setup();
    const { post } = renderWith([receivable("po-1", "PRD-20261126-0001")]);
    await user.click(await screen.findByRole("button", { name: L.button }));
    const box = await screen.findByRole("combobox", { name: L.productionOrder });
    await waitFor(() => expect(box).toHaveValue("PRD-20261126-0001"));
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/goods-receipts/production",
        expect.objectContaining({ productionOrderId: "po-1" }),
      ),
    );
  });

  it("nhiều đơn → không chọn sẵn; mỗi dòng hai tầng: mã / đơn vị SX · SKU · thùng còn · ngày giao dự kiến", async () => {
    const user = userEvent.setup();
    renderWith([receivable("po-1", "PRD-A"), receivable("po-2", "PRD-B")]);
    await user.click(await screen.findByRole("button", { name: L.button }));
    const box = await screen.findByRole("combobox", { name: L.productionOrder });
    expect(box).toHaveValue("");
    await user.click(box);
    const option = await screen.findByRole("option", { name: /PRD-A/ });
    expect(option).toHaveTextContent("Xưởng In Ly Giấy Long Xuyên");
    expect(option).toHaveTextContent("LYG12-DA1-0318800259-01");
    expect(option).toHaveTextContent("còn 6/10 thùng");
    expect(option).toHaveTextContent(/giao dự kiến/);
  });

  it("đơn đã nhập đủ thùng thì không còn trong danh sách", async () => {
    const user = userEvent.setup();
    renderWith([
      receivable("po-1", "PRD-FULL", {}, 10),
      receivable("po-2", "PRD-OPEN"),
      receivable("po-3", "PRD-OPEN2"),
    ]);
    await user.click(await screen.findByRole("button", { name: L.button }));
    await user.click(await screen.findByRole("combobox", { name: L.productionOrder }));
    expect(await screen.findByRole("option", { name: /PRD-OPEN\b/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /PRD-FULL/ })).toBeNull();
  });

  it("lỗi tải nằm riêng trên danh sách, có nút Thử lại — không phải một dòng đơn để chọn", async () => {
    const user = userEvent.setup();
    renderWith([], { failList: true });
    await user.click(await screen.findByRole("button", { name: L.button }));
    await user.click(await screen.findByRole("combobox", { name: L.productionOrder }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(L.loadError);
    expect(within(alert).getByRole("button", { name: L.retry })).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("mở từ Đơn sản xuất (?createFor=) → hộp Lập phiếu mở sẵn, đơn đó đã được chọn", async () => {
    renderWith([receivable("po-1", "PRD-A"), receivable("po-2", "PRD-B")], {
      search: "?createFor=po-2",
    });
    const box = await screen.findByRole("combobox", { name: L.productionOrder });
    await waitFor(() => expect(box).toHaveValue("PRD-B"));
  });

  it("danh sách phiếu: ô chọn Đơn sản xuất (cùng ô với hộp Lập phiếu) lọc phiếu theo đơn đó (S12-8)", async () => {
    const user = userEvent.setup();
    const { get } = renderWith([receivable("po-1", "PRD-A"), receivable("po-2", "PRD-B")]);
    const box = await screen.findByRole("combobox", { name: L.productionOrder });
    // Không tự focus — chỉ hộp Lập phiếu mới tự focus
    expect(box).not.toHaveFocus();
    await user.click(box);
    await user.click(await screen.findByRole("option", { name: /PRD-B/ }));
    await waitFor(() => {
      const last = get.mock.calls.filter(([url]) => url === "/goods-receipts").at(-1)?.[1] as
        { params?: Record<string, unknown> } | undefined;
      expect(last?.params).toMatchObject({ productionOrderId: "po-2" });
    });
    expect(await screen.findByRole("button", { name: "Bỏ lọc Đơn sản xuất" })).toBeInTheDocument();
  });
});
