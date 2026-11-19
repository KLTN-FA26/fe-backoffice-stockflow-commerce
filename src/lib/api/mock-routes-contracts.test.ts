/**
 * Mock hợp đồng mua bán của đơn (WF-02 pha B) — qua axios thật + lớp api của `features/order` (hợp đồng, đơn) và
 * `features/payment` (đợt thanh toán), nên các màn hình parse được mọi body. Seed BE: `SO-20261120-900001` + hợp đồng ĐÃ
 * GỬI (khách demo, hạn mức 500 triệu, không nợ) và `SO-20261202-900002` + hợp đồng NHÁP (Trà Sữa Mây, khoản quá hạn
 * 41.195.000 đ). Ngày ghim 19/11/2026 → VAT 8%: đơn TSM 72.000.000 + 5.760.000 = 77.760.000 đ, cọc 30% 23.328.000 đ.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getOrder } from "@/features/order/api";
import {
  cancelSalesContract,
  createSalesContract,
  editSalesContract,
  getContractLink,
  getContractPreview,
  getPaymentPlanSuggestion,
  getSalesContract,
  getSalesContractHistory,
  sendSalesContract,
  signSalesContract,
} from "@/features/order/sales-contract-api";
import { salesContractDtoSchema } from "@/features/order/sales-contract-schemas";
import { getOrderInstallments } from "@/features/payment/api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import { activateMockAdapter } from "./mock-adapter";
import {
  WF02_SEED_ORDER_LINES,
  WF02_SEED_ORDERS,
  findWf02Order,
  resetWf02OrderMockStore,
} from "./mock-contract-orders";
import { resetContractMockStore } from "./mock-contract-store";
import { plan } from "./mock-contract-terms";
import { mockInstallments, resetPaymentMockStore } from "./mock-payment-store";
import { vnDay } from "./mock-quote-seed";
import { resetQuoteMockStore } from "./mock-quote-store";
import { MockRefusal } from "./mock-quote-refusal";

import type { ContractDraftBody } from "@/features/order/sales-contract-form";
import type { SalesContract } from "@/features/order/sales-contract-schemas";

const originalAdapter = api.defaults.adapter;
const DEMO = WF02_SEED_ORDERS.demo.orderId;
const TSM = WF02_SEED_ORDERS.tsm.orderId;
const TSM_LINE = WF02_SEED_ORDER_LINES.tsm;

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected request to fail");
}

async function contractOf(orderId: string): Promise<SalesContract> {
  const contract = await getSalesContract(orderId);
  if (!contract) throw new Error(`No contract for ${orderId}`);
  return contract;
}

const scan = () => new File(["%PDF-1.4 signed"], "hop-dong-da-ky.pdf", { type: "application/pdf" });

/**
 * Ghi nhận đã ký đúng hợp đồng BE (multipart `file`, `version`, `signedOn`). Không qua `signSalesContract` của feature:
 * hàm đó chưa đặt Content-Type multipart nên client (mặc định JSON) đổi FormData thành JSON — BE và mock đều trả 400
 * (xem ca cuối của khối này).
 */
async function sign(input: {
  orderId: string;
  version: number;
  signedOn: string;
  idempotencyKey?: string;
}) {
  const form = new FormData();
  form.append("file", scan());
  form.append("version", String(input.version));
  form.append("signedOn", input.signedOn);
  const { data } = await api.post<unknown>(`/orders/${input.orderId}/contract/signature`, form, {
    headers: {
      "Content-Type": "multipart/form-data",
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
    },
  });
  return salesContractDtoSchema.parse(data);
}

