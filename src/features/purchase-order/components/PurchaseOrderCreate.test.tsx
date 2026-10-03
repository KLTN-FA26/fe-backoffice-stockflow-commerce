import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  PO_PERMISSION_SETS,
  SUPPLIER_REF,
  bePage,
  bePo,
  mockApi,
  pickSelectOption,
  renderPoScreen,
} from "../__fixtures__/render";
import { PurchaseOrderCreate } from "./PurchaseOrderCreate";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// jsdom không có ResizeObserver / scrollIntoView mà `cmdk` (combobox NCC) dùng.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => vi.restoreAllMocks());

function renderCreate(
  permissions: readonly PermissionCode[] = PO_PERMISSION_SETS.procurement,
  onCreate: (body: unknown) => unknown = (body) => ({ ...bePo(), ...(body as object) }),
) {
  const spies = mockApi(
    permissions,
    { "/suppliers": () => bePage([SUPPLIER_REF]) },
    { "/purchase-orders": (_p, body) => onCreate(body) },
  );
  renderPoScreen(<PurchaseOrderCreate />);
  return spies;
}

/** Chọn NCC trong combobox. */
async function pickSupplier(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("combobox", { name: "Nhà cung cấp" }));
  await user.click(await screen.findByRole("option", { name: /GOHOAPHAT/ }));
}

type User = ReturnType<typeof userEvent.setup>;
const next = (user: User) => user.click(screen.getByRole("button", { name: /Tiếp tục/ }));

/** Điền form hợp lệ tới bước Rà soát rồi bấm Tạo đơn đặt hàng → Xác nhận. */
async function fillAndCreate(user: User) {
  await pickSupplier(user);
  await next(user);
  await user.type(await screen.findByLabelText("SKU dòng 1"), "SKU-001");
  await user.type(screen.getByLabelText(/Đơn giá/), "1000");
  await next(user);
  await next(user);
  await user.click(
    screen.getAllByRole("button", { name: "Tạo đơn đặt hàng" }).at(-1) ?? document.body,
  );
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Tạo đơn đặt hàng" }));
}

describe("PurchaseOrderCreate", () => {
  it("thiếu CREATE → chặn route, không tải danh sách NCC", async () => {
    const { get } = renderCreate(PO_PERMISSION_SETS.readOnly);
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

  it("chọn NCC → hiện thời hạn thanh toán + thời gian giao (read-only) của NCC", async () => {
    const user = userEvent.setup();
    renderCreate();
    await pickSupplier(user);
    expect(screen.getByText("30 ngày")).toBeInTheDocument();
    expect(screen.getByText("7 ngày")).toBeInTheDocument();
    // BE không lưu ngày đặt / điều khoản tự nhập / ghi chú → form không có các ô đó
    expect(screen.queryByText("Ngày đặt")).not.toBeInTheDocument();
    expect(screen.queryByText("Ghi chú")).not.toBeInTheDocument();
  });

  it("BR-06: ngày giao đã qua chỉ cảnh báo (so với hôm nay)", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.type(await screen.findByLabelText("Ngày giao dự kiến"), "2020-01-01");
    expect(await screen.findByText(/Ngày giao dự kiến đã qua/)).toBeInTheDocument();
  });

  it("gửi đúng payload BE: tiền tệ chọn trên form, SKU upper-case, giá không tự điền", async () => {
    const user = userEvent.setup();
    const { post } = renderCreate();
    await pickSupplier(user);
    await pickSelectOption(user, /Tiền tệ của PO/, "USD");
    await user.type(screen.getByLabelText("Ngày giao dự kiến"), "2099-01-01");
    await user.click(screen.getByRole("button", { name: /Tiếp tục/ }));

    await user.type(await screen.findByLabelText("SKU dòng 1"), "sofa-3s-grey");
    const [qty, price] = screen.getAllByRole("spinbutton");
    if (!qty || !price) throw new Error("thiếu ô SL / đơn giá");
    expect(price).toHaveValue(null); // không tự điền đơn giá
    await user.clear(qty);
    await user.type(qty, "3");
    await user.type(price, "250");

    await user.click(screen.getByRole("button", { name: /Tiếp tục/ }));
    await user.click(screen.getByRole("button", { name: /Tiếp tục/ }));
    // Bước Review: nhãn tiếng Việt, không lộ mã enum thô
    expect(screen.getByText(/Tạo đơn đặt hàng → Nháp/)).toBeInTheDocument();
    expect(screen.queryByText(/DRAFT|Lifecycle/)).not.toBeInTheDocument();
    // Nút "Tạo đơn đặt hàng" cuối cùng = nút submit ở thanh dưới (nút đầu là bước trong stepper).
    await user.click(
      screen.getAllByRole("button", { name: "Tạo đơn đặt hàng" }).at(-1) ?? document.body,
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Tạo đơn đặt hàng" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/purchase-orders", {
        supplierId: SUPPLIER_REF.supplierId,
        currency: "USD",
        expectedAt: "2099-01-01",
        lines: [{ sku: "SOFA-3S-GREY", description: null, quantityOrdered: 3, unitPrice: 250 }],
      }),
    );
    // Đi hết wizard 3 bước bằng userEvent: chạy song song cả bộ test thì vượt 5s mặc định.
  }, 15_000);

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
    expect(screen.queryByLabelText("SKU dòng 1")).not.toBeInTheDocument();
  });

  it("dòng hàng sai → lỗi inline dưới đúng ô, không sang bước sau", async () => {
    const user = userEvent.setup();
    renderCreate();
    await pickSupplier(user);
    await next(user);
    await user.type(await screen.findByLabelText("SKU dòng 1"), "ab");
    await next(user);
    const sku = screen.getByLabelText("SKU dòng 1");
    expect(sku).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByText(/Mã SKU chỉ gồm chữ in hoa/)).not.toHaveLength(0);
    expect(screen.getAllByText("Nhập đơn giá (không âm)")).not.toHaveLength(0);
    expect(screen.queryByText("Tổng giá trị PO")).not.toBeInTheDocument();
  });

  it("BE trả fieldErrors của dòng → quay về bước Dòng hàng, lỗi hiện inline ở ô SL", async () => {
    const user = userEvent.setup();
    renderCreate(PO_PERMISSION_SETS.procurement, () => {
      throw new ApiError(400, "VALIDATION_FAILED", "Invalid request data", {
        "lines[0].quantityOrdered": "must be greater than 0",
      });
    });
    await fillAndCreate(user);
    const qty = await screen.findByLabelText(/SL đặt/);
    expect(qty).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByText("SL đặt không hợp lệ")).not.toHaveLength(0);
  }, 15_000);

  it("BE 409 NCC ngừng hợp tác → quay về bước 1, lỗi inline ở ô Nhà cung cấp", async () => {
    const user = userEvent.setup();
    renderCreate(PO_PERMISSION_SETS.procurement, () => {
      throw new ApiError(409, "SUPPLIER_INACTIVE", "Supplier is INACTIVE");
    });
    await fillAndCreate(user);
    expect(
      await screen.findAllByText("Nhà cung cấp đã ngừng hợp tác, không thể tạo đơn mới"),
    ).not.toHaveLength(0);
    expect(screen.getByRole("combobox", { name: "Nhà cung cấp" })).toBeInTheDocument();
  }, 15_000);
});
