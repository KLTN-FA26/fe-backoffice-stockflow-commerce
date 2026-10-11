import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiOrder } from "../__fixtures__/order";
import {
  ORDER_PERMISSION_SETS,
  mockOrderApiGet,
  pickOrderSelectOption,
  renderOrderScreen,
} from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { PermissionCode } from "@/lib/auth";
import type { OrderDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
const RELEASE_PATH = `${DETAIL_PATH}/release`;
const WAREHOUSE_ID = "8f8f8f8f-0000-4000-8000-000000000001";
const confirmed: OrderDto = { ...apiOrder, status: "CONFIRMED", paymentTerm: "PREPAID" };

async function renderDetail(permissions: readonly PermissionCode[], order: OrderDto) {
  mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () => order,
    "/warehouses": () => ({ items: [{ id: WAREHOUSE_ID, prefix: "HN", name: "Kho Hà Nội" }] }),
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
}

async function openAndPick(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Release đơn" }));
  await pickOrderSelectOption(user, /Kho xuất/, /HN — Kho Hà Nội/);
  await user.click(screen.getByRole("button", { name: "Release" }));
}

afterEach(() => vi.restoreAllMocks());

const DIALOG_FLOW_TIMEOUT_MS = 15_000;

describe("Release — action-gating (SCRUM-423, docs 17 BR-02)", () => {
  it("Confirmed + ORDER_COORDINATOR → có nút Release đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    expect(await screen.findByRole("button", { name: "Release đơn" })).toBeInTheDocument();
  });

  it("Confirmed + SALES_STAFF (không có sales-orders:APPROVE) → không có nút Release", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, confirmed);
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByRole("button", { name: "Release đơn" })).not.toBeInTheDocument();
  });

  it("đơn cọc chưa nhận cọc → Coordinator thấy 'Chưa release được · BR-PRD-09', không có nút", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, {
      ...apiOrder,
      status: "PENDING_PAYMENT",
      paymentTerm: "DEPOSIT",
      depositRequired: 105_000,
    });
    const card = await screen.findByRole("region", { name: "Thao tác đơn" });
    expect(within(card).getByText("Chưa release được")).toBeInTheDocument();
    expect(within(card).getByText("BR-PRD-09")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release đơn" })).not.toBeInTheDocument();
  });
});

describe("Credit hold trên trang chi tiết (SCRUM-427)", () => {
  it("On Hold + CREDIT + quyền duyệt công nợ (như System Admin) → Duyệt / Từ chối, không Release", async () => {
    await renderDetail(
      [...ORDER_PERMISSION_SETS.coordinator, ...ORDER_PERMISSION_SETS.accountant],
      { ...apiOrder, status: "ON_HOLD", paymentTerm: "CREDIT" },
    );
    const card = await screen.findByRole("region", { name: "Thao tác đơn" });
    expect(within(card).getByRole("button", { name: "Duyệt vượt hạn mức" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Từ chối" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Release đơn" })).not.toBeInTheDocument();
    // BR-02: Coordinator thấy lý do chưa release
    expect(within(card).getByText("BR-02")).toBeInTheDocument();
  });
});

// Dialog nhiều bước (Radix Select trong jsdom) chậm khi chạy song song cả bộ test → nới timeout
describe("Release — gửi & lý do từ chối", { timeout: DIALOG_FLOW_TIMEOUT_MS }, () => {
  it("chọn kho → POST /release {warehouseId}, đóng dialog", async () => {
    const user = userEvent.setup();
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    const post = vi.spyOn(api, "post").mockResolvedValue({
      data: { ...confirmed, status: "READY_TO_FULFILL", warehouseId: WAREHOUSE_ID },
    });

    await openAndPick(user);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(RELEASE_PATH, { warehouseId: WAREHOUSE_ID }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("chưa chọn kho → nút Release bị khoá", async () => {
    const user = userEvent.setup();
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    await user.click(await screen.findByRole("button", { name: "Release đơn" }));
    expect(screen.getByRole("button", { name: "Release" })).toBeDisabled();
  });

  it("BR-PRD-08: DESIGN_SAMPLE_NOT_APPROVED → lý do + mã quy tắc + SKU hiện trong dialog, dialog giữ nguyên", async () => {
    const user = userEvent.setup();
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(
        409,
        "DESIGN_SAMPLE_NOT_APPROVED",
        "No approved sample for: CUP-PRINT-12OZ",
        undefined,
        "corr-9",
      ),
    );

    await openAndPick(user);

    const dialog = await screen.findByRole("dialog");
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("mẫu được khách duyệt");
    expect(alert).toHaveTextContent("BR-PRD-08");
    expect(alert).toHaveTextContent("CUP-PRINT-12OZ");
    expect(alert).toHaveTextContent("corr-9");
  });

  it("BR-PRD-09: ORDER_DEPOSIT_NOT_RECEIVED → lý do chưa đủ cọc", async () => {
    const user = userEvent.setup();
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(409, "ORDER_DEPOSIT_NOT_RECEIVED", "x"));

    await openAndPick(user);

    const alert = await within(await screen.findByRole("dialog")).findByRole("alert");
    expect(alert).toHaveTextContent("chưa nhận đủ tiền cọc");
    expect(alert).toHaveTextContent("BR-PRD-09");
  });

  it("danh sách kho 403 (Coordinator chưa có warehouse-warehouses:READ) → báo rõ quyền", async () => {
    const user = userEvent.setup();
    mockOrderApiGet(ORDER_PERMISSION_SETS.coordinator, {
      [DETAIL_PATH]: () => confirmed,
      "/warehouses": () => {
        throw new ApiError(403, "FORBIDDEN", "Forbidden");
      },
    });
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
    });

    await user.click(await screen.findByRole("button", { name: "Release đơn" }));
    expect(await screen.findByText(/warehouse-warehouses:READ/)).toBeInTheDocument();
  });
});
