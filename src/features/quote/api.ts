/**
 * Báo giá — API layer (BE local integration d215f6e, chưa merge develop). Parse tại biên.
 * Mọi thao tác đổi trạng thái gửi `version` vừa đọc → BE 409 OPTIMISTIC_LOCK nếu đã cũ.
 */

import { api } from "@/lib/api/client";

import { quoteDtoSchema, quotePageDtoSchema } from "./schemas";

import type { QuoteApiStatus } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { Quote, QuoteFormOutput, QuoteRow } from "./types";

const QUOTES = "/quotes";
const byId = (id: string) => `${QUOTES}/${encodeURIComponent(id)}`;

export interface ListQuoteParams extends ListQueryParams {
  page?: number;
  size?: number;
  search?: string;
  status?: QuoteApiStatus[];
  customerId?: string;
  /** `createdAt|validUntil|quoteNumber|status[,asc|desc]`. */
  sort?: string;
}

export async function listQuotes(
  params: ListQuoteParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<QuoteRow>> {
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 15),
  });
  if (params.search?.trim()) query.set("search", params.search.trim());
  for (const status of params.status ?? []) query.append("status", status);
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.sort) query.set("sort", params.sort);
  const { data } = await api.get<unknown>(QUOTES, { params: query, signal });
  return quotePageDtoSchema.parse(data);
}

export async function getQuote(id: string, signal?: AbortSignal): Promise<Quote> {
  const { data } = await api.get<unknown>(byId(id), { signal });
  return quoteDtoSchema.parse(data);
}

/** Ngày hết hiệu lực (theo giờ VN) → Instant cuối ngày. */
export function endOfDayVn(day: string): string {
  return new Date(`${day}T23:59:59+07:00`).toISOString();
}

function offerBody(values: QuoteFormOutput) {
  return {
    paymentTerm: values.paymentTerm,
    ...(values.paymentTerm === "DEPOSIT" && values.depositPercent
      ? { depositPercent: Number(values.depositPercent) }
      : {}),
    validUntil: endOfDayVn(values.validUntil),
    ...(values.terms ? { terms: values.terms } : {}),
    lines: values.lines.map((line) => ({
      blankSku: line.blankSku,
      designSnapshotId: line.designSnapshotId,
      ...(line.printSpec ? { printSpec: line.printSpec } : {}),
      quantity: Number(line.quantity),
      // Bỏ `tiers` = BE lấy bậc giá từ bảng giá khách (snapshot, không tự đổi sau này).
      ...(line.useListPrice
        ? {}
        : {
            tiers: line.tiers.map((tier) => ({
              minQuantity: Number(tier.minQuantity),
              unitPrice: Number(tier.unitPrice),
            })),
          }),
    })),
  };
}

export async function createQuote(input: {
  requestId: string;
  values: QuoteFormOutput;
}): Promise<Quote> {
  const { data } = await api.post<unknown>(QUOTES, {
    requestId: input.requestId,
    customerId: input.values.customerId,
    ...offerBody(input.values),
  });
  return quoteDtoSchema.parse(data);
}

export async function updateQuote(input: {
  id: string;
  version: number;
  values: QuoteFormOutput;
}): Promise<Quote> {
  const { data } = await api.put<unknown>(byId(input.id), {
    version: input.version,
    ...offerBody(input.values),
  });
  return quoteDtoSchema.parse(data);
}

export interface QuoteActionInput {
  id: string;
  version: number;
}

async function action(id: string, path: string, body: object): Promise<Quote> {
  const { data } = await api.post<unknown>(`${byId(id)}/${path}`, body);
  return quoteDtoSchema.parse(data);
}

export const sendQuote = ({ id, version }: QuoteActionInput) => action(id, "sending", { version });
export const reviseQuote = ({ id, version }: QuoteActionInput) =>
  action(id, "revision", { version });
export const cancelQuote = ({ id, version, reason }: QuoteActionInput & { reason: string }) =>
  action(id, "cancellation", { version, reason });
export const convertQuote = ({
  id,
  version,
  shippingAddressId,
  billingAddressId,
}: QuoteActionInput & { shippingAddressId?: string; billingAddressId?: string }) =>
  action(id, "conversion", {
    version,
    ...(shippingAddressId ? { shippingAddressId } : {}),
    ...(billingAddressId ? { billingAddressId } : {}),
  });

/** Portal khách: chấp nhận (có thể đổi SL từng dòng — BE tính lại bậc giá theo tổng phôi, P5). */
export const acceptQuote = ({
  id,
  version,
  lines,
}: QuoteActionInput & { lines?: { lineId: string; quantity: number }[] }) =>
  action(id, "acceptance", { version, ...(lines?.length ? { lines } : {}) });
export const requestQuoteChanges = ({
  id,
  version,
  feedback,
}: QuoteActionInput & { feedback: string }) => action(id, "change-request", { version, feedback });
