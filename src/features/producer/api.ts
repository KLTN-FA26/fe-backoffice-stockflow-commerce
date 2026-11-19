/**
 * Danh mục đơn vị sản xuất (kltn-docs 17 §4.3), base `/api/v1` — BE `ProducerController`:
 *
 *   GET  /producers?q&status&page&size&sort → PageResponse<Producer>  (sales-producers:READ; sắp theo tên)
 *   GET  /producers/{id}                    → Producer                 (404 PRODUCER_NOT_FOUND)
 *   POST /producers                         → 201 Producer             (:CREATE; 409 PRODUCER_CODE_TAKEN)
 *   PUT  /producers/{id} {…, status, version} → Producer               (:UPDATE; 409 OPTIMISTIC_LOCK; mã không đổi)
 *
 * Không có xoá: ngừng dùng = `status: INACTIVE` (đơn vị INACTIVE không nhận Đơn sản xuất mới — PRODUCER_INACTIVE).
 */

import { PAGE_SIZE, PRODUCTION_LIMITS } from "@/constants";
import { api } from "@/lib/api/client";

import { producerDto, producerPageDto } from "./schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { Producer, ProducerBody, ProducerFormValues, UpdateProducerInput } from "./types";

export const PRODUCERS_PATH = "/producers";
const producerPath = (id: string) => `${PRODUCERS_PATH}/${encodeURIComponent(id)}`;

export interface ListProducerParams extends ListQueryParams {
  /** Tìm trong mã hoặc tên. */
  q?: string;
  status?: Producer["status"];
}

export async function listProducers(
  params: ListProducerParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Producer>> {
  const { data } = await api.get<unknown>(PRODUCERS_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.md,
      q: params.q?.trim() || undefined,
      status: params.status || undefined,
    },
    signal,
  });
  return producerPageDto.parse(data);
}

export async function getProducer(id: string, signal?: AbortSignal): Promise<Producer> {
  const { data } = await api.get<unknown>(producerPath(id), { signal });
  return producerDto.parse(data);
}

export async function createProducer(body: ProducerBody): Promise<Producer> {
  const { data } = await api.post<unknown>(PRODUCERS_PATH, body);
  return producerDto.parse(data);
}

export async function updateProducer({ id, body }: UpdateProducerInput): Promise<Producer> {
  const { data } = await api.put<unknown>(producerPath(id), body);
  return producerDto.parse(data);
}

const optional = (value: string) => (value === "" ? undefined : value);

/** Giá trị form đã kiểm → body BE. Ô trống gửi vắng (BE coi như không có); thời gian SX trống → BE dùng 14 ngày. */
export function producerBodyOf(values: ProducerFormValues, existing?: Producer): ProducerBody {
  const common: ProducerBody = {
    name: values.name,
    channel: values.channel,
    email: optional(values.email),
    contactName: optional(values.contactName),
    contactPhone: optional(values.contactPhone),
    standardLeadDays:
      values.standardLeadDays === ""
        ? PRODUCTION_LIMITS.leadDaysDefault
        : Number(values.standardLeadDays),
    note: optional(values.note),
  };
  if (existing) return { ...common, status: values.status, version: existing.version };
  return { ...common, code: values.code.toUpperCase() };
}

/** Bản ghi → giá trị form (sửa). */
export function producerFormValuesOf(producer?: Producer): ProducerFormValues {
  return {
    code: producer?.code ?? "",
    name: producer?.name ?? "",
    channel: producer?.channel ?? "EMAIL",
    email: producer?.email ?? "",
    contactName: producer?.contactName ?? "",
    contactPhone: producer?.contactPhone ?? "",
    standardLeadDays: producer
      ? String(producer.standardLeadDays)
      : String(PRODUCTION_LIMITS.leadDaysDefault),
    note: producer?.note ?? "",
    status: producer?.status ?? "ACTIVE",
  };
}
