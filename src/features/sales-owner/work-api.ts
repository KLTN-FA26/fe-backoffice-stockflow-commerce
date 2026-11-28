/**
 * Khách tiềm năng, lịch người thay, yêu cầu đổi Sale — API (hợp đồng sales-owner BE-A). Parse tại biên; endpoint chưa
 * có / không quyền → `null` ở các hàm đọc.
 */

import { api } from "@/lib/api/client";
import { orUnavailable } from "@/lib/references/sales-workload";

import {
  leadHistorySchema,
  leadPageSchema,
  leadSchema,
  ownerChangeRequestPageSchema,
  staffCoverListSchema,
} from "./schemas";

import type { LeadStatus, OwnerChangeRequestStatus } from "@/constants/sales-owner";

const LEADS = "/leads";
const COVERS = "/staff-covers";
const REQUESTS = "/sales-owner-change-requests";
const one = (base: string, id: string, suffix = "") => `${base}/${encodeURIComponent(id)}${suffix}`;

/* ── Khách tiềm năng ── */

export interface LeadListParams {
  page: number;
  size: number;
  status?: LeadStatus;
  assignedTo?: string;
}

/**
 * `GET /leads` — quản lý thấy mọi lead, Sale chỉ lead được giao cho mình (BE lọc). Lỗi đi thẳng lên màn danh sách:
 * 404 / 403 hiện "Chưa dùng được" / "Không có quyền" của trang, không vỡ trang.
 */
export async function listLeads(params: LeadListParams, signal?: AbortSignal) {
  const query = new URLSearchParams({ page: String(params.page), size: String(params.size) });
  if (params.status) query.set("status", params.status);
  if (params.assignedTo) query.set("assignedTo", params.assignedTo);
  const { data } = await api.get<unknown>(LEADS, { params: query, signal });
  return leadPageSchema.parse(data);
}

const parseLead = (data: unknown) => leadSchema.safeParse(data).data ?? null;

/** `GET /leads/{id}/history` — cùng quyền xem như lead. BE chưa có / không quyền → `null`, phần lịch sử báo chưa xem được. */
export function getLeadHistory(id: string, signal?: AbortSignal) {
  return orUnavailable(async () => {
    const { data } = await api.get<unknown>(one(LEADS, id, "/history"), { signal });
    return leadHistorySchema.parse(data);
  });
}

export async function assignLead(input: { id: string; salesUserId: string }) {
  const { data } = await api.put<unknown>(one(LEADS, input.id, "/assignment"), {
    salesUserId: input.salesUserId,
  });
  return parseLead(data);
}

export async function contactLead(input: { id: string; note: string }) {
  const { data } = await api.post<unknown>(one(LEADS, input.id, "/contact"), {
    note: input.note.trim(),
  });
  return parseLead(data);
}

export async function disqualifyLead(input: { id: string; reason: string }) {
  const { data } = await api.post<unknown>(one(LEADS, input.id, "/disqualification"), {
    reason: input.reason.trim(),
  });
  return parseLead(data);
}

/* ── Lịch người thay ── */

export function listCovers(params: { userId?: string; active?: boolean }, signal?: AbortSignal) {
  return orUnavailable(async () => {
    const query = new URLSearchParams();
    if (params.userId) query.set("userId", params.userId);
    if (params.active) query.set("active", "true");
    const { data } = await api.get<unknown>(COVERS, { params: query, signal });
    return staffCoverListSchema.parse(data);
  });
}

export interface CreateCoverInput {
  userId: string;
  coverUserId: string;
  from: string;
  to: string;
  reason: string;
}

export async function createCover(input: CreateCoverInput) {
  const { data } = await api.post<unknown>(COVERS, { ...input, reason: input.reason.trim() });
  return data;
}

export async function cancelCover(id: string) {
  const { data } = await api.post<unknown>(one(COVERS, id, "/cancellation"));
  return data;
}

/* ── Yêu cầu đổi Sale ── */

/** `GET /sales-owner-change-requests` (quản lý) — lỗi đi thẳng lên màn danh sách như `listLeads`. */
export async function listOwnerChangeRequests(
  params: { page: number; size: number; status?: OwnerChangeRequestStatus },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ page: String(params.page), size: String(params.size) });
  if (params.status) query.set("status", params.status);
  const { data } = await api.get<unknown>(REQUESTS, { params: query, signal });
  return ownerChangeRequestPageSchema.parse(data);
}

/** Đồng ý → BE đổi người phụ trách với lý do `CUSTOMER_REQUEST` (BR-S15). */
export async function approveOwnerChangeRequest(input: {
  id: string;
  newSalesOwnerId: string;
  note: string;
}) {
  const { data } = await api.post<unknown>(one(REQUESTS, input.id, "/approval"), {
    newSalesOwnerId: input.newSalesOwnerId,
    note: input.note.trim(),
  });
  return data;
}

/** Từ chối — ghi chú bắt buộc: khách được trả lời lý do (§10.5 bước 4). */
export async function rejectOwnerChangeRequest(input: { id: string; note: string }) {
  const { data } = await api.post<unknown>(one(REQUESTS, input.id, "/rejection"), {
    note: input.note.trim(),
  });
  return data;
}
