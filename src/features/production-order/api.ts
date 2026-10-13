/**
 * Lệnh sản xuất — API layer (BE local integration d215f6e). Parse tại biên.
 * BE khoá dòng LSX (SELECT … FOR UPDATE) thay cho `version` → thao tác cũ nhận 409
 * INVALID_PRODUCTION_TRANSITION; màn hình tải lại.
 */

import { z } from "zod";

import { api } from "@/lib/api/client";

import {
  dashboardDtoSchema,
  dispatchNoteDtoSchema,
  materialIssueDtoSchema,
  materialIssueResultDtoSchema,
  printFileDtoSchema,
  productionDetailDtoSchema,
  productionPageDtoSchema,
  qcRoundDtoSchema,
  scrapDtoSchema,
  settlementDtoSchema,
  subcontractRecallDtoSchema,
  subcontractReceiptDtoSchema,
} from "./schemas";

import type { ProductionApiStatus, ProductionOrderType } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  HoldReason,
  ProductionDashboard,
  ProductionDetail,
  ProductionRow,
  ScrapReason,
  SubcontractMethod,
} from "./types";

const BASE = "/production/orders";
const byId = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export interface ListProductionParams extends ListQueryParams {
  page?: number;
  size?: number;
  search?: string;
  status?: ProductionApiStatus[];
  type?: ProductionOrderType[];
  dueFrom?: string;
  dueTo?: string;
  salesOrderId?: string;
  sampleRequestId?: string;
  /** `createdAt|dueDate|orderNumber|status,dir;…` — hàng đợi xưởng: `dueDate,asc;createdAt,asc`. */
  sort?: string;
}

export async function listProductionOrders(
  params: ListProductionParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<ProductionRow>> {
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 15),
  });
  if (params.search?.trim()) query.set("search", params.search.trim());
  for (const status of params.status ?? []) query.append("status", status);
  for (const type of params.type ?? []) query.append("type", type);
  if (params.dueFrom) query.set("dueFrom", params.dueFrom);
  if (params.dueTo) query.set("dueTo", params.dueTo);
  if (params.salesOrderId) query.set("salesOrderId", params.salesOrderId);
  if (params.sampleRequestId) query.set("sampleRequestId", params.sampleRequestId);
  if (params.sort) query.set("sort", params.sort);
  const { data } = await api.get<unknown>(BASE, { params: query, signal });
  return productionPageDtoSchema.parse(data);
}

export async function getProductionOrder(
  id: string,
  signal?: AbortSignal,
): Promise<ProductionDetail> {
  const { data } = await api.get<unknown>(byId(id), { signal });
  return productionDetailDtoSchema.parse(data);
}

async function getList<T extends z.ZodType>(path: string, schema: T, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(path, { signal });
  return z.array(schema).parse(data);
}

/** Link tải có thời hạn (presigned) — mở file thật, không tạo file giả. */
export async function getPrintFile(id: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(`${byId(id)}/print-file`, { signal });
  return printFileDtoSchema.parse(data);
}
export const listMaterialIssues = (id: string, signal?: AbortSignal) =>
  getList(`${byId(id)}/material-issues`, materialIssueDtoSchema, signal);
export const listQcRounds = (id: string, signal?: AbortSignal) =>
  getList(`${byId(id)}/qc-results`, qcRoundDtoSchema, signal);
export const listScrap = (id: string, signal?: AbortSignal) =>
  getList(`${byId(id)}/scrap`, scrapDtoSchema, signal);
export const listSubcontractReceipts = (id: string, signal?: AbortSignal) =>
  getList(`${byId(id)}/subcontract-receipts`, subcontractReceiptDtoSchema, signal);
export const listSubcontractRecalls = (id: string, signal?: AbortSignal) =>
  getList(`${byId(id)}/subcontract-recalls`, subcontractRecallDtoSchema, signal);

export async function getDispatchNote(id: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(`${byId(id)}/subcontract-dispatch-note`, { signal });
  return dispatchNoteDtoSchema.parse(data);
}
export async function getSettlement(id: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(`${byId(id)}/subcontract-settlement`, { signal });
  return settlementDtoSchema.parse(data);
}

