/**
 * Mock route — hợp đồng mua bán của đơn (WF-02 pha B), đúng hợp đồng BE `SalesContractController`
 * (`/orders/{orderId}/contract…`, origin/develop; plan WF02-FE Phụ lục A.2): đọc (404 `SALES_CONTRACT_NOT_FOUND` khi chưa
 * có), lịch sử, lập (200, body rỗng = mặc định), sửa nháp, gợi ý tiền theo đợt giao, gửi, ghi nhận đã ký (multipart),
 * huỷ, xem trước PDF, link tải bản đã gửi / đã ký. Đăng ký TRƯỚC route đơn hàng (`mock-routes-wf02.ts`).
 * Luật ở `mock-contract-rules.ts` / `mock-contract-terms.ts`, store ở `mock-contract-store.ts` + `mock-contract-orders.ts`.
 */

import { registerMockRoute } from "./mock-adapter";
import {
  cancelContract,
  contractOrderOrNull,
  createContract,
  editContract,
  fileKeyOf,
  loadContract,
  sendContract,
  signContract,
  suggestPlan,
} from "./mock-contract-rules";
import {
  contractView,
  creditWarningOf,
  installmentView,
  mockContracts,
} from "./mock-contract-store";
import { orderTotal } from "./mock-contract-orders";
import { guarded } from "./mock-quote-refusal";
import { bodyOf, ok, pathParams } from "./mock-route-utils";
import { mockTextPdf } from "./mock-text-pdf";

import type { AxiosRequestConfig } from "axios";
import type { Wf02Order } from "./mock-contract-orders";
import type { MockContract } from "./mock-contract-store";

const BASE = "/orders/:id/contract";
/** Link tải có hạn (BE `DownloadLink`) — 5 phút, cùng kiểu URL giả các mock tải file khác dùng. */
const LINK_TTL_MS = 300_000;

const orderIdOf = (config: AxiosRequestConfig) => pathParams(config).id ?? "";

/** Bản nháp kèm cảnh báo tín dụng của nó (14 §4.3 bước 13: Sale được báo trước khi gửi). */
const draftView = ({ order, contract }: { order: Wf02Order; contract: MockContract }) =>
  ok(
    contractView(
      contract,
      order,
      contract.status === "DRAFT" ? creditWarningOf(order, contract) : null,
    ),
  );

function idempotencyKeyOf(config: AxiosRequestConfig): string | null {
  const headers: unknown = config.headers;
  if (!headers || typeof headers !== "object") return null;
  const raw = (headers as Record<string, unknown>)["Idempotency-Key"];
  return typeof raw === "string" && raw ? raw : null;
}

export function registerContractMockRoutes(): void {
  registerMockRoute(
    "GET",
    BASE,
    guarded(async (config) => draftView(await loadContract(orderIdOf(config)))),
  );
  registerMockRoute(
    "GET",
    `${BASE}/history`,
    guarded(async (config) => {
      const order = await contractOrderOrNull(orderIdOf(config));
      if (!order) return ok([]);
      return ok(
        mockContracts()
          .filter((c) => c.orderId === order.orderId)
          .map((c) => contractView(c, order)),
      );
    }),
  );
  registerMockRoute(
    "POST",
    BASE,
    guarded(async (config) => draftView(await createContract(orderIdOf(config), bodyOf(config)))),
  );
  registerMockRoute(
    "PUT",
    BASE,
    guarded(async (config) => draftView(await editContract(orderIdOf(config), bodyOf(config)))),
  );
  registerMockRoute(
    "GET",
    `${BASE}/payment-plan-suggestion`,
    guarded(async (config) => {
      const { order, contract, plan } = await suggestPlan(orderIdOf(config));
      return ok({
        contractId: contract.id,
        version: contract.version,
        totalAmount: orderTotal(order),
        paymentPlan: plan.map(installmentView),
      });
    }),
  );
  registerMockRoute(
    "POST",
    `${BASE}/sending`,
    guarded(async (config) => {
      const { order, contract } = await sendContract(orderIdOf(config), bodyOf(config));
      // 15 BR-11: gửi vẫn được, response kèm cảnh báo lúc gửi
      return ok(contractView(contract, order, creditWarningOf(order, contract)));
    }),
  );
  registerMockRoute(
    "POST",
    `${BASE}/signature`,
    guarded(async (config) => {
      const { order, contract } = await signContract(
        orderIdOf(config),
        config.data,
        bodyOf(config),
        idempotencyKeyOf(config),
      );
      return ok(contractView(contract, order));
    }),
  );
  registerMockRoute(
    "POST",
    `${BASE}/cancellation`,
    guarded(async (config) => {
      const { order, contract } = await cancelContract(orderIdOf(config), bodyOf(config));
      return ok(contractView(contract, order));
    }),
  );
  registerMockRoute(
    "GET",
    `${BASE}/preview`,
    guarded(async (config) => {
      const { order, contract } = await loadContract(orderIdOf(config));
      const view = contractView(contract, order);
      return {
        status: 200,
        data: mockTextPdf([
          `Sales contract ${contract.contractNumber} - order ${order.orderNumber} (mock preview)`,
          `Total with VAT: ${view.totals.totalAmount} VND`,
          ...view.deliverySchedule.map(
            (b) =>
              `Batch ${b.seq}: ${b.windowStart ?? "-"} to ${b.windowEnd ?? "-"}, ${b.value} VND`,
          ),
          ...view.paymentPlan.map((i) => `Installment ${i.seq} ${i.milestone}: ${i.amount} VND`),
        ]),
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `inline; filename="${contract.contractNumber}.pdf"`,
        },
      };
    }),
  );
  for (const which of ["document", "signed-file"] as const)
    registerMockRoute(
      "GET",
      `${BASE}/${which}`,
      guarded(async (config) => {
        const key = await fileKeyOf(orderIdOf(config), which);
        return ok({
          url: `https://files.example/${key ?? ""}`,
          expiresAt: new Date(Date.now() + LINK_TTL_MS).toISOString(),
        });
      }),
    );
}
