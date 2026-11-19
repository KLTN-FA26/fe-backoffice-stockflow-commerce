/**
 * Đơn sản xuất (kltn-docs 17 §4.3, §5.3), base `/api/v1` — BE `ProductionOrderController` + `…DispatchController`:
 *
 *   GET  /production-orders?warehouseId&status&producerId&salesOrderId&page&size&sort  (production-orders:READ)
 *   GET  /production-orders/{id}                     → có `history`
 *   POST /production-orders {salesOrderId, deliveryBatchSeq, producerId}  (:CREATE; 409 PRODUCTION_ORDER_NOTHING_SHORT)
 *   PUT  /production-orders/{id}                     sửa nháp (:UPDATE; 409 PRODUCTION_ORDER_EXCEEDS_SHORTAGE)
 *   POST …/submission {version} · …/acceptance {version, expectedCompletionDate}
 *   POST …/production-start {version, expectedCompletionDate?} · PUT …/expected-completion-date
 *   POST …/cancellation · …/closing {version, reason}                     (:UPDATE)
 *   POST …/approval {version} · …/return {version, reason}               (:APPROVE; 409 PRODUCTION_ORDER_SELF_APPROVAL)
 *   GET  …/slip → DownloadLink · GET …/dispatch · POST …/dispatch/resend  (READ / UPDATE)
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import {
  dispatchDto,
  downloadLinkDto,
  productionOrderDto,
  productionOrderPageDto,
  salesOrderBatchesDto,
} from "./schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  DrawUpInput,
  EditInput,
  ExpectedDateInput,
  ProductionOrder,
  ProductionOrderDispatch,
  ProductionOrderStatusValue,
  ReasonInput,
  SalesOrderBatches,
  VersionInput,
} from "./types";

export const PRODUCTION_ORDERS_PATH = "/production-orders";
const orderPath = (id: string, tail = "") =>
  `${PRODUCTION_ORDERS_PATH}/${encodeURIComponent(id)}${tail}`;

export interface ListProductionOrderParams extends ListQueryParams {
  status?: ProductionOrderStatusValue;
  producerId?: string;
  warehouseId?: string;
  salesOrderId?: string;
}

export async function listProductionOrders(
  params: ListProductionOrderParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<ProductionOrder>> {
  const { data } = await api.get<unknown>(PRODUCTION_ORDERS_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.md,
      status: params.status || undefined,
      producerId: params.producerId || undefined,
      warehouseId: params.warehouseId || undefined,
      salesOrderId: params.salesOrderId || undefined,
      sort: params.sort || undefined,
    },
    signal,
  });
  return productionOrderPageDto.parse(data);
}

export async function getProductionOrder(
  id: string,
  signal?: AbortSignal,
): Promise<ProductionOrder> {
  const { data } = await api.get<unknown>(orderPath(id), { signal });
  return productionOrderDto.parse(data);
}

export async function drawUpProductionOrder(input: DrawUpInput): Promise<ProductionOrder> {
  const { data } = await api.post<unknown>(PRODUCTION_ORDERS_PATH, input);
  return productionOrderDto.parse(data);
}

export async function editProductionOrder({
  id,
  version,
  body,
}: EditInput): Promise<ProductionOrder> {
  const { data } = await api.put<unknown>(orderPath(id), { ...body, version });
  return productionOrderDto.parse(data);
}

const transition =
  <T extends VersionInput>(
    tail: string,
    body: (input: T) => object,
    method: "POST" | "PUT" = "POST",
  ) =>
  async (input: T): Promise<ProductionOrder> => {
    const url = orderPath(input.id, tail);
    const payload = { version: input.version, ...body(input) };
    const { data } =
      method === "PUT"
        ? await api.put<unknown>(url, payload)
        : await api.post<unknown>(url, payload);
    return productionOrderDto.parse(data);
  };

const none = () => ({});
const reason = (input: ReasonInput) => ({ reason: input.reason });
const expected = (input: ExpectedDateInput) => ({
  expectedCompletionDate: input.expectedCompletionDate ?? undefined,
});

export const submitProductionOrder = transition<VersionInput>("/submission", none);
export const approveProductionOrder = transition<VersionInput>("/approval", none);
export const returnProductionOrder = transition<ReasonInput>("/return", reason);
export const acceptProductionOrder = transition<ExpectedDateInput>("/acceptance", expected);
export const changeExpectedCompletion = transition<ExpectedDateInput>(
  "/expected-completion-date",
  expected,
  "PUT",
);
export const startProduction = transition<ExpectedDateInput>("/production-start", expected);
export const cancelProductionOrder = transition<ReasonInput>("/cancellation", reason);
export const closeProductionOrder = transition<ReasonInput>("/closing", reason);

/** Link vài phút tới phiếu PDF đã gửi (404 PRODUCTION_ORDER_SLIP_NOT_FOUND, 409 …_SLIP_MISMATCH). Không lưu, không log. */
export async function getSlipLink(id: string): Promise<string> {
  const { data } = await api.get<unknown>(orderPath(id, "/slip"));
  return downloadLinkDto.parse(data).url;
}

export async function getDispatch(
  id: string,
  page: number,
  signal?: AbortSignal,
): Promise<ProductionOrderDispatch> {
  const { data } = await api.get<unknown>(orderPath(id, "/dispatch"), {
    params: { page, size: PAGE_SIZE.sm },
    signal,
  });
  return dispatchDto.parse(data);
}

export async function resendDispatch(id: string): Promise<void> {
  await api.post<unknown>(orderPath(id, "/dispatch/resend"));
}

/** Số đơn bán + cửa sổ giao các đợt (`GET /orders/{id}/delivery-batches`, sales-order-delivery-batches:READ). */
export async function getSalesOrderBatches(
  salesOrderId: string,
  signal?: AbortSignal,
): Promise<SalesOrderBatches> {
  const { data } = await api.get<unknown>(
    `/orders/${encodeURIComponent(salesOrderId)}/delivery-batches`,
    { signal },
  );
  return salesOrderBatchesDto.parse(data);
}
