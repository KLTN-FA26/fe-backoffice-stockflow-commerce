/**
 * Release đơn cho kho (BE `OrderReleaseController` + LP-1): chọn kho + hình thức giao. Hình thức chỉ gửi khi đổi
 * và chỉ chọn được với mã quyền sales-order-delivery-modes:UPDATE; 409 FTL_NO_COD không release gì; nút "Ước tính
 * xếp xe" nhận kho đang chọn qua khe `estimateSlot`.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { OrderDetail } from "./OrderDetail";

import { DETAIL_PATH, HISTORY_PATH } from "../__fixtures__/detail";
import { apiOrder, apiOrderDelivery } from "../__fixtures__/order";
import {
  mockOrderApiGet,
  ORDER_PERMISSION_SETS,
  pickSelectOption,
  renderOrderScreen,
} from "../__fixtures__/render";

import type { PermissionCode } from "@/lib/auth";
import type { OrderEstimateSlot } from "../estimate-slot";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

/** `OrderDetail` dùng `use(params)` — phải render trong `act` để Suspense giải xong. */
async function renderDetailScreen(estimateSlot?: OrderEstimateSlot) {
  let view!: ReturnType<typeof renderOrderScreen>;
  await act(async () => {
    view = renderOrderScreen(
      <OrderDetail
        params={Promise.resolve({ id: apiOrder.orderId })}
        estimateSlot={estimateSlot}
      />,
    );
  });
  return view;
}

const RELEASE_PATH = `${DETAIL_PATH}/release`;
const WAREHOUSES = {
  items: [
    { id: "wh-hn", prefix: "HN01", name: "Kho Hà Nội", status: "ACTIVE" },
    { id: "wh-hcm", prefix: "HCM01", name: "Kho TP.HCM", status: "ACTIVE" },
  ],
};

async function renderConfirmed(
  permissions: readonly PermissionCode[],
  patch: Record<string, unknown> = {},
  estimateSlot?: OrderEstimateSlot,
) {
  mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () =>
      apiOrderDelivery("CONFIRMED", { deliveryMode: "PARCEL", deliveryModeLocked: false }, patch),
    [HISTORY_PATH]: () => [],
    "/warehouses": () => WAREHOUSES,
  });
  await renderDetailScreen(estimateSlot);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Release đơn" }));
  return { user, dialog: await screen.findByRole("dialog") };
}

describe("Release đơn — gate theo trạng thái và mã quyền", () => {
  it("điều phối viên (sales-orders:APPROVE) thấy nút trên đơn Confirmed; Sales / chỉ đọc không thấy", async () => {
    mockOrderApiGet(ORDER_PERMISSION_SETS.salesStaff, {
      [DETAIL_PATH]: () =>
        apiOrderDelivery("CONFIRMED", { deliveryMode: "PARCEL", deliveryModeLocked: false }),
      [HISTORY_PATH]: () => [],
    });
    await renderDetailScreen();
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.queryByRole("button", { name: "Release đơn" })).not.toBeInTheDocument();
  });

  it("đơn đã release (Ready to Fulfill) → không còn nút Release", async () => {
    mockOrderApiGet(ORDER_PERMISSION_SETS.coordinatorWithModes, {
      [DETAIL_PATH]: () =>
        apiOrderDelivery("READY_TO_FULFILL", { deliveryMode: "PARCEL", deliveryModeLocked: false }),
      [HISTORY_PATH]: () => [],
    });
    await renderDetailScreen();
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByRole("button", { name: "Release đơn" })).not.toBeInTheDocument();
  });
});

