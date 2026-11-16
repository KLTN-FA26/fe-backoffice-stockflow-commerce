/**
 * Release đơn cho kho xuất (BE `OrderReleaseController`, docs 17 §4.2 bước 5, BR-03, BR-29): nút gate theo mã
 * `sales-order-releases:UPDATE` (quản lý kho), body chỉ có kho (+ đợt giao khi chọn) — KHÔNG còn hình thức giao; nút
 * "Ước tính xếp xe" nhận kho đang chọn qua khe `estimateSlot`.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ORDER_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { OrderDetail } from "./OrderDetail";

import { DETAIL_PATH, HISTORY_PATH } from "../__fixtures__/detail";
import { apiOrder, apiOrderAt } from "../__fixtures__/order";
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
/** Mỗi lần thử release mang một Idempotency-Key (UUID). */
const KEY = { headers: { "Idempotency-Key": expect.stringMatching(/^[0-9a-f-]{36}$/) } };
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
    [DETAIL_PATH]: () => apiOrderAt("CONFIRMED", patch),
    [HISTORY_PATH]: () => [],
    "/warehouses": () => WAREHOUSES,
  });
  await renderDetailScreen(estimateSlot);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Release đơn" }));
  return { user, dialog: await screen.findByRole("dialog") };
}

describe("Release đơn — gate theo trạng thái và mã quyền (BE V20261115000200: sales-order-releases:UPDATE)", () => {
  it("quản lý kho (sales-order-releases:UPDATE) thấy nút trên đơn Confirmed", async () => {
    await renderConfirmed(ORDER_PERMISSION_SETS.warehouseManager);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Sales / chỉ đọc / mã sales-orders:APPROVE đã bị BE xoá → không thấy nút", async () => {
    for (const permissions of [
      ORDER_PERMISSION_SETS.salesStaff,
      ORDER_PERMISSION_SETS.readOnly,
      // APPROVE đơn thuần không còn mở release (mã BE đã tách sang sales-order-releases:UPDATE)
      [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read, ORDER_PERMISSIONS.approve],
    ] as const) {
      mockOrderApiGet(permissions, {
        [DETAIL_PATH]: () => apiOrderAt("CONFIRMED"),
        [HISTORY_PATH]: () => [],
      });
      const view = await renderDetailScreen();
      await screen.findByRole("heading", { name: apiOrder.orderNumber });
      await waitFor(() =>
        expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
      );
      expect(screen.queryByRole("button", { name: "Release đơn" })).not.toBeInTheDocument();
      view.unmount();
      vi.restoreAllMocks();
    }
  });

  // BE Order#release: CONFIRMED hoặc AWAITING_STOCK; Order#releaseLaterBatch: PARTIALLY_FULFILLED (docs 17 §4.2 / §4.4 / §4.5)
  it("Đang chờ hàng (Awaiting Stock) và Giao một phần (đợt giao sau) → quản lý kho thấy nút Release; nhãn trạng thái không phải 'Không rõ'", async () => {
    for (const [status, label] of [
      ["AWAITING_STOCK", "Đang chờ hàng"],
      ["PARTIALLY_FULFILLED", "Giao một phần"],
    ] as const) {
      mockOrderApiGet(ORDER_PERMISSION_SETS.warehouseManager, {
        [DETAIL_PATH]: () => apiOrderAt(status),
        [HISTORY_PATH]: () => [],
      });
      const view = await renderDetailScreen();
      await screen.findByRole("heading", { name: apiOrder.orderNumber });
      expect(await screen.findByRole("button", { name: "Release đơn" })).toBeEnabled();
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      expect(screen.queryByText("Không rõ")).not.toBeInTheDocument();
      view.unmount();
      vi.restoreAllMocks();
    }
  });

  it("Chờ ký hợp đồng (Pending Contract) → hiển thị đúng nhãn, không có nút Release", async () => {
    mockOrderApiGet(ORDER_PERMISSION_SETS.warehouseManager, {
      [DETAIL_PATH]: () => apiOrderAt("PENDING_CONTRACT"),
      [HISTORY_PATH]: () => [],
    });
    await renderDetailScreen();
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.getAllByText("Chờ ký hợp đồng").length).toBeGreaterThan(0);
    expect(screen.queryByText("Không rõ")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release đơn" })).not.toBeInTheDocument();
  });

  it("đơn đã release (Ready to Fulfill) / đang giữ / đã huỷ → không còn nút Release", async () => {
    for (const status of ["READY_TO_FULFILL", "ON_HOLD", "CANCELLED", "PICKING"] as const) {
      mockOrderApiGet(ORDER_PERMISSION_SETS.warehouseManager, {
        [DETAIL_PATH]: () => apiOrderAt(status, { holdReason: "ADDRESS" }),
        [HISTORY_PATH]: () => [],
      });
      const view = await renderDetailScreen();
      await screen.findByRole("heading", { name: apiOrder.orderNumber });
      expect(screen.queryByRole("button", { name: "Release đơn" })).not.toBeInTheDocument();
      view.unmount();
      vi.restoreAllMocks();
    }
  });
});