/** Lịch giao 2 đợt 30 + 30 thùng (cửa sổ +21, +35 ngày) như seed, lịch thanh toán tuỳ ca. */
function body(
  paymentPlan: ContractDraftBody["paymentPlan"],
  cartons = [30, 30],
): ContractDraftBody {
  return {
    freeSampleRounds: 2,
    returnWindowDays: 7,
    deliverySchedule: cartons.map((n, i) => ({
      windowStart: `2026-12-${String(10 + i * 14).padStart(2, "0")}`,
      windowEnd: `2026-12-${String(12 + i * 14).padStart(2, "0")}`,
      lines: [{ orderLineId: TSM_LINE, cartons: n }],
    })),
    paymentPlan,
  };
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T03:00:00Z"));
  activateMockAdapter();
  useAuthStore.setState({
    user: {
      userId: "USER-ACC-01",
      fullName: "T",
      email: "t@t.vn",
      roles: [],
      username: "t",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    status: "authenticated",
  });
});
beforeEach(() => {
  resetQuoteMockStore();
  resetWf02OrderMockStore();
  resetContractMockStore();
  resetPaymentMockStore();
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GET /orders/{id}/contract", () => {
  it("DS-02b: hợp đồng nháp của khách quá hạn mang cảnh báo OVERDUE; tổng và cọc theo VAT 8%", async () => {
    const contract = await contractOf(TSM);
    expect(contract).toMatchObject({ contractNumber: "HD-20261202-900002-1", status: "DRAFT" });
    expect(contract.totals).toEqual({
      netAmount: 72_000_000,
      taxAmount: 5_760_000,
      totalAmount: 77_760_000,
      currency: "VND",
    });
    expect(contract.paymentPlan.map((i) => i.amount)).toEqual([23_328_000, 27_216_000, 27_216_000]);
    expect(contract.deliverySchedule.map((b) => b.value)).toEqual([38_880_000, 38_880_000]);
    expect(contract.creditWarning).toEqual({
      outcome: "OVERDUE",
      creditLimit: 300_000_000,
      exposure: 41_195_000,
      afterDelivery: 27_216_000,
    });
  });

  it("đơn mock-data không có hợp đồng → null (404 SALES_CONTRACT_NOT_FOUND), lịch sử rỗng", async () => {
    expect(await getSalesContract("ORD-2026-0014")).toBeNull();
    expect(await getSalesContractHistory("ORD-2026-0014")).toEqual([]);
  });

  it("đơn WF-02 parse được ở màn chi tiết đơn (dòng theo thùng, trạng thái chờ ký)", async () => {
    const order = await getOrder(DEMO);
    expect(order.orderNumber).toBe("SO-20261120-900001");
    expect(order.lines[0]).toMatchObject({ cartons: 60, unitsPerCarton: 1000, quantity: 60_000 });
  });
});