/** QA3: kỳ báo cáo theo hoạt động thực tế (in / phế trong kỳ) — mặc định ACTIVITY. */
export async function getDashboard(
  params: { from?: string; to?: string; basis?: "ACTIVITY" | "CREATED" },
  signal?: AbortSignal,
): Promise<ProductionDashboard> {
  const query = new URLSearchParams({ basis: params.basis ?? "ACTIVITY" });
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const { data } = await api.get<unknown>("/production/dashboard", { params: query, signal });
  return dashboardDtoSchema.parse(data);
}
export async function listOverdue(signal?: AbortSignal) {
  const { data } = await api.get<unknown>("/production/dashboard/overdue", {
    params: new URLSearchParams({ page: "0", size: "20" }),
    signal,
  });
  return productionPageDtoSchema.parse(data);
}

/* ── Thao tác ────────────────────────────────────────────────────────── */

async function act(id: string, path: string, body?: object): Promise<ProductionDetail> {
  const { data } = await api.post<unknown>(`${byId(id)}/${path}`, body);
  return productionDetailDtoSchema.parse(data);
}

export const decidePrepress = (i: { id: string; decision: "PASS" | "FAIL"; note?: string }) =>
  act(i.id, "prepress", { decision: i.decision, ...(i.note ? { note: i.note } : {}) });
export const holdProduction = (i: { id: string; reason: HoldReason; note?: string }) =>
  act(i.id, "hold", { reason: i.reason, ...(i.note ? { note: i.note } : {}) });
export const resumeProduction = (id: string) => act(id, "resume");
export const startPrinting = (id: string) => act(id, "printing");

export interface ScrapLine {
  reason: ScrapReason;
  quantity: number;
  note?: string;
}
export const recordOutput = (i: { id: string; printed: number; scrap: ScrapLine[] }) =>
  act(i.id, "output", { printed: i.printed, ...(i.scrap.length ? { scrap: i.scrap } : {}) });
export const cancelProduction = (i: {
  id: string;
  reason: string;
  subcontractorFee?: number;
  subcontractorFeeReason?: string;
  packingLocation?: string;
}) => {
  const { id, ...body } = i;
  return act(id, "cancellation", body);
};
export const stopProduction = (i: {
  id: string;
  printed: number;
  scrap: ScrapLine[];
  reason: string;
}) =>
  act(i.id, "stop", {
    printed: i.printed,
    reason: i.reason,
    ...(i.scrap.length ? { scrap: i.scrap } : {}),
  });

/** Quét xuất phôi: `requestId` là khoá idempotent — bấm lại / mạng chập chờn không xuất trùng. */
export async function issueMaterial(i: {
  id: string;
  requestId: string;
  toLocation: string;
  reservationId?: string;
}) {
  const { data } = await api.post<unknown>(`${byId(i.id)}/material-issues`, {
    requestId: i.requestId,
    toLocation: i.toLocation,
    ...(i.reservationId ? { reservationId: i.reservationId } : {}),
  });
  return materialIssueResultDtoSchema.parse(data);
}

/** QC một lần duy nhất cho hàng gia công trả về (quyết định 2026-10-13). */
export async function recordQc(i: {
  id: string;
  passed: number;
  failed: number;
  note?: string;
  packingLocation?: string;
}) {
  const { id, ...body } = i;
  await api.post<unknown>(`${byId(id)}/qc-results`, body);
}

export const splitSubcontract = (i: {
  id: string;
  quantity: number;
  subcontractorId: string;
  method: SubcontractMethod;
  unitPrice: number;
  dueDate?: string;
}) => {
  const { id, ...body } = i;
  return act(id, "subcontract-split", body);
};
export const dispatchSubcontract = (id: string) => act(id, "subcontract-dispatch");
export async function reconcileReceipt(i: {
  id: string;
  receiptId: string;
  spoilt: number;
  returned: number;
  returnLocation?: string;
}) {
  const { id, receiptId, ...body } = i;
  await api.post<unknown>(
    `${byId(id)}/subcontract-receipts/${encodeURIComponent(receiptId)}/reconciliation`,
    body,
  );
}
export async function approveLoss(i: { id: string; deductionPerBlank: number; note: string }) {
  const { id, ...body } = i;
  const { data } = await api.post<unknown>(
    `${byId(id)}/subcontract-settlement/loss-approval`,
    body,
  );
  return settlementDtoSchema.parse(data);
}
