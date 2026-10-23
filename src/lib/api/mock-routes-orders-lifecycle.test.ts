/**
 * Mock đơn hàng — bất biến tích hợp store (PR #27 credit hold / release + develop vòng đời 19 trạng thái,
 * BE PR #133). Gọi thẳng handler đã đăng ký ở tầng wire (body `{ success, data }` / lỗi `errorCode`),
 * không qua lớp `features/order` — kiểm hợp đồng BE của mock, độc lập với cách FE map.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { resolveMockRoute } from "./mock-adapter";
import { registerOrderMockRoutes } from "./mock-routes-orders";
import {
  BE_ORDER_STATUSES,
  backendOrderStatusOf,
  putMockOrderOnDesignHold,
  resetOrderMockStore,
  setMockOrderStatus,
} from "./mock-routes-orders-store";

import type { AxiosRequestConfig } from "axios";

const registrations = vi.hoisted(() => [] as string[]);

vi.mock("./mock-adapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./mock-adapter")>();
  return {
    ...actual,
    registerMockRoute: (...args: Parameters<typeof actual.registerMockRoute>) => {
      registrations.push(`${args[0]} ${args[1]}`);
      actual.registerMockRoute(...args);
    },
  };
});

// Đơn cụ thể trong mock-data (không sửa được)
const CONFIRMED_STOCK = "ORD-2026-0013"; // Confirmed, chỉ hàng sẵn, thẻ → PREPAID
const CREDIT_ON_HOLD = "ORD-2026-0006"; // On Hold, chuyển khoản → CREDIT (vượt hạn mức)
const IN_PRODUCTION = "ORD-2026-0011"; // In Production, dòng in, COD → CREDIT
const READY = "ORD-2026-0010"; // Ready to Fulfill, dòng in
const PICKING = "ORD-2026-0017"; // Picking
const PACKED_CREDIT = "ORD-2026-0005"; // Packed, COD → CREDIT
const PARTIAL = "ORD-2026-0009"; // Partially Fulfilled — 1 lô đã bàn giao (thiếu 2)
const SHIPPED = "ORD-2026-0007";
const DEPOSIT_PENDING = "ORD-2026-0014"; // Pending Payment, dòng in → DEPOSIT
const OVERDUE_CUSTOMER_ORDER = "ORD-2026-0008"; // CUS-0006 có nợ quá hạn, COD → CREDIT

type Json = Record<string, unknown>;

interface Wire {
  status: number;
  body: Json;
}

async function call(method: string, url: string, payload?: unknown): Promise<Wire> {
  const match = resolveMockRoute(method, url);
  if (!match) throw new Error(`Không có route ${method} ${url}`);
  const config = {
    url,
    data: payload === undefined ? undefined : JSON.stringify(payload),
    _mockParams: match.params,
  } as AxiosRequestConfig;
  const response = await match.handler(config);
  return { status: response.status, body: response.data as Json };
}

async function data(method: string, url: string, payload?: unknown): Promise<Json> {
  const { status, body } = await call(method, url, payload);
  if (status !== 200) throw new Error(`${method} ${url} → ${status} ${String(body.errorCode)}`);
  return body.data as Json;
}

async function errorCode(method: string, url: string, payload?: unknown): Promise<string> {
  const { status, body } = await call(method, url, payload);
  if (status === 200) throw new Error(`${method} ${url} lẽ ra phải lỗi`);
  return String(body.errorCode);
}

const order = (id: string) => data("GET", `/orders/${id}`);
const history = async (id: string) =>
  (await data("GET", `/orders/${id}/history`)) as unknown as Json[];
const listItems = async (query: string) =>
  ((await data("GET", `/orders?size=200${query}`)).items ?? []) as Json[];
const creditHoldIds = async () =>
  (((await data("GET", "/orders/credit-holds")).items ?? []) as Json[]).map(
    (hold) => (hold.order as Json).orderId,
  );

beforeAll(() => {
  registerOrderMockRoutes();
});

afterEach(() => resetOrderMockStore());

describe("đăng ký route — mỗi METHOD + PATH đúng một chủ", () => {
  const EXPECTED = [
    "GET /orders",
    "GET /orders/:id",
    "GET /orders/:id/history",
    "POST /orders/:id/admin-cancellation",
    "POST /orders/:id/hold",
    "POST /orders/:id/hold/resolution",
    "POST /orders/:id/delivery-failure",
    "POST /orders/:id/remainder-closure",
    "POST /orders/:id/release",
    "GET /orders/credit-position/:id",
    "GET /orders/credit-holds",
    "POST /orders/:id/credit-approval",
    "POST /orders/:id/credit-rejection",
    "GET /production/orders",
  ];

  it("không trùng, không mất endpoint nào của hai nhánh", () => {
    expect(new Set(registrations).size).toBe(registrations.length);
    expect([...registrations].sort()).toEqual([...EXPECTED].sort());
  });

  it("/orders/credit-holds đăng ký trước /orders/:id (adapter khớp theo thứ tự)", () => {
    expect(registrations.indexOf("GET /orders/credit-holds")).toBeLessThan(
      registrations.indexOf("GET /orders/:id"),
    );
    expect(resolveMockRoute("GET", "/orders/credit-holds")?.params).toEqual({});
  });
});

describe("vòng đời 19 trạng thái (BE PR #133)", () => {
  it("mọi đơn trả trạng thái BE hiện hành — không còn IN_FULFILMENT / PAID", async () => {
    const statuses = new Set((await listItems("")).map((o) => o.status));
    for (const status of statuses) expect(BE_ORDER_STATUSES).toContain(status);
    for (const status of ["PICKING", "PACKED", "PARTIALLY_FULFILLED", "DELIVERY_FAILED", "CLOSED"])
      expect(statuses).toContain(status);
  });

  it("bộ lọc: bí danh cũ còn nhận, phân tách dấu phẩy, tên lạ → 400 UNSUPPORTED_PARAMETER", async () => {
    const legacy = new Set((await listItems("&status=IN_FULFILMENT")).map((o) => o.status));
    expect(legacy).toEqual(new Set(["PICKING", "PARTIALLY_FULFILLED", "PACKED"]));
    const paid = await listItems("&status=PAID");
    expect(paid.every((o) => o.status === "CONFIRMED")).toBe(true);
    const comma = new Set((await listItems("&status=PICKING,packed")).map((o) => o.status));
    expect(comma).toEqual(new Set(["PICKING", "PACKED"]));
    expect(await errorCode("GET", "/orders?status=NOPE")).toBe("UNSUPPORTED_PARAMETER");
  });

  it("xuất kho: READY_TO_FULFILL → PICKING → PACKED (packedAt), lịch sử ghi đủ bước", async () => {
    setMockOrderStatus(READY, "PICKING");
    expect(await backendOrderStatusOf(READY)).toBe("PICKING");
    expect(await order(READY)).not.toHaveProperty("packedAt");
    setMockOrderStatus(READY, "PACKED");
    expect(await order(READY)).toMatchObject({ status: "PACKED", packedAt: expect.any(String) });
    expect((await history(READY)).slice(-2)).toMatchObject([
      { from: "READY_TO_FULFILL", to: "PICKING" },
      { from: "PICKING", to: "PACKED" },
    ]);
  });

  it("đặt cùng trạng thái không sinh bước lịch sử rỗng", async () => {
    const before = (await history(PICKING)).length;
    setMockOrderStatus(PICKING, "PICKING");
    expect(await history(PICKING)).toHaveLength(before);
  });
});

describe("giữ đơn", () => {
  it("lệch thiết kế → ON_HOLD DESIGN_MISMATCH, nhớ trạng thái trước; gỡ tay bị từ chối; kiểm lại đạt → PACKED", async () => {
    await putMockOrderOnDesignHold(PICKING);
    expect(await order(PICKING)).toMatchObject({
      status: "ON_HOLD",
      holdReason: "DESIGN_MISMATCH",
      statusBeforeHold: "PICKING",
      holdReasonPublic: "UNDER_REVIEW",
    });
    // Giữ lần hai không ghi đè trạng thái trước
    await putMockOrderOnDesignHold(PICKING);
    expect((await order(PICKING)).statusBeforeHold).toBe("PICKING");
    expect(await errorCode("POST", `/orders/${PICKING}/hold/resolution`, { note: "đã xem" })).toBe(
      "ORDER_DESIGN_HOLD_USE_REVERIFICATION",
    );
    setMockOrderStatus(PICKING, "PACKED");
    const packed = await order(PICKING);
    expect(packed).toMatchObject({ status: "PACKED", packedAt: expect.any(String) });
    expect(packed).not.toHaveProperty("holdReason");
    expect(packed).not.toHaveProperty("statusBeforeHold");
  });

  it("giữ tay rồi gỡ → về đúng trạng thái cũ; lịch sử mang lý do BE", async () => {
    await data("POST", `/orders/${READY}/hold`, { reasonCode: "ADDRESS", note: "Sai phường" });
    expect(await order(READY)).toMatchObject({
      status: "ON_HOLD",
      holdReason: "ADDRESS",
      statusBeforeHold: "READY_TO_FULFILL",
      holdNote: "Sai phường",
    });
    const resolved = await data("POST", `/orders/${READY}/hold/resolution`, { note: "Đã sửa" });
    expect(resolved.status).toBe("READY_TO_FULFILL");
    expect(resolved).not.toHaveProperty("holdReason");
    expect((await history(READY)).slice(-2)).toMatchObject([
      { from: "READY_TO_FULFILL", to: "ON_HOLD", reason: "ADDRESS: Sai phường" },
      { from: "ON_HOLD", to: "READY_TO_FULFILL", reason: "HOLD_RESOLVED_ADDRESS: Đã sửa" },
    ]);
  });

  it("thứ tự kiểm như BE: ghi chú gỡ giữ trống → 400 trước 404 / ORDER_NOT_ON_HOLD", async () => {
    expect(await errorCode("POST", "/orders/ORD-X/hold/resolution", { note: " " })).toBe(
      "VALIDATION_FAILED",
    );
    expect(await errorCode("POST", "/orders/ORD-X/hold/resolution", { note: "x" })).toBe(
      "NOT_FOUND",
    );
    expect(await errorCode("POST", `/orders/${READY}/hold/resolution`, { note: "x" })).toBe(
      "ORDER_NOT_ON_HOLD",
    );
  });

  it("giữ PAYMENT: chưa đủ tiền theo phương thức → ORDER_BALANCE_NOT_PAID; công nợ luôn gỡ được", async () => {
    // Đơn cọc chưa nhận cọc, đặt CONFIRMED qua setter của mock xuất kho (không có seed sẵn ca này)
    setMockOrderStatus(DEPOSIT_PENDING, "CONFIRMED");
    await data("POST", `/orders/${DEPOSIT_PENDING}/hold`, { reasonCode: "PAYMENT", note: "" });
    expect(
      await errorCode("POST", `/orders/${DEPOSIT_PENDING}/hold/resolution`, { note: "Chờ tiền" }),
    ).toBe("ORDER_BALANCE_NOT_PAID");
    expect((await order(DEPOSIT_PENDING)).status).toBe("ON_HOLD");

    await data("POST", `/orders/${PACKED_CREDIT}/hold`, { reasonCode: "PAYMENT", note: "" });
    const resolved = await data("POST", `/orders/${PACKED_CREDIT}/hold/resolution`, {
      note: "Đã đối soát",
    });
    expect(resolved.status).toBe("PACKED");
  });
});

describe("giữ công nợ tách biệt với lý do giữ khác", () => {
  it("seed: đơn On Hold công nợ là giữ CREDIT, không có trạng thái trước, gỡ tay → USE_APPROVAL", async () => {
    expect(await order(CREDIT_ON_HOLD)).toMatchObject({
      status: "ON_HOLD",
      paymentTerm: "CREDIT",
      holdReason: "CREDIT",
      holdReasonPublic: "AWAITING_CREDIT_APPROVAL",
    });
    expect(await order(CREDIT_ON_HOLD)).not.toHaveProperty("statusBeforeHold");
    expect(
      await errorCode("POST", `/orders/${CREDIT_ON_HOLD}/hold/resolution`, { note: "x" }),
    ).toBe("ORDER_CREDIT_HOLD_USE_APPROVAL");
    expect(await creditHoldIds()).toEqual([CREDIT_ON_HOLD]);
  });

  it("đơn CREDIT giữ vì ADDRESS KHÔNG phải giữ công nợ: không vào hàng đợi, duyệt / từ chối → 409", async () => {
    await data("POST", `/orders/${PACKED_CREDIT}/hold`, { reasonCode: "ADDRESS", note: "" });
    expect(await order(PACKED_CREDIT)).toMatchObject({
      status: "ON_HOLD",
      paymentTerm: "CREDIT",
      holdReason: "ADDRESS",
    });
    expect(await creditHoldIds()).toEqual([CREDIT_ON_HOLD]);
    expect(
      await errorCode("POST", `/orders/${PACKED_CREDIT}/credit-approval`, { note: "ok" }),
    ).toBe("ORDER_NOT_ON_CREDIT_HOLD");
    expect(
      await errorCode("POST", `/orders/${PACKED_CREDIT}/credit-rejection`, {
        action: "CANCEL",
        note: "x",
      }),
    ).toBe("ORDER_NOT_ON_CREDIT_HOLD");
    expect((await order(PACKED_CREDIT)).status).toBe("ON_HOLD");
  });

  it("lý do của hệ thống không giữ tay được (CREDIT / DESIGN_MISMATCH → 400)", async () => {
    for (const reasonCode of ["CREDIT", "DESIGN_MISMATCH"])
      expect(await errorCode("POST", `/orders/${READY}/hold`, { reasonCode })).toBe(
        "VALIDATION_FAILED",
      );
  });
});

describe("huỷ admin (AdminCancelOrderRequest — reasonCode / note / retainedPercent / agreedFee)", () => {
  it("đơn đã đóng gói rồi bị giữ vẫn không huỷ được (packedAt, không chỉ trạng thái)", async () => {
    setMockOrderStatus(READY, "PACKED");
    await data("POST", `/orders/${READY}/hold`, { reasonCode: "CUSTOMER", note: "" });
    expect((await order(READY)).status).toBe("ON_HOLD");
    expect(
      await errorCode("POST", `/orders/${READY}/admin-cancellation`, {
        reasonCode: "CUSTOMER_REQUEST",
      }),
    ).toBe("ORDER_NOT_CANCELLABLE");
  });

  it("huỷ thành công trả OrderResponse + cancellation, ghi lịch sử, xoá dữ liệu giữ", async () => {
    await data("POST", `/orders/${PICKING}/hold`, { reasonCode: "FRAUD", note: "" });
    const cancelled = await data("POST", `/orders/${PICKING}/admin-cancellation`, {
      reasonCode: "SUSPECTED_FRAUD",
      note: "Nghi gian lận",
    });
    expect(cancelled).toMatchObject({
      status: "CANCELLED",
      cancellation: { reasonCode: "SUSPECTED_FRAUD", reason: "SUSPECTED_FRAUD: Nghi gian lận" },
    });
    expect(cancelled).not.toHaveProperty("holdReason");
    expect((await history(PICKING)).at(-1)).toMatchObject({
      from: "ON_HOLD",
      to: "CANCELLED",
      reason: "SUSPECTED_FRAUD: Nghi gian lận",
    });
    expect(
      await errorCode("POST", `/orders/${PICKING}/admin-cancellation`, {
        reasonCode: "OTHER",
        note: "x",
      }),
    ).toBe("ORDER_NOT_CANCELLABLE");
  });

  it("thiếu reasonCode → 400; `reason` cũ (deprecated) vẫn được BE đọc thành mã + ghi chú", async () => {
    expect(await errorCode("POST", `/orders/${CONFIRMED_STOCK}/admin-cancellation`, {})).toBe(
      "VALIDATION_FAILED",
    );
    const legacy = await data("POST", `/orders/${CONFIRMED_STOCK}/admin-cancellation`, {
      reason: "OUT_OF_STOCK: hết phôi",
    });
    expect(legacy.cancellation).toMatchObject({
      reasonCode: "OUT_OF_STOCK",
      reason: "OUT_OF_STOCK: hết phôi",
    });
  });

  it("chưa in mà giữ phí / phần trăm → CANCELLATION_FEE_BEFORE_PRINTING; đã in thì giữ được", async () => {
    expect(
      await errorCode("POST", `/orders/${CONFIRMED_STOCK}/admin-cancellation`, {
        reasonCode: "CUSTOMER_REQUEST",
        retainedPercent: 20,
      }),
    ).toBe("CANCELLATION_FEE_BEFORE_PRINTING");
    const printing = await order(IN_PRODUCTION);
    const cancelled = await data("POST", `/orders/${IN_PRODUCTION}/admin-cancellation`, {
      reasonCode: "CUSTOMER_REQUEST",
      retainedPercent: 20,
    });
    expect((cancelled.cancellation as Json).retainedAmount).toBe(
      Math.round((Number(printing.paidAmount) * 20) / 100),
    );
  });

  it("agreedFee: không đi cùng retainedPercent; hợp lệ → feeAmount / feeReason / feeDetail", async () => {
    const agreedFee = { amount: 50_000, reason: "Đã in", detail: "Thoả thuận với khách" };
    expect(
      await errorCode("POST", `/orders/${IN_PRODUCTION}/admin-cancellation`, {
        reasonCode: "CUSTOMER_REQUEST",
        retainedPercent: 10,
        agreedFee,
      }),
    ).toBe("VALIDATION_FAILED");
    const cancelled = await data("POST", `/orders/${IN_PRODUCTION}/admin-cancellation`, {
      reasonCode: "CUSTOMER_REQUEST",
      agreedFee,
    });
    expect(cancelled.cancellation).toMatchObject({
      retainedAmount: 50_000,
      feeAmount: 50_000,
      feeReason: "Đã in",
      feeDetail: "Thoả thuận với khách",
    });
  });
});

describe("giao thất bại / đóng phần còn lại", () => {
  it("đóng phần còn lại: đóng đúng số chưa giao, lô giữ nguyên, effectiveTotal giảm, đơn theo lô", async () => {
    const before = await order(PARTIAL);
    const [line] = before.lines as Json[];
    const quantity = Number(line?.quantity);
    const shipped = Number(line?.shippedQuantity);
    expect(before.shipments).toHaveLength(1);

    const after = await data("POST", `/orders/${PARTIAL}/remainder-closure`, {
      reasonCode: "OUT_OF_STOCK",
    });
    const [afterLine] = after.lines as Json[];
    expect(after.status).toBe("SHIPPED");
    expect(afterLine).toMatchObject({
      shippedQuantity: shipped,
      cancelledQuantity: quantity - shipped,
    });
    expect(after.shipments).toEqual(before.shipments);
    expect(after.effectiveTotal).toBe(
      Number(before.totalAmount) - (quantity - shipped) * Number(line?.unitPrice),
    );
    expect((await history(PARTIAL)).at(-1)).toMatchObject({
      from: "PARTIALLY_FULFILLED",
      to: "SHIPPED",
      reason: "REMAINDER_CLOSED_OUT_OF_STOCK",
    });
  });

  it("giao thất bại cả đơn chỉ khi không có lô; lý do được giữ, rời DELIVERY_FAILED thì xoá", async () => {
    expect(
      await errorCode("POST", `/orders/${PARTIAL}/delivery-failure`, { reasonCode: "LOST" }),
    ).toBe("ORDER_DELIVERY_VIA_SHIPMENT");
    const failed = await data("POST", `/orders/${SHIPPED}/delivery-failure`, {
      reasonCode: "REFUSED",
    });
    expect(failed).toMatchObject({ status: "DELIVERY_FAILED", deliveryFailureReason: "REFUSED" });
    setMockOrderStatus(SHIPPED, "DELIVERED");
    expect(await order(SHIPPED)).not.toHaveProperty("deliveryFailureReason");
  });
});

describe("release + quyết định công nợ dùng chung store", () => {
  it("release → READY_TO_FULFILL thấy được ở list / detail / mock xuất kho / lịch sử", async () => {
    const released = await data("POST", `/orders/${CONFIRMED_STOCK}/release`, {
      warehouseId: "WH-HN-01",
    });
    expect(released).toMatchObject({ status: "READY_TO_FULFILL", warehouseId: "WH-HN-01" });
    expect(await backendOrderStatusOf(CONFIRMED_STOCK)).toBe("READY_TO_FULFILL");
    expect((await listItems("&status=READY_TO_FULFILL")).map((o) => o.orderId)).toContain(
      CONFIRMED_STOCK,
    );
    expect((await history(CONFIRMED_STOCK)).at(-1)).toMatchObject({
      from: "CONFIRMED",
      to: "READY_TO_FULFILL",
    });
    expect(
      await errorCode("POST", `/orders/${CONFIRMED_STOCK}/release`, { warehouseId: "WH-HN-01" }),
    ).toBe("ORDER_INVALID_TRANSITION");
  });

  it("release: khách nợ quá hạn → CUSTOMER_CREDIT_OVERDUE; đơn cọc chưa đủ cọc → ORDER_DEPOSIT_NOT_RECEIVED", async () => {
    expect(
      await errorCode("POST", `/orders/${OVERDUE_CUSTOMER_ORDER}/release`, {
        warehouseId: "WH-HN-01",
      }),
    ).toBe("CUSTOMER_CREDIT_OVERDUE");
    const deposit = await call("POST", `/orders/${DEPOSIT_PENDING}/release`, {
      warehouseId: "WH-HN-01",
    });
    // BR-PRD-08 (mẫu duyệt) kiểm trước cọc — đơn này có thiết kế chưa khoá
    expect(["DESIGN_SAMPLE_NOT_APPROVED", "ORDER_DEPOSIT_NOT_RECEIVED"]).toContain(
      deposit.body.errorCode,
    );
  });

  it("duyệt công nợ → CONFIRMED, xoá dữ liệu giữ, rời hàng đợi, lịch sử CREDIT_APPROVED", async () => {
    const approved = await data("POST", `/orders/${CREDIT_ON_HOLD}/credit-approval`, {
      note: "Đã xác nhận",
    });
    expect(approved.status).toBe("CONFIRMED");
    expect(approved).not.toHaveProperty("holdReason");
    expect(await creditHoldIds()).toEqual([]);
    expect((await history(CREDIT_ON_HOLD)).at(-1)).toMatchObject({
      from: "ON_HOLD",
      to: "CONFIRMED",
      reason: "CREDIT_APPROVED",
    });
  });

  it("từ chối → đặt cọc: PENDING_PAYMENT + DEPOSIT, lịch sử CREDIT_REJECTED", async () => {
    const switched = await data("POST", `/orders/${CREDIT_ON_HOLD}/credit-rejection`, {
      action: "SWITCH_TO_DEPOSIT",
      depositPercent: 50,
      note: "Khách cọc",
    });
    expect(switched).toMatchObject({ status: "PENDING_PAYMENT", paymentTerm: "DEPOSIT" });
    expect(switched).not.toHaveProperty("holdReason");
    expect((await history(CREDIT_ON_HOLD)).at(-1)).toMatchObject({ reason: "CREDIT_REJECTED" });
  });
});

describe("OrderResponse mang field của cả hai nhánh", () => {
  it("chi tiết: định danh, thanh toán, release, dòng in, số lượng theo lô, số tiền", async () => {
    const detail = await order(IN_PRODUCTION);
    expect(detail.customerId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(detail).toMatchObject({
      status: "IN_PRODUCTION",
      paymentTerm: "CREDIT",
      paymentStatus: expect.any(String),
      paidAmount: expect.any(Number),
      creditTermDays: 30,
      warehouseId: expect.any(String),
      billedAmount: 0,
      effectiveTotal: expect.any(Number),
      amountDue: expect.any(Number),
      amountDueBeforeHandover: 0,
      amountDueOnDelivery: 0,
      shipments: [],
    });
    const [line] = detail.lines as Json[];
    expect(line).toMatchObject({
      designSnapshotId: expect.any(String),
      designChecksum: expect.stringMatching(/^[0-9a-f]{64}$/),
      reservationIds: [expect.any(String)],
      shippedQuantity: 0,
      deliveredQuantity: 0,
      cancelledQuantity: 0,
    });
  });

  it("đơn cọc: depositRequired; dòng danh sách không mang lines", async () => {
    expect((await order(DEPOSIT_PENDING)).depositRequired).toEqual(expect.any(Number));
    expect((await listItems("")).every((o) => (o.lines as unknown[]).length === 0)).toBe(true);
  });
});

describe("resetOrderMockStore", () => {
  it("xoá mọi thay đổi vòng đời / công nợ / release / huỷ / đóng phần còn lại / lịch sử", async () => {
    const ids = [CONFIRMED_STOCK, CREDIT_ON_HOLD, READY, PARTIAL, PICKING];
    const fresh = await Promise.all(ids.map(order));
    const freshHistory = await Promise.all(ids.map(history));

    await data("POST", `/orders/${CONFIRMED_STOCK}/release`, { warehouseId: "WH-HN-01" });
    await data("POST", `/orders/${CREDIT_ON_HOLD}/credit-approval`, { note: "ok" });
    await data("POST", `/orders/${READY}/hold`, { reasonCode: "ADDRESS", note: "" });
    await data("POST", `/orders/${PARTIAL}/remainder-closure`, { reasonCode: "OUT_OF_STOCK" });
    await putMockOrderOnDesignHold(PICKING);

    resetOrderMockStore();
    expect(await Promise.all(ids.map(order))).toEqual(fresh);
    expect(await Promise.all(ids.map(history))).toEqual(freshHistory);
    expect(await creditHoldIds()).toEqual([CREDIT_ON_HOLD]);
  });
});
