import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  PO_ERROR_MESSAGES,
  SUPPLIER_ITEM_PERMISSIONS,
  TOAST_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { supplierItemKeys } from "@/lib/references/supplier-items";
import { warehouseOptionKeys } from "@/lib/references/warehouse-options";
import { poKeys } from "@/features/purchase-order";
import { toast } from "@/components/shared/Toast";

import { next, patchJsdomForCmdk, pickSku } from "../__fixtures__/create";
import { PO_ID, goToReview, poPath, renderEdit, saveFromReview } from "../__fixtures__/edit";
import { CATALOG, WAREHOUSE_REF } from "../__fixtures__/create";
import {
  PO_PERMISSION_SETS,
  bePage,
  bePo,
  bePoLine,
  pickSelectOption,
} from "../__fixtures__/render";

import type { PermissionCode } from "@/lib/auth";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeAll(patchJsdomForCmdk);

// Test đi qua wizard nhiều bước + cmdk bằng userEvent: 2–7s khi chạy riêng, vượt 5s mặc định
// khi cả bộ chạy song song → timeout 20s truyền vào từng `it` của nhánh này (không đổi config).

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

const OLD_LINE = {
  lineId: "33333333-3333-4333-8333-333333333333",
  sku: "SOFA-3S-GREY",
  description: "Sofa 3 chỗ",
  quantityOrdered: 10,
  unitPrice: 100000,
  taxRate: 0,
};

