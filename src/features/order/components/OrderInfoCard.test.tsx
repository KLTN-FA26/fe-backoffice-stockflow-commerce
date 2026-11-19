import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CUSTOMER_ADDRESS_PERMISSIONS,
  ORDER_PERMISSIONS,
  ORDER_SHIPPING_ADDRESS_LABELS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiOrder, apiOrderWith } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/**
 * "Kho xuất" trên trang chi tiết: tên kho tra qua GET /warehouses (warehouse-warehouses:READ). Live BE
 * 5683fe14: ORDER_COORDINATOR chưa có quyền này (BE V20261022000100 bổ sung) → mỗi lần mở đơn đều 403
 * và hiện UUID trần. Thiếu quyền thì không gọi API, báo không xem được tên; có quyền thì hiện tên kho.
 */

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
const WAREHOUSE_ID = "8f8f8f8f-0000-4000-8000-000000000001";
const released = apiOrderWith({ status: "READY_TO_FULFILL", warehouseId: WAREHOUSE_ID });

async function renderDetail(permissions: readonly PermissionCode[]) {
  const get = mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () => released,
    [`${DETAIL_PATH}/history`]: () => [],
    "/warehouses": () => ({ items: [{ id: WAREHOUSE_ID, prefix: "HN", name: "Kho Hà Nội" }] }),
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
  await screen.findByRole("heading", { name: apiOrder.orderNumber });
  return get;
}

const warehouseCalls = (get: Awaited<ReturnType<typeof renderDetail>>) =>
  get.mock.calls.filter(([url]) => url === "/warehouses");

afterEach(() => vi.restoreAllMocks());

describe("OrderInfoCard — Khách hàng hiện tên, không UUID (QA A5, BE-15)", () => {
  it("BE trả customerName/customerCode → hiện tên và mã; không còn nhãn 'Mã khách' với UUID", async () => {
    const get = mockOrderApiGet(ORDER_PERMISSION_SETS.coordinator, {
      [DETAIL_PATH]: () =>
        apiOrderWith({ customerName: "Công ty Bao Bì An Phát", customerCode: "0312345678" }),
      [`${DETAIL_PATH}/history`]: () => [],
    });
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
    });
    await screen.findByRole("heading", { name: apiOrder.orderNumber });

    expect(screen.getByText("Khách hàng")).toBeInTheDocument();
    expect(screen.getByText("Công ty Bao Bì An Phát")).toBeInTheDocument();
    expect(screen.getByText("0312345678")).toBeInTheDocument();
    expect(screen.queryByText("Mã khách")).not.toBeInTheDocument();
    expect(screen.queryByText(apiOrder.customerId as string)).not.toBeInTheDocument();
    expect(get).toBeDefined();
  });
});

describe("OrderInfoCard — Kho xuất theo quyền warehouse-warehouses:READ", () => {
  it("thiếu quyền (Coordinator trước BE V20261022000100) → không gọi GET /warehouses, báo không xem được tên", async () => {
    const get = await renderDetail(ORDER_PERMISSION_SETS.coordinator);

    const fallback = await screen.findByText(/tài khoản chưa có quyền xem tên kho/);
    expect(fallback).toHaveAttribute("title", WAREHOUSE_ID);
    expect(screen.queryByText(WAREHOUSE_ID)).not.toBeInTheDocument();
    expect(warehouseCalls(get)).toHaveLength(0);
  });

  it("có quyền → tra danh mục kho (mọi trạng thái) và hiện tên kho", async () => {
    const get = await renderDetail([
      ...ORDER_PERMISSION_SETS.coordinator,
      WAREHOUSE_PERMISSIONS.read,
    ]);

    expect(await screen.findByText("Kho Hà Nội")).toBeInTheDocument();
    expect(screen.queryByText(/chưa có quyền xem tên kho/)).not.toBeInTheDocument();
    const [call] = warehouseCalls(get);
    const params = (call?.[1] as { params: URLSearchParams }).params;
    expect(params.get("status")).toBeNull();
  });

  it("đơn chưa release → 'Chưa release', không tra kho", async () => {
    const get = mockOrderApiGet(
      [...ORDER_PERMISSION_SETS.coordinator, WAREHOUSE_PERMISSIONS.read],
      {
        [DETAIL_PATH]: () => apiOrderWith({ status: "CONFIRMED", warehouseId: null }),
        [`${DETAIL_PATH}/history`]: () => [],
      },
    );
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
    });
    expect(await screen.findByText("Chưa release")).toBeInTheDocument();
    expect(warehouseCalls(get)).toHaveLength(0);
  });
});

