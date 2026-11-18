/**
 * Hợp đồng mua bán của đơn — API layer (BE `SalesContractController`, `/orders/{orderId}/contract`,
 * origin/develop 438fe6fb). Parse tại biên. Mọi lệnh ghi gửi `version` đang hiển thị (OPTIMISTIC_LOCK).
 */

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import {
  downloadLinkDtoSchema,
  paymentPlanSuggestionDtoSchema,
  salesContractDtoSchema,
  salesContractHistoryDtoSchema,
} from "./sales-contract-schemas";

import type { ContractDraftBody } from "./sales-contract-form";
import type { PaymentPlanSuggestion, SalesContract } from "./sales-contract-schemas";

const contractPath = (orderId: string, suffix = "") =>
  `/orders/${encodeURIComponent(orderId)}/contract${suffix}`;

/** `null` = đơn chưa có hợp đồng (404 `SALES_CONTRACT_NOT_FOUND`) → hiện nút "Lập hợp đồng". */
export async function getSalesContract(
  orderId: string,
  signal?: AbortSignal,
): Promise<SalesContract | null> {
  try {
    const { data } = await api.get<unknown>(contractPath(orderId), { signal });
    return salesContractDtoSchema.parse(data);
  } catch (error) {
    if (error instanceof ApiError && error.code === "SALES_CONTRACT_NOT_FOUND") return null;
    throw error;
  }
}

/** Mọi bản hợp đồng của đơn, kể cả bản đã huỷ. */
export async function getSalesContractHistory(orderId: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(contractPath(orderId, "/history"), { signal });
  return salesContractHistoryDtoSchema.parse(data);
}

/** Lập nháp: body rỗng → BE dùng mặc định (1 đợt giao toàn bộ, lịch thanh toán mặc định của khách). */
export async function createSalesContract(input: { orderId: string }): Promise<SalesContract> {
  const { data } = await api.post<unknown>(contractPath(input.orderId), {});
  return salesContractDtoSchema.parse(data);
}

export async function editSalesContract(input: {
  orderId: string;
  version: number;
  body: ContractDraftBody;
}): Promise<SalesContract> {
  const { data } = await api.put<unknown>(contractPath(input.orderId), {
    version: input.version,
    ...input.body,
  });
  return salesContractDtoSchema.parse(data);
}

/** Gợi ý số tiền theo đợt giao — không lưu. */
export async function getPaymentPlanSuggestion(orderId: string): Promise<PaymentPlanSuggestion> {
  const { data } = await api.get<unknown>(contractPath(orderId, "/payment-plan-suggestion"));
  return paymentPlanSuggestionDtoSchema.parse(data);
}

export async function sendSalesContract(input: {
  orderId: string;
  version: number;
}): Promise<SalesContract> {
  const { data } = await api.post<unknown>(contractPath(input.orderId, "/sending"), {
    version: input.version,
  });
  return salesContractDtoSchema.parse(data);
}

/** Ghi nhận đã ký — multipart `file`, `version`, `signedOn=YYYY-MM-DD`; Idempotency-Key chống bấm 2 lần. */
export async function signSalesContract(input: {
  orderId: string;
  version: number;
  signedOn: string;
  file: File;
  idempotencyKey?: string;
}): Promise<SalesContract> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("version", String(input.version));
  form.append("signedOn", input.signedOn);
  const { data } = await api.post<unknown>(
    contractPath(input.orderId, "/signature"),
    form,
    idempotencyRequestConfig(input.idempotencyKey),
  );
  return salesContractDtoSchema.parse(data);
}

export async function cancelSalesContract(input: {
  orderId: string;
  version: number;
  reason: string;
}): Promise<SalesContract> {
  const { data } = await api.post<unknown>(contractPath(input.orderId, "/cancellation"), {
    version: input.version,
    reason: input.reason,
  });
  return salesContractDtoSchema.parse(data);
}

/** PDF bản nháp. */
export async function getContractPreview(orderId: string): Promise<Blob> {
  const { data } = await api.get<Blob>(contractPath(orderId, "/preview"), {
    responseType: "blob",
    headers: { Accept: "application/pdf, application/json" },
  });
  return data;
}

/** `document` = bản đã gửi; `signed-file` = bản đã ký. */
export async function getContractLink(orderId: string, which: "document" | "signed-file") {
  const { data } = await api.get<unknown>(contractPath(orderId, `/${which}`));
  return downloadLinkDtoSchema.parse(data);
}
