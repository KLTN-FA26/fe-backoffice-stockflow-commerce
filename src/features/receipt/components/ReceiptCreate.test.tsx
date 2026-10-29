import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  HCM_ID,
  PO_ID,
  SOFA_PO_LINE_ID,
  SUPPLIER_ID,
  apiBlindReceipt,
  apiLine,
  apiReceipt,
  receivablePo,
} from "../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  bePage,
  mockReceiptApi,
  renderReceiptScreen,
} from "../__fixtures__/render";
import { ReceiptCreate } from "./ReceiptCreate";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

function renderCreate(
  permissions: Parameters<typeof mockReceiptApi>[0],
  po = receivablePo,
  existing: ReturnType<typeof apiReceipt>[] = [],
) {
  const spies = mockReceiptApi(
    permissions,
    {
      "/purchase-orders": () => bePage([po]),
      [`/purchase-orders/${PO_ID}`]: () => po,
      "/goods-receipts": () => bePage(existing.map(({ lines: _l, ...row }) => row)),
    },
    { "/goods-receipts": () => apiReceipt() },
  );
  renderReceiptScreen(<ReceiptCreate />, `?poId=${PO_ID}`);
  return spies;
}

describe("ReceiptCreate — tạo phiếu nhận từ PO (BR-01)", () => {
  it("PO từ link được chọn sẵn, hiện dòng còn mở; tạo phiếu → POST rồi sang chi tiết", async () => {
    const user = userEvent.setup();
    const { post, get } = renderCreate(ROLES.warehouseManager);
    expect((await screen.findAllByText("SOFA-3S-GREY")).length).toBeGreaterThan(0);
    // Chỉ hỏi PO đã chốt / đang nhận dở
    const list = get.mock.calls.find(([url]) => url === "/purchase-orders");
    expect(list?.[1]?.params).toMatchObject({ status: ["CONFIRMED", "PARTIALLY_RECEIVED"] });
    await user.type(screen.getByLabelText("Số phiếu giao"), "DN-001");
    await user.click(screen.getByRole("button", { name: "Tạo phiếu nhận" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/goods-receipts", {
        purchaseOrderId: PO_ID,
        deliveryNote: "DN-001",
        note: undefined,
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/receipts/${apiReceipt().id}`));
  });

  it("PO từ link không đọc được (404) → báo lỗi và khoá nút tạo", async () => {
    mockReceiptApi(ROLES.warehouseManager, {
      "/purchase-orders": () => bePage([receivablePo]),
      [`/purchase-orders/${PO_ID}`]: () => {
        throw new ApiError(404, "PURCHASE_ORDER_NOT_FOUND", `No purchase order ${PO_ID}`);
      },
      "/goods-receipts": () => bePage([]),
    });
    renderReceiptScreen(<ReceiptCreate />, `?poId=${PO_ID}`);
    expect(await screen.findByText("Không tải được dòng của đơn đặt hàng.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo phiếu nhận" })).toBeDisabled();
  });

  it("PO không còn nhận được (đã đóng) → báo và khoá nút tạo", async () => {
    renderCreate(ROLES.warehouseManager, { ...receivablePo, status: "CLOSED" });
    expect(await screen.findByText(/không tạo phiếu nhận được/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo phiếu nhận" })).toBeDisabled();
  });

  it("NV kho theo seed BE (thiếu purchase-orders:READ) → báo cần quyền, không gọi API PO", async () => {
    const { get } = renderCreate(ROLES.warehouseStaff);
    expect(await screen.findByText("Cần quyền xem đơn đặt hàng")).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).startsWith("/purchase-orders"))).toBe(false);
  });

  it("NV QC (không có CREATE) → chặn route", async () => {
    renderCreate(ROLES.qcStaff);
    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
  });

  it("PO đã có phiếu nháp → cảnh báo kèm link phiếu đó, vẫn cho tạo", async () => {
    const draft = apiReceipt({
      lines: [apiLine({ purchaseOrderLineId: SOFA_PO_LINE_ID, quantity: 4 })],
    });
    renderCreate(ROLES.warehouseManager, receivablePo, [draft]);
    expect(await screen.findByRole("link", { name: draft.number })).toHaveAttribute(
      "href",
      `/admin/receipts/${draft.id}`,
    );
    expect(screen.getByText(/đã có phiếu nhận nháp/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo phiếu nhận" })).toBeEnabled();
  });
});

/* ── BR-RCP-002 (SCRUM-478): hàng về không có PO ───────────────────────────────────────────── */

describe("ReceiptCreate — hàng về không có PO (BR-RCP-002)", () => {
  function renderWithoutPo(permissions: Parameters<typeof mockReceiptApi>[0]) {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
    const spies = mockReceiptApi(
      permissions,
      {
        "/suppliers": () =>
          bePage([{ supplierId: SUPPLIER_ID, code: "GOVIET", name: "Xưởng gỗ Việt" }]),
        "/warehouses": () => bePage([{ id: HCM_ID, prefix: "HCM", name: "Kho Hồ Chí Minh" }]),
        "/purchase-orders": () => bePage([receivablePo]),
        "/goods-receipts": () => bePage([]),
      },
      { "/goods-receipts/without-po": () => apiBlindReceipt() },
    );
    renderReceiptScreen(<ReceiptCreate />, "?mode=without-po");
    return spies;
  }

  async function pick(user: ReturnType<typeof userEvent.setup>, trigger: RegExp, option: string) {
    await user.click(await screen.findByRole("combobox", { name: trigger }));
    await user.click(await screen.findByRole("option", { name: new RegExp(option) }));
  }

  it("có hai chế độ; chế độ không có PO: NCC + kho + lý do bắt buộc, thiếu thì lỗi inline và không gọi API", async () => {
    const user = userEvent.setup();
    const { post } = renderWithoutPo(ROLES.warehouseManager);
    expect(await screen.findByRole("tab", { name: "Theo đơn đặt hàng" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tab", { name: "Không có đơn đặt hàng" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(await screen.findByRole("button", { name: "Tạo phiếu nhận" }));
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(3));
    const alerts = screen.getAllByRole("alert").map((element) => element.textContent);
    expect(alerts).toEqual(
      expect.arrayContaining(["Chọn nhà cung cấp", "Chọn kho nhận", "Nhập lý do không có PO"]),
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("điền NCC, kho, lý do → POST /goods-receipts/without-po rồi sang chi tiết", async () => {
    const user = userEvent.setup();
    const { post } = renderWithoutPo(ROLES.warehouseManager);
    await pick(user, /Nhà cung cấp/, "Xưởng gỗ Việt");
    await pick(user, /Kho nhận/, "Kho Hồ Chí Minh");
    await user.type(screen.getByLabelText(/Lý do không có PO/), "  NCC tặng kèm hàng mẫu ");
    await user.type(screen.getByLabelText("Số phiếu giao"), "DN-9");
    await user.click(screen.getByRole("button", { name: "Tạo phiếu nhận" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/goods-receipts/without-po", {
        supplierId: SUPPLIER_ID,
        warehouseId: HCM_ID,
        reason: "NCC tặng kèm hàng mẫu",
        deliveryNote: "DN-9",
        note: undefined,
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/receipts/${apiReceipt().id}`));
  });

  it("BE từ chối (NCC không tồn tại) → câu tiếng Việt, ở lại form", async () => {
    const user = userEvent.setup();
    const { post } = renderWithoutPo(ROLES.warehouseManager);
    post.mockImplementationOnce(async () => {
      throw new ApiError(404, "SUPPLIER_NOT_FOUND", "No supplier x");
    });
    await pick(user, /Nhà cung cấp/, "Xưởng gỗ Việt");
    await pick(user, /Kho nhận/, "Kho Hồ Chí Minh");
    await user.type(screen.getByLabelText(/Lý do không có PO/), "quà kèm");
    await user.click(screen.getByRole("button", { name: "Tạo phiếu nhận" }));
    expect(await screen.findByText("Không tìm thấy nhà cung cấp")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("NV kho theo seed BE (thiếu xem NCC / kho): không có tab, báo cần quyền, không gọi API NCC / kho", async () => {
    const { get } = renderWithoutPo(ROLES.warehouseStaff);
    expect(await screen.findByText("Cần quyền xem nhà cung cấp và kho")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === "/suppliers" || url === "/warehouses")).toBe(
      false,
    );
  });
});