describe("Release đơn — payload (BE ReleaseOrderRequest: warehouseId + deliveryBatchId tuỳ chọn)", () => {
  it("quản lý kho chọn kho → body CHỈ có warehouseId (không còn deliveryMode), có Idempotency-Key", async () => {
    const { user, dialog } = await renderConfirmed(ORDER_PERMISSION_SETS.warehouseManager);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrder });
    const toastSuccess = vi.spyOn(toast, "success");

    await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(RELEASE_PATH, { warehouseId: "wh-hn" }, KEY),
    );
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty("deliveryMode");
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã release đơn cho kho"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("hộp thoại không còn ô hình thức giao (không radio Giao lẻ / Nguyên xe) và mô tả nói phân bổ vào thùng LPN", async () => {
    const { dialog } = await renderConfirmed(ORDER_PERMISSION_SETS.warehouseManager);
    expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Hình thức giao/)).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent(/thùng \(LPN\) cụ thể/);
    expect(dialog).not.toHaveTextContent(/dòng in/);
  });

  it("chưa chọn kho → nút Release bị khoá", async () => {
    const { dialog } = await renderConfirmed(ORDER_PERMISSION_SETS.warehouseManager);
    expect(within(dialog).getByRole("button", { name: "Release đơn" })).toBeDisabled();
  });
});

describe("Release đơn — chọn đợt giao (docs 17 §4.5, BR-29; cần sales-contracts:READ để đọc lịch giao)", () => {
  const SCHEDULE_PATH = `${DETAIL_PATH}/delivery-batches`;
  const schedule = (released = false) => ({
    orderId: apiOrder.orderId,
    orderNumber: apiOrder.orderNumber,
    batches: [
      {
        batchId: "batch-1",
        seq: 1,
        windowStart: "2026-12-01",
        windowEnd: "2026-12-05",
        state: released ? "IN_DELIVERY" : "READY",
        late: false,
        ...(released ? { releasedAt: "2026-11-20T01:00:00Z" } : {}),
        lines: [{ orderLineId: "l-1", sku: "TEE-BLK-M", cartons: 4, heldCartons: 4 }],
      },
      {
        batchId: "batch-2",
        seq: 2,
        windowStart: "2026-12-20",
        windowEnd: "2026-12-24",
        state: "AWAITING_STOCK",
        late: false,
        lines: [{ orderLineId: "l-1", sku: "TEE-BLK-M", cartons: 6, heldCartons: 2 }],
      },
    ],
  });
  const renderWithSchedule = async (permissions: readonly PermissionCode[], data: unknown) => {
    mockOrderApiGet(permissions, {
      [DETAIL_PATH]: () => apiOrderAt("CONFIRMED"),
      [HISTORY_PATH]: () => [],
      "/warehouses": () => WAREHOUSES,
      [SCHEDULE_PATH]: () => data,
    });
    await renderDetailScreen();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Release đơn" }));
    return { user, dialog: await screen.findByRole("dialog") };
  };

  it("có lịch giao: mặc định đợt kế tiếp (đợt 1), gửi deliveryBatchId cùng warehouseId", async () => {
    const { user, dialog } = await renderWithSchedule(
      ORDER_PERMISSION_SETS.releaserWithSchedule,
      schedule(),
    );
    expect(await within(dialog).findByRole("combobox", { name: /Đợt giao/ })).toHaveTextContent(
      /Đợt 1/,
    );
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrder });
    await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        RELEASE_PATH,
        { warehouseId: "wh-hn", deliveryBatchId: "batch-1" },
        KEY,
      ),
    );
  });

  it("người dùng đổi sang đợt khác trong danh sách → gửi đợt đã chọn; BE vẫn là bên quyết", async () => {
    const { user, dialog } = await renderWithSchedule(
      ORDER_PERMISSION_SETS.releaserWithSchedule,
      schedule(),
    );
    await within(dialog).findByRole("combobox", { name: /Đợt giao/ });
    await pickSelectOption(user, /Đợt giao/, /Đợt 2/);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrder });
    await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        RELEASE_PATH,
        { warehouseId: "wh-hn", deliveryBatchId: "batch-2" },
        KEY,
      ),
    );
  });

  it("quản lý kho theo seed BE KHÔNG có sales-contracts:READ → không gọi lịch giao, không có ô đợt, body chỉ có kho (BE chọn đợt kế tiếp)", async () => {
    const { user, dialog } = await renderWithSchedule(
      ORDER_PERMISSION_SETS.warehouseManager,
      schedule(),
    );
    expect(within(dialog).queryByRole("combobox", { name: /Đợt giao/ })).not.toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls.some(([url]) => url === SCHEDULE_PATH)).toBe(false);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrder });
    await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(RELEASE_PATH, { warehouseId: "wh-hn" }, KEY),
    );
  });

  it("đơn không có lịch giao (batches rỗng) → không có ô đợt", async () => {
    const { dialog } = await renderWithSchedule(ORDER_PERMISSION_SETS.releaserWithSchedule, {
      orderId: apiOrder.orderId,
      batches: [],
    });
    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.some(([url]) => url === SCHEDULE_PATH)).toBe(true),
    );
    expect(within(dialog).queryByRole("combobox", { name: /Đợt giao/ })).not.toBeInTheDocument();
  });

  it("không tải được lịch (403) → câu báo, vẫn release được (bỏ trống đợt)", async () => {
    mockOrderApiGet(ORDER_PERMISSION_SETS.releaserWithSchedule, {
      [DETAIL_PATH]: () => apiOrderAt("CONFIRMED"),
      [HISTORY_PATH]: () => [],
      "/warehouses": () => WAREHOUSES,
      [SCHEDULE_PATH]: () => {
        throw new ApiError(403, "FORBIDDEN", "x");
      },
    });
    await renderDetailScreen();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Release đơn" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/Không tải được lịch giao/)).toBeInTheDocument();
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrder });
    await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(RELEASE_PATH, { warehouseId: "wh-hn" }, KEY),
    );
  });
});