describe("Release đơn — payload (hình thức chỉ gửi khi đổi)", () => {
  it("giữ nguyên hình thức → body chỉ có warehouseId", async () => {
    const { user, dialog } = await renderConfirmed(ORDER_PERMISSION_SETS.coordinatorWithModes);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrder });
    const toastSuccess = vi.spyOn(toast, "success");

    await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(RELEASE_PATH, { warehouseId: "wh-hn" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã release đơn cho kho"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("đổi sang Nguyên xe (FTL) → body có deliveryMode", async () => {
    const { user, dialog } = await renderConfirmed(ORDER_PERMISSION_SETS.coordinatorWithModes);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrder });
    await pickSelectOption(user, /Kho xuất hàng/, "HCM01 — Kho TP.HCM");
    await user.click(within(dialog).getByRole("radio", { name: /Nguyên xe \(FTL\)/ }));
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(RELEASE_PATH, {
        warehouseId: "wh-hcm",
        deliveryMode: "FULL_TRUCKLOAD",
      }),
    );
  });

  it("đổi rồi chọn lại hình thức cũ → coi như không đổi, không gửi deliveryMode", async () => {
    const { user, dialog } = await renderConfirmed(ORDER_PERMISSION_SETS.coordinatorWithModes);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrder });
    await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
    await user.click(within(dialog).getByRole("radio", { name: /Nguyên xe \(FTL\)/ }));
    await user.click(within(dialog).getByRole("radio", { name: /Giao lẻ/ }));
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(RELEASE_PATH, { warehouseId: "wh-hn" }));
  });

  it("thiếu mã sales-order-delivery-modes:UPDATE → hình thức chỉ đọc (không có ô chọn), body không bao giờ có deliveryMode", async () => {
    const { user, dialog } = await renderConfirmed(ORDER_PERMISSION_SETS.coordinator, {
      deliveryMode: "FULL_TRUCKLOAD",
    });
    expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Nguyên xe (FTL)")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Chỉ điều phối viên đơn hàng mới đổi được/),
    ).toBeInTheDocument();

    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrder });
    await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(RELEASE_PATH, { warehouseId: "wh-hn" }));
  });

  it("chưa chọn kho → nút Release bị khoá", async () => {
    const { dialog } = await renderConfirmed(ORDER_PERMISSION_SETS.coordinatorWithModes);
    expect(within(dialog).getByRole("button", { name: "Release đơn" })).toBeDisabled();
  });
});

describe("Release đơn — lỗi", () => {
  it("409 DELIVERY_MODE_FTL_NO_COD → giữ dialog, báo 'Sale đổi cách thu trước' (chưa release gì)", async () => {
    const { user, dialog } = await renderConfirmed(ORDER_PERMISSION_SETS.coordinatorWithModes);
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(409, "DELIVERY_MODE_FTL_NO_COD", "English server message"),
    );
    await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
    await user.click(within(dialog).getByRole("radio", { name: /Nguyên xe \(FTL\)/ }));
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(
      "Đơn thu tiền khi giao (COD) không giao nguyên xe được — Sale đổi cách thu trước.",
    );
    expect(screen.queryByText("English server message")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("đơn cọc thu khi giao + chọn FTL → báo trước ngay trong dialog", async () => {
    const { user, dialog } = await renderConfirmed(ORDER_PERMISSION_SETS.coordinatorWithModes, {
      paymentTerm: "DEPOSIT",
      balancePolicy: "ON_DELIVERY",
    });
    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: /Nguyên xe \(FTL\)/ }));
    expect(within(dialog).getByRole("status")).toHaveTextContent(/Sale đổi cách thu trước/);
  });

  it("403 (chọn hình thức khác khi thiếu quyền) → câu tiếng Việt, không lộ message tiếng Anh", async () => {
    const { user, dialog } = await renderConfirmed(ORDER_PERMISSION_SETS.coordinatorWithModes);
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(403, "FORBIDDEN", "English server message"),
    );
    await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /không có quyền đổi hình thức giao/,
    );
  });
});

