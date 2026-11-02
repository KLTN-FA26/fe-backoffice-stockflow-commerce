/** Yêu cầu làm mẫu — API layer (BE local integration d215f6e). Parse tại biên. */

import { api } from "@/lib/api/client";

import { sampleDetailDtoSchema, samplePageDtoSchema } from "./schemas";

import type { SampleApiStatus } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { SampleCreateOutput, SampleDetail, SampleRow, SampleSpecOutput } from "./types";

const BASE = "/production/sample-requests";
const byId = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export interface ListSampleParams extends ListQueryParams {
  page?: number;
  size?: number;
  search?: string;
  status?: SampleApiStatus[];
  customerId?: string;
  /** `createdAt|dueDate|requestNumber|status[,asc|desc]`. */
  sort?: string;
}

export async function listSamples(
  params: ListSampleParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<SampleRow>> {
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 15),
  });
  if (params.search?.trim()) query.set("search", params.search.trim());
  for (const status of params.status ?? []) query.append("status", status);
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.sort) query.set("sort", params.sort);
  const { data } = await api.get<unknown>(BASE, { params: query, signal });
  return samplePageDtoSchema.parse(data);
}

export async function getSample(id: string, signal?: AbortSignal): Promise<SampleDetail> {
  const { data } = await api.get<unknown>(byId(id), { signal });
  return sampleDetailDtoSchema.parse(data);
}

function specBody(values: SampleSpecOutput) {
  return {
    designSnapshotId: values.designSnapshotId,
    blankSku: values.blankSku,
    quantity: Number(values.quantity),
    ...(values.dueDate ? { dueDate: values.dueDate } : {}),
  };
}

export async function createSample(values: SampleCreateOutput): Promise<SampleDetail> {
  const { data } = await api.post<unknown>(BASE, {
    customerId: values.customerId,
    ...(values.quoteId ? { quoteId: values.quoteId } : {}),
    ...specBody(values),
  });
  return sampleDetailDtoSchema.parse(data);
}

export async function updateSample(input: {
  id: string;
  values: SampleSpecOutput;
}): Promise<SampleDetail> {
  const { data } = await api.put<unknown>(byId(input.id), specBody(input.values));
  return sampleDetailDtoSchema.parse(data);
}

async function action(id: string, path: string, body?: object): Promise<SampleDetail> {
  const { data } = await api.post<unknown>(`${byId(id)}/${path}`, body);
  return sampleDetailDtoSchema.parse(data);
}

/** Gửi sản xuất: tạo LSX mẫu + giữ phôi ở kho đã chọn (Q1). */
export const submitSample = ({ id, warehouseId }: { id: string; warehouseId: string }) =>
  action(id, "submission", { warehouseId });
export const sendSample = (id: string) => action(id, "sending");
export const approveSample = (id: string) => action(id, "approval");
export const requestSampleChanges = ({ id, feedback }: { id: string; feedback: string }) =>
  action(id, "change-request", { feedback });
/** Vòng mẫu mới (lặp lại quy cách cũ); trả về vòng MỚI. */
export const nextSampleRound = (id: string) => action(id, "next-round");
export const cancelSample = ({ id, reason }: { id: string; reason: string }) =>
  action(id, "cancellation", { reason });