describe("Release đơn — lý do BE từ chối hiện trong hộp thoại (tiếng Việt, kèm mã quy tắc)", () => {
  it.each([
    ["ORDER_STOCK_NOT_HELD", /chưa được giữ đủ thùng/, "BR-21"],
    ["ORDER_SHIPPING_WAREHOUSE_MISMATCH", /xuất từ kho khác/, "BR-22"],
    ["DELIVERY_BATCH_NOT_NEXT", /không phải đợt giao kế tiếp/, "BR-29"],
    ["CUSTOMER_CREDIT_OVERDUE", /công nợ quá hạn/, "BR-02"],
  ])(
    "409 %s → giữ dialog, câu tiếng Việt + mã %s, không lộ message tiếng Anh",
    async (code, text, rule) => {
      const { user, dialog } = await renderConfirmed(ORDER_PERMISSION_SETS.warehouseManager);
      vi.spyOn(api, "post").mockRejectedValue(new ApiError(409, code, "English server message"));
      await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
      await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
      const alert = await within(dialog).findByRole("alert");
      expect(alert).toHaveTextContent(text);
      expect(alert).toHaveTextContent(rule);
      expect(screen.queryByText("English server message")).not.toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    },
  );

  it("403 OUT_OF_DATA_SCOPE (kho không thuộc phạm vi quản lý kho) → câu BR-03, không lộ message tiếng Anh", async () => {
    const { user, dialog } = await renderConfirmed(ORDER_PERMISSION_SETS.warehouseManager);
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(403, "OUT_OF_DATA_SCOPE", "English server message"),
    );
    await pickSelectOption(user, /Kho xuất hàng/, "HCM01 — Kho TP.HCM");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(/ngoài phạm vi kho bạn phụ trách/);
    expect(alert).toHaveTextContent("BR-03");
  });
});

describe("Release đơn — danh sách kho lỗi", () => {
  async function renderWithWarehouses(error: ApiError) {
    mockOrderApiGet(ORDER_PERMISSION_SETS.warehouseManager, {
      [DETAIL_PATH]: () => apiOrderAt("CONFIRMED"),
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
    // vẫn dùng được: khe ước tính; chưa có kho nên chưa release được; huỷ đóng được
    expect(within(dialog).getByText("khe ước tính")).toBeInTheDocument();
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
      ORDER_PERMISSION_SETS.warehouseManager,
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
      [DETAIL_PATH]: () => apiOrderAt("READY_TO_FULFILL"),
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

  it("đơn chưa release / đã giao / đang giữ không có khe trong thẻ Xếp xe", async () => {
    const slot = vi.fn<OrderEstimateSlot>(() => <span>khe ước tính</span>);
    for (const status of ["PENDING_PAYMENT", "SHIPPED", "ON_HOLD"] as const) {
      mockOrderApiGet(ORDER_PERMISSION_SETS.readOnly, {
        [DETAIL_PATH]: () => apiOrderAt(status),
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