describe("PUT — luật lịch giao / lịch thanh toán", () => {
  it("Σ thùng các đợt ≠ thùng dòng đơn → DELIVERY_SCHEDULE_INVALID, thông báo BE theo SKU", async () => {
    const contract = await contractOf(TSM);
    const error = await errorOf(
      editSalesContract({
        orderId: TSM,
        version: contract.version,
        body: body([{ name: "Cọc", milestone: "ON_SIGNING", percent: 100 }], [25, 30]),
      }),
    );
    expect([error.status, error.code]).toEqual([409, "DELIVERY_SCHEDULE_INVALID"]);
    expect(error.message).toBe("Lịch giao chưa hợp lệ (1 lỗi); xem chi tiết từng trường.");
    expect(error.fieldErrors?.deliverySchedule).toBe(
      "LY-GIAY-DEMO-12OZ-TSM: tổng số thùng qua các đợt giao là 55, khác số thùng của dòng đơn là 60.",
    );
  });

  it("Σ đợt ≠ tổng có thuế → PAYMENT_PLAN_INVALID; % quy ra tiền; version cũ → OPTIMISTIC_LOCK", async () => {
    const contract = await contractOf(TSM);
    const mismatch = await errorOf(
      editSalesContract({
        orderId: TSM,
        version: contract.version,
        body: body([{ name: "Cọc", milestone: "ON_SIGNING", amount: 10_000_000 }]),
      }),
    );
    expect(mismatch.code).toBe("PAYMENT_PLAN_INVALID");
    expect(mismatch.fieldErrors?.paymentPlan).toBe(
      "Tổng các đợt thanh toán là 10.000.000, khác tổng tiền đơn (có thuế) là 77.760.000.",
    );
    const saved = await editSalesContract({
      orderId: TSM,
      version: contract.version,
      body: body([
        { name: "Cọc", milestone: "ON_SIGNING", percent: 30 },
        { name: "Trước giao", milestone: "BEFORE_DELIVERY", percent: 70, deliveryBatchSeq: 1 },
      ]),
    });
    expect(saved.version).toBe(contract.version + 1);
    expect(saved.paymentPlan.map((i) => [i.percent, i.amount])).toEqual([
      [30, 23_328_000],
      [70, 54_432_000],
    ]);
    const stale = await errorOf(
      editSalesContract({ orderId: TSM, version: contract.version, body: body([]) }),
    );
    expect(stale.code).toBe("OPTIMISTIC_LOCK");
  });

  it("đợt sau giao mà khách không có hạn mức → PAYMENT_SCHEDULE_NEEDS_CREDIT", () => {
    const order = findWf02Order(TSM);
    if (!order) throw new Error("seed");
    const entry = {
      name: "Sau giao",
      milestone: "AFTER_DELIVERY" as const,
      amount: null,
      percent: 100,
      dueDays: null,
      deliveryBatchSeq: null,
    };
    try {
      plan(order, 1, [entry], false, null);
      throw new Error("Expected refusal");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(MockRefusal);
      if (error instanceof MockRefusal)
        expect(error.response.data).toMatchObject({ errorCode: "PAYMENT_SCHEDULE_NEEDS_CREDIT" });
    }
  });

  it("gợi ý theo đợt giao: phần còn lại sau cọc chia theo giá trị hàng của đợt; hợp đồng đã gửi không sửa", async () => {
    const suggestion = await getPaymentPlanSuggestion(TSM);
    expect(suggestion.totalAmount).toBe(77_760_000);
    expect(suggestion.paymentPlan.map((i) => i.amount)).toEqual([
      23_328_000, 27_216_000, 27_216_000,
    ]);
    const sent = await contractOf(DEMO);
    const error = await errorOf(
      editSalesContract({ orderId: DEMO, version: sent.version, body: body([]) }),
    );
    expect(error.code).toBe("SALES_CONTRACT_STATUS_INVALID");
  });
});