describe("Release đơn — danh sách kho lỗi", () => {
  async function renderWithWarehouses(error: ApiError) {
    mockOrderApiGet(ORDER_PERMISSION_SETS.coordinatorWithModes, {
      [DETAIL_PATH]: () =>
        apiOrderDelivery("CONFIRMED", { deliveryMode: "PARCEL", deliveryModeLocked: false }),
      [HISTORY_PATH]: () => [],
      "/warehouses": () => {
        throw error;
      },
    });
    await renderDetailScreen(() => <span>khe ước tính</span>);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Release đơn" }));
    return { user, dialog: await screen.findByRole("dialog") };
  }

  it("403 (điều phối chưa có warehouse-warehouses:READ) → câu thiếu quyền rõ ràng thay vì 'Không tải được'; hộp thoại vẫn dùng được", async () => {
    const { user, dialog } = await renderWithWarehouses(
      new ApiError(403, "FORBIDDEN", "Forbidden"),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Bạn chưa có quyền xem danh sách kho (warehouse-warehouses:READ) — nhờ quản trị cấp quyền",
    );
    expect(within(dialog).queryByText("Không tải được danh sách kho.")).not.toBeInTheDocument();
    // vẫn dùng được: đổi hình thức giao, khe ước tính; chưa có kho nên chưa release được; huỷ đóng được
    expect(within(dialog).getByText("khe ước tính")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: /Nguyên xe \(FTL\)/ }));
    expect(within(dialog).getByRole("radio", { name: /Nguyên xe \(FTL\)/ })).toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Release đơn" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("lỗi khác (5xx) → vẫn là câu 'Không tải được danh sách kho.'", async () => {
    const { dialog } = await renderWithWarehouses(new ApiError(500, "HTTP_500", "x"));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Không tải được danh sách kho.",
    );
    expect(within(dialog).queryByText(/warehouse-warehouses:READ/)).not.toBeInTheDocument();
  });
});

describe("Release đơn — khe 'Ước tính xếp xe'", () => {
  it("nhận kho đang chọn (null khi chưa chọn) và released = false cho đơn CONFIRMED", async () => {
    const slot = vi.fn<OrderEstimateSlot>(() => <span>khe ước tính</span>);
    const { user, dialog } = await renderConfirmed(
      ORDER_PERMISSION_SETS.coordinatorWithModes,
      {},
      slot,
    );
    expect(within(dialog).getByText("khe ước tính")).toBeInTheDocument();
    expect(slot).toHaveBeenLastCalledWith({
      orderId: apiOrder.orderId,
      orderNumber: apiOrder.orderNumber,
      warehouseId: null,
      released: false,
    });
    await pickSelectOption(user, /Kho xuất hàng/, "HCM01 — Kho TP.HCM");
    expect(slot).toHaveBeenLastCalledWith(
      expect.objectContaining({ warehouseId: "wh-hcm", released: false }),
    );
  });

  it("chi tiết đơn đã release có khe với released = true và không cần kho", async () => {
    const slot = vi.fn<OrderEstimateSlot>(() => <span>khe ước tính</span>);
    mockOrderApiGet(ORDER_PERMISSION_SETS.readOnly, {
      [DETAIL_PATH]: () =>
        apiOrderDelivery("READY_TO_FULFILL", { deliveryMode: "PARCEL", deliveryModeLocked: false }),
      [HISTORY_PATH]: () => [],
    });
    await renderDetailScreen(slot);
    expect(await screen.findByText("khe ước tính")).toBeInTheDocument();
    expect(slot).toHaveBeenCalledWith({
      orderId: apiOrder.orderId,
      orderNumber: apiOrder.orderNumber,
      warehouseId: null,
      released: true,
    });
  });

  it("đơn chưa release / đã giao / đang giữ không có khe trong thẻ hình thức giao", async () => {
    const slot = vi.fn<OrderEstimateSlot>(() => <span>khe ước tính</span>);
    for (const status of ["PENDING_PAYMENT", "SHIPPED", "ON_HOLD"] as const) {
      mockOrderApiGet(ORDER_PERMISSION_SETS.readOnly, {
        [DETAIL_PATH]: () =>
          apiOrderDelivery(status, { deliveryMode: "PARCEL", deliveryModeLocked: true }),
        [HISTORY_PATH]: () => [],
      });
      const view = await renderDetailScreen(slot);
      await screen.findByRole("heading", { name: apiOrder.orderNumber });
      expect(screen.queryByText("khe ước tính")).not.toBeInTheDocument();
      view.unmount();
      vi.restoreAllMocks();
    }
  });
});
