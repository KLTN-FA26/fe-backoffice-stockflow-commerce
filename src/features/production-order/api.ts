/**
 * Lệnh sản xuất — API layer (BE local integration d215f6e). Parse tại biên.
 * BE khoá dòng LSX (SELECT … FOR UPDATE) thay cho `version` → thao tác cũ nhận 409
 * INVALID_PRODUCTION_TRANSITION; màn hình tải lại.
 */

import { api } from "@/lib/api/client";

import {
  dashboardDtoSchema,
  materialIssueDtoSchema,
  materialIssueResultDtoSchema,
  printFileDtoSchema,
  productionDetailDtoSchema,
  productionPageDtoSchema,
  qcRoundDtoSchema,
  scrapDtoSchema,
} from "./schemas";
import { BASE, byId, getList, act } from "./http";

import type { ProductionApiStatus, ProductionOrderType } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  HoldReason,
  ProductionDashboard,
  ProductionDetail,
  ProductionRow,
  ScrapReason,
} from "./types";

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

/**
 * Quét xuất phôi: `requestId` là khoá idempotent — bấm lại / mạng chập chờn không xuất trùng.
 * `scannedLocation` / `scannedCode` (BE PR #109, SCRUM-409/410): vị trí nguồn và SKU / mã vạch quét được —
 * BE so với phiếu giữ TRƯỚC khi chuyển (ISSUE_LOCATION_MISMATCH / ISSUE_ITEM_MISMATCH); bỏ trống thì phiếu
 * giữ tự quyết như trước.
 */
export async function issueMaterial(i: {
  id: string;
  requestId: string;
  toLocation: string;
  reservationId?: string;
  scannedLocation?: string;
  scannedCode?: string;
}) {
  const { data } = await api.post<unknown>(`${byId(i.id)}/material-issues`, {
    requestId: i.requestId,
    toLocation: i.toLocation,
    ...(i.reservationId ? { reservationId: i.reservationId } : {}),
    ...(i.scannedLocation ? { scannedLocation: i.scannedLocation } : {}),
    ...(i.scannedCode ? { scannedCode: i.scannedCode } : {}),
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