describe("gửi → ký: ba kết quả của đơn", () => {
  it("DS-02b: gửi vẫn được (cảnh báo OVERDUE); ký → đơn ON_HOLD / CREDIT, 3 đợt mở, cọc 23.328.000 đến hạn", async () => {
    const draft = await contractOf(TSM);
    const sent = await sendSalesContract({ orderId: TSM, version: draft.version });
    expect([sent.status, sent.creditWarning?.outcome]).toEqual(["SENT", "OVERDUE"]);
    expect((await getOrder(TSM)).status).toBe("Pending Contract");
    const signed = await sign({ orderId: TSM, version: sent.version, signedOn: vnDay() });
    expect([signed.status, signed.signedFileName]).toEqual(["SIGNED", "hop-dong-da-ky.pdf"]);
    const order = await getOrder(TSM);
    expect([order.status, order.holdReason]).toEqual(["On Hold", "CREDIT"]);
    const installments = await getOrderInstallments(TSM);
    expect(installments.installments.map((i) => [i.milestone, i.amount, i.status])).toEqual([
      ["ON_SIGNING", 23_328_000, "DUE"],
      ["BEFORE_DELIVERY", 27_216_000, "NOT_DUE"],
      ["AFTER_DELIVERY", 27_216_000, "NOT_DUE"],
    ]);
  });

  it("DS-02a: khách trong hạn mức, có đợt khi ký → PENDING_PAYMENT; trả đủ cọc → CONFIRMED; ký lại cùng key trả cùng bản", async () => {
    const sent = await contractOf(DEMO);
    const future = await errorOf(
      sign({ orderId: DEMO, version: sent.version, signedOn: "2026-12-31" }),
    );
    expect(future.code).toBe("VALIDATION_FAILED");
    const input = {
      orderId: DEMO,
      version: sent.version,
      signedOn: vnDay(),
      idempotencyKey: "sign-demo-1",
    };
    const signed = await sign(input);
    expect((await sign(input)).version).toBe(signed.version);
    expect((await getOrder(DEMO)).status).toBe("Pending Payment");
    for (const i of mockInstallments().filter(
      (x) => x.orderId === DEMO && x.milestone === "ON_SIGNING",
    ))
      i.paidAmount = i.amount;
    expect((await getOrder(DEMO)).status).toBe("Confirmed");
  });

  it("không có đợt khi ký và không phần trả sau giao → CONFIRMED ngay khi ký", async () => {
    const draft = await contractOf(TSM);
    const edited = await editSalesContract({
      orderId: TSM,
      version: draft.version,
      body: body([
        {
          name: "Trước giao đợt 1",
          milestone: "BEFORE_DELIVERY",
          amount: 38_880_000,
          deliveryBatchSeq: 1,
        },
        {
          name: "Trước giao đợt 2",
          milestone: "BEFORE_DELIVERY",
          amount: 38_880_000,
          deliveryBatchSeq: 2,
        },
      ]),
    });
    expect(edited.creditWarning).toBeNull();
    const sent = await sendSalesContract({ orderId: TSM, version: edited.version });
    await sign({ orderId: TSM, version: sent.version, signedOn: vnDay() });
    expect((await getOrder(TSM)).status).toBe("Confirmed");
  });

  it("`signSalesContract` gửi multipart thật → hợp đồng SIGNED (trước đây axios đổi FormData thành JSON, mất file)", async () => {
    const sent = await contractOf(DEMO);
    const signed = await signSalesContract({
      orderId: DEMO,
      version: sent.version,
      signedOn: vnDay(),
      file: scan(),
    });
    expect(signed.status).toBe("SIGNED");
  });
});

describe("huỷ và lập lại", () => {
  it("huỷ hợp đồng đã gửi → đơn về DRAFT, GET không còn hợp đồng; lập lại = HD-…-2 mặc định", async () => {
    const sent = await contractOf(DEMO);
    const cancelled = await cancelSalesContract({
      orderId: DEMO,
      version: sent.version,
      reason: "Khách muốn đổi lịch giao",
    });
    expect([cancelled.status, cancelled.cancellationReason]).toEqual([
      "CANCELLED",
      "Khách muốn đổi lịch giao",
    ]);
    expect((await getOrder(DEMO)).status).toBe("Draft");
    expect(await getSalesContract(DEMO)).toBeNull();
    const fresh = await createSalesContract({ orderId: DEMO });
    expect(fresh.contractNumber).toBe("HD-20261120-900001-2");
    expect(fresh.deliverySchedule).toHaveLength(1);
    expect(fresh.deliverySchedule[0]?.lines[0]?.cartons).toBe(60);
    expect(fresh.paymentPlan).toEqual([
      expect.objectContaining({ milestone: "ON_SIGNING", percent: 100, amount: 77_550_000 }),
    ]);
    expect((await getSalesContractHistory(DEMO)).map((c) => c.status)).toEqual([
      "CANCELLED",
      "DRAFT",
    ]);
    const exists = await errorOf(createSalesContract({ orderId: DEMO }));
    expect(exists.code).toBe("SALES_CONTRACT_EXISTS");
  });

  it("xem trước PDF; link bản đã gửi; bản đã ký chưa có → SALES_CONTRACT_STATUS_INVALID", async () => {
    expect((await getContractPreview(TSM)).type).toBe("application/pdf");
    expect((await getContractLink(DEMO, "document")).url).toContain("HD-20261120-900001-1");
    const unsigned = await errorOf(getContractLink(DEMO, "signed-file"));
    expect([unsigned.status, unsigned.code]).toEqual([409, "SALES_CONTRACT_STATUS_INVALID"]);
  });
});
