/**
 * Shipping — API chuyến xe (BE `DispatchController`; mọi chuyến là một xe của kế hoạch xếp xe, chỉ giao nguyên chuyến —
 * docs 09 BR-08). Base `/api/v1` đã nằm trong axios client. Xem: `fulfillment-shipments:READ`; đặt xe, quét, bàn giao
 * `fulfillment-dispatch:UPDATE`. Đặt xe / bắt đầu xếp / dỡ kiện / huỷ có kiểm soát ở `ftl-api.ts`; mã vận đơn ở
 * `waybill-api.ts`.
 *
 *   GET  /fulfillment/loads?warehouseId&status&carrierId&search&page&size   → PageResponse<LoadRow>
 *   GET  /fulfillment/loads/{id}            → Load (các lô, kiện, kiện nào đã lên xe, `version`)
 *   GET  /fulfillment/loads/{id}/manifest   → Manifest (biên bản để in)
 *   POST /fulfillment/loads/{id}/scans {scanId?, packageCode}: quét lại kiện đã lên ĐÚNG chuyến → 200
 *   DELETE /fulfillment/loads/{id}/scans/{packageId}: gỡ kiện khỏi xe trước bàn giao
 *   POST /fulfillment/loads/{id}/handover {version, carrierRepresentative, …, signed}
 * Lỗi: 400 HANDOVER_NOT_SIGNED; 404 LOAD_NOT_FOUND, PACKAGE_NOT_FOUND; 409 PACKAGE_NOT_IN_LOAD,
 * PACKAGE_ALREADY_LOADED, PACKAGE_NOT_READY, LOAD_NOT_FULLY_LOADED, LOAD_EMPTY, LOAD_WAYBILL_MISSING,
 * LOAD_HANDOVER_BLOCKED, OPTIMISTIC_LOCK, INVALID_LOAD_TRANSITION… (xem `errors.ts`).
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { beLoadPageSchema, beLoadSchema, beManifestSchema } from "./load-schemas";

import type { LoadStatus } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  HandoverLoadInput,
  Load,
  LoadRow,
  Manifest,
  ScanPackageInput,
  UnscanInput,
} from "./types";

export const LOADS_PATH = "/fulfillment/loads";

export const loadPath = (id: string) => `${LOADS_PATH}/${encodeURIComponent(id)}`;

export interface ListLoadParams extends ListQueryParams {
  page?: number;
  size?: number;
  warehouseId?: string;
  /** BE nhận MỘT trạng thái. */
  status?: LoadStatus;
  carrierId?: string;
  /** So khớp mã chuyến / biển số xe / mã kế hoạch xếp xe. */
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
      warehouseId: params.warehouseId || undefined,
      status: params.status || undefined,
      carrierId: params.carrierId || undefined,
      search: params.search?.trim() || undefined,
    },
    signal,
  });
  return beLoadPageSchema.parse(data);
}

export async function getLoad(id: string, signal?: AbortSignal): Promise<Load> {
  const { data } = await api.get<unknown>(loadPath(id), { signal });
  return beLoadSchema.parse(data);
}

/** Biên bản để in (docs 09 §3 "Biên bản bàn giao", §4.2 bước 8): chuyến, hãng, xe, mã vận đơn, lô, người nhận, kiện. */
export async function getManifest(id: string, signal?: AbortSignal): Promise<Manifest> {
  const { data } = await api.get<unknown>(`${loadPath(id)}/manifest`, { signal });
  return beManifestSchema.parse(data);
}

/** Quét một kiện lên xe theo mã nhãn — chỉ nhận kiện kế hoạch xếp lên xe này (BR-16). */
export async function scanPackage({
  loadId,
  packageCode,
  scanId,
}: ScanPackageInput): Promise<Load> {
  const { data } = await api.post<unknown>(`${loadPath(loadId)}/scans`, { scanId, packageCode });
  return beLoadSchema.parse(data);
}

/** Gỡ một kiện đã quét khỏi xe trước bàn giao. */
export async function unscanPackage({ loadId, packageId }: UnscanInput): Promise<Load> {
  const { data } = await api.delete<unknown>(
    `${loadPath(loadId)}/scans/${encodeURIComponent(packageId)}`,
  );
  return beLoadSchema.parse(data);
}

/**
 * Hai bên ký biên bản của MỘT xe (BR-15, BR-18): chuyến DISPATCHED; lô HANDED_OVER ở xe cuối chở nó. Bàn giao là tất cả
 * hoặc không: 409 LOAD_HANDOVER_BLOCKED kèm `details.orders` khi có đơn chưa được phép đi; 409 LOAD_WAYBILL_MISSING khi
 * chưa có mã vận đơn (BR-23). Gọi lại khi đã bàn giao → 200 trả nguyên chuyến.
 */
export async function handoverLoad({ loadId, version, values }: HandoverLoadInput): Promise<Load> {
  const { data } = await api.post<unknown>(`${loadPath(loadId)}/handover`, { version, ...values });
  return beLoadSchema.parse(data);
}