describe("WF04 G2 — Đổi địa chỉ giao trên chi tiết đơn (docs 17 §4.7, BR-16; 08 BR-04)", () => {
  const L = ORDER_SHIPPING_ADDRESS_LABELS;
  const ADDRESS_ID = "a0a0a0a0-0000-4000-8000-000000000009";
  const SALES = [
    ...ORDER_PERMISSION_SETS.salesStaff,
    ORDER_PERMISSIONS.shippingAddress,
    CUSTOMER_ADDRESS_PERMISSIONS.read,
  ];
  const addressesPath = `/customers/${apiOrder.customerId}/addresses`;
  const addressBook = () => [
    {
      addressId: ADDRESS_ID,
      type: "SHIPPING",
      recipientName: "Kho Đa Kao",
      phone: "0907654321",
      line1: "9 Hai Bà Trưng",
      wardName: "Phường Đa Kao",
      provinceName: "TP. Hồ Chí Minh",
      defaultAddress: false,
    },
    {
      addressId: "b0b0b0b0-0000-4000-8000-000000000001",
      type: "BILLING",
      recipientName: "Kế toán",
      phone: "0900000000",
      line1: "1 Lê Lợi",
      wardName: "Phường Bến Nghé",
      provinceName: "TP. Hồ Chí Minh",
      defaultAddress: true,
    },
  ];

  async function renderOrder(order: unknown, permissions: readonly PermissionCode[] = SALES) {
    mockOrderApiGet(permissions, { [DETAIL_PATH]: () => order, [addressesPath]: addressBook });
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
    });
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
  }

  it("Sale, đơn đang lấy hàng chưa dán nhãn: chọn địa chỉ giao trong sổ địa chỉ → PUT shipping-address", async () => {
    const user = userEvent.setup();
    const put = vi
      .spyOn(api, "put")
      .mockResolvedValue({ data: apiOrderWith({ status: "PICKING" }) });
    await renderOrder(apiOrderWith({ status: "PICKING", firstLabeledAt: null }));

    await user.click(screen.getByRole("button", { name: L.button }));
    const dialog = await screen.findByRole("dialog");
    const select = await within(dialog).findByLabelText(L.addressLabel);
    // Chỉ địa chỉ giao (SHIPPING), không có địa chỉ hoá đơn
    expect(within(select).queryByText(/Kế toán/)).toBeNull();
    expect(within(dialog).getByRole("button", { name: L.submit })).toBeDisabled();
    await user.selectOptions(select, ADDRESS_ID);
    await user.click(within(dialog).getByRole("button", { name: L.submit }));

    expect(put).toHaveBeenCalledWith(
      `/orders/${apiOrder.orderId}/shipping-address`,
      { shippingAddressId: ADDRESS_ID },
      expect.anything(),
    );
  });

  it("409 ORDER_ADDRESS_LOCKED (vừa có thùng dán nhãn): đóng hộp thoại và tải lại đơn", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "put").mockRejectedValue(
      new ApiError(409, "ORDER_ADDRESS_LOCKED", "The delivery address can no longer change"),
    );
    const get = mockOrderApiGet(SALES, {
      [DETAIL_PATH]: () => apiOrderWith({ status: "PICKING", firstLabeledAt: null }),
      [addressesPath]: addressBook,
    });
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
    });
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    const detailReads = () => get.mock.calls.filter(([url]) => url === DETAIL_PATH).length;
    const before = detailReads();

    await user.click(screen.getByRole("button", { name: L.button }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(await within(dialog).findByLabelText(L.addressLabel), ADDRESS_ID);
    await user.click(within(dialog).getByRole("button", { name: L.submit }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(detailReads()).toBeGreaterThan(before));
  });

  it("thiếu customer-addresses:READ: hộp thoại báo không xem được sổ địa chỉ, không gọi API sổ địa chỉ", async () => {
    const user = userEvent.setup();
    const get = mockOrderApiGet(
      [...ORDER_PERMISSION_SETS.salesStaff, ORDER_PERMISSIONS.shippingAddress],
      { [DETAIL_PATH]: () => apiOrderWith({ status: "PICKING", firstLabeledAt: null }) },
    );
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
    });
    await screen.findByRole("heading", { name: apiOrder.orderNumber });

    await user.click(screen.getByRole("button", { name: L.button }));

    expect(
      await within(await screen.findByRole("dialog")).findByText(L.noAddressAccess),
    ).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === addressesPath)).toBe(false);
  });

  it("08 BR-04: thùng đầu tiên đã dán nhãn → không có nút đổi địa chỉ", async () => {
    await renderOrder(apiOrderWith({ status: "PICKING", firstLabeledAt: "2026-11-18T03:00:00Z" }));
    expect(screen.queryByRole("button", { name: L.button })).toBeNull();
  });

  it("thiếu sales-order-addresses:UPDATE → không có nút", async () => {
    await renderOrder(apiOrderWith({ status: "PICKING", firstLabeledAt: null }), [
      ...ORDER_PERMISSION_SETS.salesStaff,
    ]);
    expect(screen.queryByRole("button", { name: L.button })).toBeNull();
  });
});
