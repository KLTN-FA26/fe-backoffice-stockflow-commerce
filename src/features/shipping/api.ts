/**
 * Shipping — API chuyến xe (load) theo CONTRACT ĐỀ XUẤT cho BE SCRUM-288.
 *
 * ASSUMPTION: chờ BE SCRUM-288 — đề xuất gửi BE (resource quyền `fulfillment-shipments` đã seed):
 *   GET  /fulfillment/loads?status&search&page&size   → PageResponse<LoadRow>     (READ)
 *   GET  /fulfillment/loads/{id}                       → Load (kèm lines, manifest) (READ)
 *   POST /fulfillment/loads/{id}/loading-start         VEHICLE_BOOKED → LOADING     (UPDATE)
 *   POST /fulfillment/loads/{id}/scans {packageCode}   → Load; IDEMPOTENT: quét lại kiện đã lên
 *        ĐÚNG chuyến này → 200 trả chuyến hiện tại. 409 PACKAGE_NOT_IN_LOAD (không thuộc chuyến),
 *        PACKAGE_ALREADY_LOADED (đã lên xe chuyến khác); 404 PACKAGE_NOT_FOUND       (UPDATE)
 *   POST /fulfillment/loads/{id}/handover {version, carrierRepresentative, note, signed}
 *        header `Idempotency-Key` (BE `common/idempotency`, như PO / Shelf / Design): bàn giao
 *        sinh manifest + outbox event — gửi lại cùng key (mạng chập chờn) không bàn giao hai lần.
 *        → Load DISPATCHED; 409 LOAD_NOT_FULLY_LOADED / OPTIMISTIC_LOCK; 400 khi `signed`
 *        ≠ true (guard "manifest signed" của 03 §11). BE: shipment → HANDED_OVER, publish
 *        ShipmentDispatched → order SHIPPED khi mọi kiện của đơn đã bàn giao (BR-03) — bất đồng
 *        bộ qua outbox (04c F-SHP bước 05–06)                                       (UPDATE)
 * Lỗi chung mọi thao tác: 409 INVALID_LOAD_TRANSITION (sai trạng thái chuyến), 404 LOAD_NOT_FOUND,
 * 403 OUT_OF_DATA_SCOPE (không phụ trách kho), 400 VALIDATION_FAILED (`fieldErrors` theo field).
 * Phạm vi kho: BE lọc theo kho được phân công (WarehouseScope, như lệnh chuyển kho) — BE hiện không
 * đọc header `X-Warehouse-Id`. Cần chốt với BE: `/loading-start` riêng (03 §11 "xe đến") hay lần quét
 * đầu tự chuyển LOADING (04c F-SHP bước 04). Base URL đã gồm `/api/v1`.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { beLoadPageSchema, beLoadSchema } from "./schemas";

import type { LoadStatus } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { HandoverLoadInput, Load, LoadRow, ScanPackageInput } from "./types";

export const LOADS_PATH = "/fulfillment/loads";

const REPEAT_ARRAY_PARAMS = { indexes: null } as const;

export const loadPath = (id: string) => `${LOADS_PATH}/${encodeURIComponent(id)}`;

export interface ListLoadParams extends ListQueryParams {
  page?: number;
  size?: number;
  status?: LoadStatus[];
  /** So khớp số chuyến / biển số xe. */
  search?: string;
}

export async function listLoads(
  params: ListLoadParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<LoadRow>> {
  const { data } = await api.get<unknown>(LOADS_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.md,
      status: params.status?.length ? params.status : undefined,
      search: params.search?.trim() || undefined,
    },
    paramsSerializer: REPEAT_ARRAY_PARAMS,
    signal,
  });
  return beLoadPageSchema.parse(data);
}

export async function getLoad(id: string, signal?: AbortSignal): Promise<Load> {
  const { data } = await api.get<unknown>(loadPath(id), { signal });
  return beLoadSchema.parse(data);
}

const IDEMPOTENCY_HEADER = "Idempotency-Key";

async function postLoad(
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<Load> {
  const { data } = headers
    ? await api.post<unknown>(path, body, { headers })
    : await api.post<unknown>(path, body);
  return beLoadSchema.parse(data);
}

/** Xe đã đến dock: VEHICLE_BOOKED → LOADING. */
export const startLoading = (loadId: string) => postLoad(`${loadPath(loadId)}/loading-start`);

/** Quét một kiện lên xe — BE chặn kiện không thuộc chuyến (F-SHP bước 04). */
export const scanPackage = ({ loadId, packageCode }: ScanPackageInput) =>
  postLoad(`${loadPath(loadId)}/scans`, { packageCode });

/** Bàn giao: chuyến → DISPATCHED, ghi biên bản. Không gửi mã vận đơn (hãng bên thứ ba). */
export const handoverLoad = ({ loadId, version, values, idempotencyKey }: HandoverLoadInput) =>
  postLoad(
    `${loadPath(loadId)}/handover`,
    {
      version,
      carrierRepresentative: values.carrierRepresentative,
      note: values.note || undefined,
      // Xác nhận hai bên đã ký biên bản giấy — BE re-check guard "manifest signed" (03 §11)
      signed: values.signed,
    },
    { [IDEMPOTENCY_HEADER]: idempotencyKey },
  );
