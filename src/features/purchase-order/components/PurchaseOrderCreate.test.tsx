import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  WAREHOUSE_REF,
  next,
  patchJsdomForCmdk,
  pickSku,
  pickSupplier,
  renderCreate,
  submitFromReview,
} from "../__fixtures__/create";
import { PO_PERMISSION_SETS, SUPPLIER_REF, pickSelectOption } from "../__fixtures__/render";

import type { User } from "../__fixtures__/create";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeAll(patchJsdomForCmdk);

// Test đi qua wizard nhiều bước + cmdk bằng userEvent: 2–7s khi chạy riêng, vượt 5s mặc định
// khi cả bộ chạy song song → timeout 20s truyền vào từng `it` của nhánh này (không đổi config).

afterEach(() => vi.restoreAllMocks());

/** Điền form hợp lệ tới bước Rà soát rồi bấm Tạo đơn đặt hàng → Xác nhận. */
async function fillAndCreate(user: User) {
  await pickSupplier(user);
  await next(user);
  await pickSku(user, /SOFA-3S-GREY/);
  await user.type(screen.getByLabelText(/Mô tả sản phẩm/), "Sofa 3 chỗ");
  await next(user);
  await next(user);
  await submitFromReview(user);
}

describe("PurchaseOrderCreate", () => {
  it("thiếu CREATE → chặn route, không tải danh sách NCC", async () => {
    const { get } = renderCreate({ permissions: PO_PERMISSION_SETS.readOnly });
    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith("/suppliers", expect.anything());
  });

  it("NCC lấy từ GET /suppliers chỉ NCC đang hợp tác (status=ACTIVE)", async () => {
    const { get } = renderCreate();
    await screen.findByRole("combobox", { name: "Nhà cung cấp" });
    const call = get.mock.calls.find(([url]) => url === "/suppliers");
    const params = call?.[1]?.params;
    expect(params instanceof URLSearchParams ? params.get("status") : null).toBe("ACTIVE");
  });

  it("danh sách kho tải lỗi → câu riêng màn tạo (thử lại để chọn kho) + nút Thử lại", async () => {
    renderCreate({
      warehouses: () => {
        throw new ApiError(503, "SERVICE_UNAVAILABLE", "down");
      },
    });
    expect(
      await screen.findByText(UI_LABELS.purchaseOrder.warehouseField.loadFailed),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(UI_LABELS.purchaseOrder.warehouseField.editLoadFailed),
    ).not.toBeInTheDocument();
  });

  it("kho nhận lấy từ GET /warehouses chỉ kho đang hoạt động (status=ACTIVE)", async () => {
    const { get } = renderCreate();
    await screen.findByRole("combobox", { name: /Kho nhận hàng/ });
    await waitFor(() => expect(get.mock.calls.some(([url]) => url === "/warehouses")).toBe(true));
    const call = get.mock.calls.find(([url]) => url === "/warehouses");
    const params: unknown = call?.[1]?.params;
    const status =
      params instanceof URLSearchParams
        ? params.get("status")
        : (params as Record<string, unknown> | undefined)?.status;
    expect(status).toBe("ACTIVE");
  });

  it("chọn NCC → hiện thời hạn thanh toán + thời gian giao (read-only) của NCC", async () => {
    const user = userEvent.setup();
    renderCreate();
    await pickSupplier(user);
    expect(screen.getByText("30 ngày")).toBeInTheDocument();
    expect(screen.getByText("7 ngày")).toBeInTheDocument();
    // BE không lưu ngày đặt / điều khoản tự nhập → form không có các ô đó; ghi chú thì có (BE PR #71)
    expect(screen.queryByText("Ngày đặt")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ghi chú")).toBeInTheDocument();
  });

  it("BR-06: ngày giao đã qua chỉ cảnh báo (so với hôm nay)", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.type(await screen.findByLabelText("Ngày giao dự kiến"), "2020-01-01");
    expect(await screen.findByText(/Ngày giao dự kiến đã qua/)).toBeInTheDocument();
  });

  it("gửi đúng payload BE: tiền tệ chọn trên form, SKU từ danh mục, khác tiền tệ thì không điền giá", async () => {
    const user = userEvent.setup();
    const { post } = renderCreate();
    await pickSupplier(user);
    await pickSelectOption(user, /Tiền tệ của PO/, "USD");
    await user.type(screen.getByLabelText("Ngày giao dự kiến"), "2099-01-01");
    await user.type(screen.getByLabelText("Ghi chú"), " Giao trước 10h ");
    await next(user);

    await pickSku(user, /SOFA-3S-GREY/);
    await user.type(screen.getByLabelText(/Mô tả sản phẩm/), "  Sofa 3 chỗ xám ");
    const [qty, price, tax] = screen.getAllByRole("spinbutton");
    if (!qty || !price || !tax) throw new Error("thiếu ô SL / đơn giá / thuế");
    expect(price).toHaveValue(null); // danh mục VND, PO USD → không điền giá
    await user.clear(qty);
    await user.type(qty, "3");
    await user.type(price, "250");
    await user.type(tax, "10");

    await next(user);
    await next(user);
    // Bước Review: nhãn tiếng Việt, không lộ mã enum thô
    expect(screen.getByText(/Tạo đơn đặt hàng → Nháp/)).toBeInTheDocument();
    expect(screen.queryByText(/DRAFT|Lifecycle/)).not.toBeInTheDocument();
    await submitFromReview(user);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/purchase-orders", {
        supplierId: SUPPLIER_REF.supplierId,
        warehouseId: WAREHOUSE_REF.id,
        currency: "USD",
        expectedAt: "2099-01-01",
        note: "Giao trước 10h",
        lines: [
          {
            sku: "SOFA-3S-GREY",
            description: "Sofa 3 chỗ xám",
            quantityOrdered: 3,
            unitPrice: 250,
            taxRate: 10,
          },
        ],
      }),
    );
    // Đi hết wizard 3 bước bằng userEvent: chạy song song cả bộ test thì vượt 5s mặc định.
  }, 20_000);

  it("chặn nhảy bước: chưa qua bước 1 thì stepper khoá bước sau; Tiếp tục khi thiếu NCC → lỗi inline", async () => {
    const user = userEvent.setup();
    renderCreate();
    await screen.findByRole("combobox", { name: "Nhà cung cấp" });
    expect(screen.getByRole("button", { name: /Dòng hàng/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Tổng cộng/ })).toBeDisabled();
    await next(user);
    // Ở lại bước 1, lỗi ngay dưới ô — combobox trỏ aria-describedby tới dòng lỗi
    expect(await screen.findAllByText("Chọn nhà cung cấp")).not.toHaveLength(0);
    expect(screen.getByRole("combobox", { name: "Nhà cung cấp" })).toHaveAccessibleDescription(
      "Chọn nhà cung cấp",
    );
    expect(screen.queryByRole("combobox", { name: "SKU dòng 1" })).not.toBeInTheDocument();
  });

  it("dòng hàng chưa chọn SKU → lỗi inline dưới đúng ô, không sang bước sau", async () => {
    const user = userEvent.setup();
    renderCreate();
    await pickSupplier(user);
    await next(user);
    await screen.findByRole("combobox", { name: "SKU dòng 1" });
    await next(user);
    expect(screen.getByRole("combobox", { name: "SKU dòng 1" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getAllByText("Chọn SKU trong danh mục của NCC")).not.toHaveLength(0);
    expect(screen.getAllByText("Nhập đơn giá (lớn hơn 0)")).not.toHaveLength(0);
    // Mô tả để trống được (BE PR #71 lấy tên sản phẩm của SKU)
    expect(screen.queryByText("Nhập mô tả sản phẩm")).not.toBeInTheDocument();
    expect(screen.queryByText("Tổng giá trị PO")).not.toBeInTheDocument();
  }, 20_000);

  it("BE trả fieldErrors của dòng → quay về bước Dòng hàng, lỗi hiện inline ở ô SL", async () => {
    const user = userEvent.setup();
    renderCreate({
      onCreate: () => {
        throw new ApiError(400, "VALIDATION_FAILED", "Invalid request data", {
          "lines[0].quantityOrdered": "must be greater than 0",
        });
      },
    });
    await fillAndCreate(user);
    const qty = await screen.findByLabelText(/SL đặt/);
    expect(qty).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByText("SL đặt không hợp lệ")).not.toHaveLength(0);
  }, 20_000);

  it("BE 409 NCC ngừng hợp tác → quay về bước 1, lỗi inline ở ô Nhà cung cấp", async () => {
    const user = userEvent.setup();
    renderCreate({
      onCreate: () => {
        throw new ApiError(409, "SUPPLIER_INACTIVE", "Supplier is INACTIVE");
      },
    });
    await fillAndCreate(user);
    expect(
      await screen.findAllByText("Nhà cung cấp đã ngừng hợp tác, không thể tạo đơn mới"),
    ).not.toHaveLength(0);
    expect(screen.getByRole("combobox", { name: "Nhà cung cấp" })).toBeInTheDocument();
  }, 20_000);
});