describe("PurchaseOrderEdit — sửa PO nháp (#30, BE SCRUM-462)", () => {
  it("thiếu UPDATE → chặn route, không tải PO", async () => {
    const { get } = renderEdit({ permissions: PO_PERMISSION_SETS.readOnly });
    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith(poPath, expect.anything());
  });

  it("màn sửa: NCC và tiền tệ chỉ đọc, SKU dòng cũ bị khoá", async () => {
    const user = userEvent.setup();
    renderEdit();
    const supplier = await screen.findByLabelText("Nhà cung cấp");
    // BR-07 (docs 02 §6): BE không cho đổi NCC / tiền tệ của PO đã tạo.
    expect(supplier).toHaveAttribute("readonly");
    expect(supplier).toHaveValue("GOHOAPHAT — Gỗ Hòa Phát");
    expect(screen.getByLabelText(/Tiền tệ của PO/)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/Tiền tệ của PO/)).toHaveValue("VND");
    expect(screen.queryByRole("combobox", { name: "Nhà cung cấp" })).not.toBeInTheDocument();
    await next(user);
    expect(await screen.findByRole("combobox", { name: "SKU dòng 1" })).toBeDisabled();
    expect(screen.getByText(/Dòng đã lưu giữ nguyên SKU/)).toBeInTheDocument();
  }, 20_000);

  it("danh mục > 200 dòng, SKU dòng cũ ngoài trang đầu → lấy điều khoản theo SKU, lưu được", async () => {
    const user = userEvent.setup();
    const others = CATALOG.filter((item) => item.sku !== OLD_LINE.sku);
    const [sofa] = CATALOG.filter((item) => item.sku === OLD_LINE.sku);
    const { get, put } = renderEdit({
      getCatalog: () => ({ ...bePage(others), totalElements: 201, totalPages: 2, hasNext: true }),
      extraRoutes: {
        [`/procurement/skus/${OLD_LINE.sku}/suppliers`]: () => [
          {
            ...sofa,
            supplierCode: "GOHOAPHAT",
            supplierName: "Gỗ Hòa Phát",
            supplierStatus: "ACTIVE",
          },
        ],
      },
    });
    await goToReview(user);
    expect(screen.queryByText(/không có trong danh mục/)).not.toBeInTheDocument();
    await saveFromReview(user);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(get).toHaveBeenCalledWith(
      `/procurement/skus/${OLD_LINE.sku}/suppliers`,
      expect.anything(),
    );
  }, 20_000);

  it("lưu không đổi gì → PUT có version và unitPrice của mọi dòng cũ", async () => {
    const user = userEvent.setup();
    const { put } = renderEdit({ getPo: () => bePo({ version: 3 }) });
    await goToReview(user);
    await saveFromReview(user);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith(poPath, {
      version: 3,
      warehouseId: "d99123fd-2997-4751-6bb9-e10a2e6d9949",
      expectedAt: "2099-01-01",
      lines: [OLD_LINE],
    });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(ADMIN_ROUTES.purchaseOrders.detail(PO_ID)),
    );
  }, 20_000);

  it("thêm dòng mới để trống giá → dòng đó không có unitPrice", async () => {
    const user = userEvent.setup();
    const { put } = renderEdit();
    await screen.findByLabelText("Nhà cung cấp");
    await next(user);
    await user.click(screen.getByRole("button", { name: /Thêm dòng hàng/ }));
    await pickSku(user, /TABLE-OAK-120/, 2);
    const qty = screen.getByLabelText(/SL đặt/, { selector: "#po-line-1-qty" });
    await user.clear(qty);
    await user.type(qty, "10");
    await user.clear(screen.getByLabelText(/Đơn giá/, { selector: "#po-line-1-price" }));
    await next(user);
    await next(user);
    await saveFromReview(user);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    // JSON như axios gửi đi: khoá `undefined` không lên đường truyền.
    const body = JSON.parse(JSON.stringify(put.mock.calls[0]?.[1])) as {
      lines: Record<string, unknown>[];
    };
    expect(body.lines[0]).toEqual(OLD_LINE);
    expect(body.lines[1]).toMatchObject({ sku: "TABLE-OAK-120", quantityOrdered: 10 });
    expect(body.lines[1]).not.toHaveProperty("unitPrice");
    expect(body.lines[1]).not.toHaveProperty("lineId");
  }, 20_000);

  it("409 OPTIMISTIC_LOCK → câu tiếng Việt, form giữ dữ liệu, PO được tải lại", async () => {
    const user = userEvent.setup();
    const toastError = vi.spyOn(toast, "error");
    let loads = 0;
    let puts = 0;
    const { get, put } = renderEdit({
      getPo: () => bePo({ version: loads++ === 0 ? 0 : 1 }),
      onPut: () => {
        if (puts++ === 0) throw new ApiError(409, "OPTIMISTIC_LOCK", "Stale version");
        return bePo({ version: 2 });
      },
    });
    const note = await screen.findByLabelText("Ghi chú");
    await user.type(note, "Giao buổi sáng");
    await goToReview(user);
    await saveFromReview(user);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[1]).toMatch(/vừa được người khác sửa/);
    await waitFor(() =>
      expect(get.mock.calls.filter(([url]) => url === poPath).length).toBeGreaterThan(1),
    );
    expect(push).not.toHaveBeenCalled();
    // Form vẫn ở bước Rà soát với dữ liệu đã nhập — lưu lại dùng version mới.
    await saveFromReview(user);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls[1]?.[1]).toMatchObject({ version: 1, note: "Giao buổi sáng" });
  }, 20_000);

  it("409 OPTIMISTIC_LOCK, người khác đã xoá dòng → lưu lại gửi dòng đó như dòng mới (không lineId cũ)", async () => {
    const user = userEvent.setup();
    let loads = 0;
    let puts = 0;
    const { put } = renderEdit({
      // Bản tải lại: dòng SOFA cũ đã bị xoá và thêm lại thành dòng khác (lineId mới)
      getPo: () =>
        loads++ === 0
          ? bePo({ version: 0 })
          : bePo({
              version: 1,
              lines: [bePoLine({ lineId: "55555555-5555-4555-8555-555555555555" })],
            }),
      onPut: () => {
        if (puts++ === 0) throw new ApiError(409, "OPTIMISTIC_LOCK", "Stale version");
        return bePo({ version: 2 });
      },
    });
    await goToReview(user);
    await saveFromReview(user);
    await waitFor(() => expect(loads).toBeGreaterThan(1));
    await saveFromReview(user);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    const [line] = (put.mock.calls[1]?.[1] as { lines: Record<string, unknown>[] }).lines;
    expect(line).not.toHaveProperty("lineId");
    expect(line).toMatchObject({ sku: OLD_LINE.sku, unitPrice: OLD_LINE.unitPrice });
  }, 20_000);

  it("BE báo trùng đơn sau khi lưu (BR-PO-003) → cảnh báo, chi tiết mở kèm ?duplicate=1", async () => {
    const user = userEvent.setup();
    const toastWarning = vi.spyOn(toast, "warning");
    renderEdit({ onPut: () => bePo({ possibleDuplicate: true }) });
    await goToReview(user);
    await saveFromReview(user);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`${ADMIN_ROUTES.purchaseOrders.detail(PO_ID)}?duplicate=1`),
    );
    expect(toastWarning).toHaveBeenCalled();
  }, 20_000);

  it("409 PURCHASE_ORDER_NOT_EDITABLE → toast rồi về màn chi tiết", async () => {
    const user = userEvent.setup();
    const toastError = vi.spyOn(toast, "error");
    const { client } = renderEdit({
      onPut: () => {
        throw new ApiError(409, "PURCHASE_ORDER_NOT_EDITABLE", "Not editable");
      },
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await goToReview(user);
    await saveFromReview(user);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(ADMIN_ROUTES.purchaseOrders.detail(PO_ID)),
    );
    expect(toastError.mock.calls[0]?.[1]).toBe("Chỉ sửa được PO thường đang ở trạng thái nháp");
    // Chi tiết PO đang cache bản DRAFT (staleTime) → phải đánh dấu cũ TRƯỚC khi chuyển trang,
    // nếu không màn chi tiết lại hiện nút "Sửa nháp" và lặp vòng sửa → bị từ chối.
    const call = invalidate.mock.calls.findIndex(
      ([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(poKeys.detail(PO_ID)),
    );
    expect(call).toBeGreaterThanOrEqual(0);
    expect(invalidate.mock.invocationCallOrder[call]).toBeLessThan(
      push.mock.invocationCallOrder[0] ?? 0,
    );
  }, 20_000);

  it("403 OUT_OF_DATA_SCOPE, tải lại PO cũng 403 (cả đơn ngoài phạm vi) → đánh dấu chi tiết cũ rồi về màn chi tiết", async () => {
    const user = userEvent.setup();
    const toastError = vi.spyOn(toast, "error");
    let poLoads = 0;
    const { client } = renderEdit({
      getPo: () => {
        if (poLoads++ > 0) throw new ApiError(403, "OUT_OF_DATA_SCOPE", "Out of scope");
        return bePo();
      },
      onPut: () => {
        throw new ApiError(403, "OUT_OF_DATA_SCOPE", "Out of scope");
      },
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await goToReview(user);
    await saveFromReview(user);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(ADMIN_ROUTES.purchaseOrders.detail(PO_ID)),
    );
    expect(toastError).toHaveBeenCalled();
    const call = invalidate.mock.calls.findIndex(
      ([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(poKeys.detail(PO_ID)),
    );
    expect(call).toBeGreaterThanOrEqual(0);
    expect(invalidate.mock.invocationCallOrder[call]).toBeLessThan(
      push.mock.invocationCallOrder[0] ?? 0,
    );
    expect(screen.queryByText(PO_ERROR_MESSAGES.warehouseOutOfScope)).not.toBeInTheDocument();
  }, 20_000);

  it("409 OPTIMISTIC_LOCK, tải lại PO bị 403 → về màn chi tiết (không lặp 409 mãi)", async () => {
    const user = userEvent.setup();
    let poLoads = 0;
    renderEdit({
      getPo: () => {
        if (poLoads++ > 0) throw new ApiError(403, "OUT_OF_DATA_SCOPE", "Out of scope");
        return bePo();
      },
      onPut: () => {
        throw new ApiError(409, "OPTIMISTIC_LOCK", "stale");
      },
    });
    await goToReview(user);
    await saveFromReview(user);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(ADMIN_ROUTES.purchaseOrders.detail(PO_ID)),
    );
  }, 20_000);

  it("403 OUT_OF_DATA_SCOPE nhưng tải lại PO được và giữ kho cũ → giữ form, nhắc lưu lại", async () => {
    const user = userEvent.setup();
    const toastError = vi.spyOn(toast, "error");
    renderEdit({
      onPut: () => {
        throw new ApiError(403, "OUT_OF_DATA_SCOPE", "Out of scope");
      },
    });
    await goToReview(user);
    await saveFromReview(user);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        TOAST_MESSAGES.purchaseOrder.actionFailed,
        TOAST_MESSAGES.purchaseOrder.draftRetrySave,
      ),
    );
    expect(push).not.toHaveBeenCalled();
  }, 20_000);

  it("403 khi lưu, tải lại PO ra 404 (đơn đã bị xoá) → toast theo lỗi tải lại, về chi tiết", async () => {
    const user = userEvent.setup();
    const toastError = vi.spyOn(toast, "error");
    let poLoads = 0;
    renderEdit({
      getPo: () => {
        if (poLoads++ > 0) throw new ApiError(404, "PURCHASE_ORDER_NOT_FOUND", "gone");
        return bePo();
      },
      onPut: () => {
        throw new ApiError(403, "OUT_OF_DATA_SCOPE", "Out of scope");
      },
    });
    await goToReview(user);
    await saveFromReview(user);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(ADMIN_ROUTES.purchaseOrders.detail(PO_ID)),
    );
    expect(toastError).toHaveBeenCalledWith(
      TOAST_MESSAGES.purchaseOrder.actionFailed,
      PO_ERROR_MESSAGES.PURCHASE_ORDER_NOT_FOUND,
    );
  }, 20_000);

  it("form đang mở, refetch nền thấy đơn đã gửi duyệt → giữ form + banner, không gỡ dữ liệu", async () => {
    const user = userEvent.setup();
    let poLoads = 0;
    const { client, put } = renderEdit({
      getPo: () => (poLoads++ > 0 ? bePo({ status: "PENDING_APPROVAL" }) : bePo()),
    });
    expect(await screen.findByLabelText("Nhà cung cấp")).toBeInTheDocument();
    await client.refetchQueries({ queryKey: poKeys.detail(PO_ID) });
    await waitFor(() => expect(poLoads).toBeGreaterThan(1));
    expect(await screen.findByText(UI_LABELS.purchaseOrder.draftEdit.statusChanged)).toBeVisible();
    expect(screen.getByLabelText("Nhà cung cấp")).toBeInTheDocument();
    expect(screen.queryByText(/Không sửa được đơn này/)).not.toBeInTheDocument();
    // Không lưu được nữa → khoá lưu, không gửi PUT (BE sẽ báo NOT_EDITABLE và rời màn, mất dữ liệu)
    await goToReview(user);
    const saves = screen.getAllByRole("button", { name: "Lưu thay đổi" });
    expect(saves.at(-1)).toBeDisabled();
    for (const button of saves) await user.click(button);
    expect(put).not.toHaveBeenCalled();
  }, 20_000);

  it("403 OUT_OF_DATA_SCOPE, tải lại PO lỗi 503 (chưa rõ nguyên nhân) → giữ form, không rời màn", async () => {
    const user = userEvent.setup();
    const toastError = vi.spyOn(toast, "error");
    let poLoads = 0;
    renderEdit({
      getPo: () => {
        if (poLoads++ > 0) throw new ApiError(503, "SERVICE_UNAVAILABLE", "down");
        return bePo();
      },
      onPut: () => {
        throw new ApiError(403, "OUT_OF_DATA_SCOPE", "Out of scope");
      },
    });
    await goToReview(user);
    await saveFromReview(user);
    await waitFor(() => expect(poLoads).toBeGreaterThan(1));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: "Lưu thay đổi" }).at(-1)).toBeEnabled();
  }, 20_000);

  it("403 OUT_OF_DATA_SCOPE sau khi đổi kho, PO vẫn tải được → lỗi ở ô Kho nhận, không rời màn", async () => {
    const user = userEvent.setup();
    const other = {
      ...WAREHOUSE_REF,
      id: "e1111111-1111-4111-8111-111111111111",
      prefix: "HN",
      name: "Kho Hà Nội",
    };
    renderEdit({
      extraRoutes: { "/warehouses": () => bePage([WAREHOUSE_REF, other]) },
      onPut: () => {
        throw new ApiError(403, "OUT_OF_DATA_SCOPE", "Out of scope");
      },
    });
    await screen.findByLabelText("Nhà cung cấp");
    await pickSelectOption(user, /Kho nhận hàng/, /HN — Kho Hà Nội/);
    await goToReview(user);
    await saveFromReview(user);
    expect(await screen.findAllByText(PO_ERROR_MESSAGES.warehouseOutOfScope)).not.toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  }, 20_000);

  it("thiếu quyền danh mục: xoá dòng đã lưu → hỏi lại trước; Quay lại thì dòng còn nguyên", async () => {
    const user = userEvent.setup();
    const procurement: readonly PermissionCode[] = PO_PERMISSION_SETS.procurement;
    renderEdit({ permissions: procurement.filter((p) => p !== SUPPLIER_ITEM_PERMISSIONS.read) });
    await screen.findByLabelText("Nhà cung cấp");
    await next(user);
    await user.click(screen.getByRole("button", { name: "Xóa dòng hàng 1" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(UI_LABELS.purchaseOrder.draftEdit.removeSavedLineTitle);
    await user.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(screen.getByRole("button", { name: "Xóa dòng hàng 1" })).toBeInTheDocument();
  }, 20_000);

  it("PO:UPDATE nhưng thiếu quyền đọc danh mục NCC → vẫn mở form, dòng đã lưu không báo lỗi, không thêm được dòng, lưu được", async () => {
    const user = userEvent.setup();
    const procurement: readonly PermissionCode[] = PO_PERMISSION_SETS.procurement;
    const { get, put } = renderEdit({
      permissions: procurement.filter((p) => p !== SUPPLIER_ITEM_PERMISSIONS.read),
    });
    await screen.findByLabelText("Nhà cung cấp");
    await next(user);
    expect(screen.getByText(UI_LABELS.purchaseOrder.draftEdit.noCatalogPermission)).toBeVisible();
    expect(
      screen.getByText(UI_LABELS.purchaseOrder.linesStep.editDescriptionNoCatalog),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Thêm dòng hàng/ })).toBeDisabled();
    await next(user);
    await next(user);
    await saveFromReview(user);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(get.mock.calls.some(([url]) => String(url).includes("/items"))).toBe(false);
  }, 20_000);

  it("danh sách kho đã tải, refetch nền lỗi → vẫn giữ nhãn kho ngừng hoạt động, không báo lỗi tải", async () => {
    let loads = 0;
    const { client } = renderEdit({
      extraRoutes: {
        "/warehouses": () => {
          if (loads++ > 0) throw new ApiError(503, "SERVICE_UNAVAILABLE", "down");
          return bePage([]);
        },
      },
    });
    expect(
      await screen.findByText(UI_LABELS.purchaseOrder.draftEdit.warehouseInactive),
    ).toBeVisible();
    await client.refetchQueries({ queryKey: warehouseOptionKeys.active() });
    await waitFor(() => expect(loads).toBeGreaterThan(1));
    expect(screen.getByText(UI_LABELS.purchaseOrder.draftEdit.warehouseInactive)).toBeVisible();
    expect(
      screen.queryByText(UI_LABELS.purchaseOrder.warehouseField.editLoadFailed),
    ).not.toBeInTheDocument();
  }, 20_000);

  it("refetch nền danh mục / PO thất bại → form vẫn mở, giữ dữ liệu đang nhập", async () => {
    const user = userEvent.setup();
    let catalogLoads = 0;
    let poLoads = 0;
    const failure = () => new ApiError(503, "SERVICE_UNAVAILABLE", "down");
    const { client } = renderEdit({
      getCatalog: () => {
        if (catalogLoads++ > 0) throw failure();
        return bePage(CATALOG);
      },
      getPo: () => {
        if (poLoads++ > 0) throw failure();
        return bePo();
      },
    });
    const note = await screen.findByLabelText("Ghi chú");
    await user.type(note, "Giao buổi sáng");
    await client.refetchQueries({ queryKey: supplierItemKeys.all });
    await client.refetchQueries({ queryKey: poKeys.all });
    await waitFor(() => expect(catalogLoads).toBe(2));
    await waitFor(() => expect(poLoads).toBe(2));
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Giao buổi sáng");
  }, 20_000);

  it("form đã mở, danh mục tải lại bị cắt (>200) và đang tra SKU → không gỡ form", async () => {
    const user = userEvent.setup();
    let catalogLoads = 0;
    const others = CATALOG.filter((item) => item.sku !== OLD_LINE.sku);
    const { client } = renderEdit({
      getCatalog: () =>
        catalogLoads++ === 0
          ? bePage(CATALOG)
          : { ...bePage(others), totalElements: 201, totalPages: 2, hasNext: true },
      extraRoutes: {
        // Tra theo SKU chưa xong (pending mãi) — trước đây làm màn quay về skeleton
        [`/procurement/skus/${OLD_LINE.sku}/suppliers`]: () => new Promise(() => {}),
      },
    });
    const note = await screen.findByLabelText("Ghi chú");
    await user.type(note, "Giao buổi sáng");
    await client.refetchQueries({ queryKey: supplierItemKeys.all });
    await waitFor(() => expect(catalogLoads).toBeGreaterThan(1));
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Giao buổi sáng");
  }, 20_000);

  it("kho của nháp không còn hoạt động → ô kho vẫn hiện tên kho cũ + báo chọn kho khác", async () => {
    renderEdit({ extraRoutes: { "/warehouses": () => bePage([]) } });
    const warehouse = await screen.findByLabelText(/Kho nhận hàng/);
    expect(warehouse).toHaveTextContent("Kho Hồ Chí Minh");
    expect(screen.getByText(UI_LABELS.purchaseOrder.draftEdit.warehouseInactive)).toBeVisible();
  }, 20_000);

  it("danh mục bị cắt, tra điều khoản theo SKU lỗi → báo lỗi tải + Thử lại, không mở form", async () => {
    renderEdit({
      getCatalog: () => ({
        ...bePage(CATALOG.filter((item) => item.sku !== OLD_LINE.sku)),
        totalElements: 201,
        totalPages: 2,
        hasNext: true,
      }),
      extraRoutes: {
        [`/procurement/skus/${OLD_LINE.sku}/suppliers`]: () => {
          throw new ApiError(503, "SERVICE_UNAVAILABLE", "down");
        },
      },
    });
    expect(await screen.findByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Ghi chú")).not.toBeInTheDocument();
  }, 20_000);

  it("tra SKU lỗi, danh mục còn data nhưng refetch lỗi 403 → vẫn báo lỗi tra SKU (có Thử lại), không báo thiếu quyền", async () => {
    let catalogLoads = 0;
    const { client } = renderEdit({
      getCatalog: () => {
        if (catalogLoads++ > 0) throw new ApiError(403, "FORBIDDEN", "no");
        return {
          ...bePage(CATALOG.filter((item) => item.sku !== OLD_LINE.sku)),
          totalElements: 201,
          totalPages: 2,
          hasNext: true,
        };
      },
      extraRoutes: {
        [`/procurement/skus/${OLD_LINE.sku}/suppliers`]: () => {
          throw new ApiError(503, "SERVICE_UNAVAILABLE", "down");
        },
      },
    });
    expect(await screen.findByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    await client.refetchQueries({ queryKey: supplierItemKeys.all });
    await waitFor(() => expect(catalogLoads).toBeGreaterThan(1));
    expect(await screen.findByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    expect(screen.queryByText(UI_LABELS.loadError.forbiddenTitle)).not.toBeInTheDocument();
  }, 20_000);

  it("danh sách kho tải lỗi → ô kho vẫn hiện kho của nháp (không gắn nhãn ngừng hoạt động) + Thử lại", async () => {
    renderEdit({
      extraRoutes: {
        "/warehouses": () => {
          throw new ApiError(503, "SERVICE_UNAVAILABLE", "down");
        },
      },
    });
    const warehouse = await screen.findByLabelText(/Kho nhận hàng/);
    await waitFor(() => expect(warehouse).toHaveTextContent("Kho Hồ Chí Minh"));
    expect(
      await screen.findByText(UI_LABELS.purchaseOrder.warehouseField.editLoadFailed),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(UI_LABELS.purchaseOrder.draftEdit.warehouseInactive),
    ).not.toBeInTheDocument();
  }, 20_000);

  it("ngày giao trước ngày đặt → lỗi inline, không gửi PUT (BE PurchaseOrder#reviseDraft)", async () => {
    const user = userEvent.setup();
    const { put } = renderEdit({ getPo: () => bePo({ orderDate: "2026-10-01" }) });
    const date = await screen.findByLabelText("Ngày giao dự kiến");
    await user.clear(date);
    await user.type(date, "2026-09-30");
    await next(user);
    expect(await screen.findAllByText("Ngày giao không được trước ngày đặt hàng")).not.toHaveLength(
      0,
    );
    expect(date).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("combobox", { name: "SKU dòng 1" })).not.toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  }, 20_000);

  it("PO đã gửi duyệt → không mở form, có link về chi tiết", async () => {
    renderEdit({ getPo: () => bePo({ status: "PENDING_APPROVAL" }) });
    expect(await screen.findByText(/Không sửa được đơn này/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Về chi tiết đơn/ })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.purchaseOrders.detail(PO_ID),
    );
    expect(screen.queryByLabelText("Nhà cung cấp")).not.toBeInTheDocument();
  });
});
