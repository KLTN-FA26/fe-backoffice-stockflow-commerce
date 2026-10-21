/**
 * Shipping — API chuyến xe (BE `DispatchController`, PR #137, SCRUM-288/292). Base `/api/v1` đã nằm
 * trong axios client. Xem: `fulfillment-shipments:READ`; mở chuyến `fulfillment-dispatch:CREATE`, quét / bàn giao
 * `fulfillment-dispatch:UPDATE`, huỷ chuyến `fulfillment-load-cancellations:UPDATE` (BE PR #148).
 *
 *   GET  /fulfillment/loads?warehouseId&status&carrierId&search&page&size   → PageResponse<LoadRow>
 *   GET  /fulfillment/loads/{id}            → Load (các lô, kiện, kiện nào đã lên xe, `version`)
 *   GET  /fulfillment/loads/{id}/manifest   → Manifest (biên bản để in)
 *   POST /fulfillment/loads                 → 201 Load; idempotent theo `requestId`
 *   POST /fulfillment/loads/{id}/shipments {shipmentIds}; DELETE …/shipments/{shipmentId}
 *   POST /fulfillment/loads/{id}/scans {scanId?, packageCode}: quét lại kiện đã lên ĐÚNG chuyến → 200
 *   DELETE /fulfillment/loads/{id}/scans/{packageId}: gỡ kiện khỏi xe trước bàn giao
 *   POST /fulfillment/loads/{id}/handover {version, carrierRepresentative, …, signed}
 *   POST /fulfillment/loads/{id}/cancellation {reason}
 * Lỗi: 400 HANDOVER_NOT_SIGNED; 404 LOAD_NOT_FOUND, PACKAGE_NOT_FOUND; 409 PACKAGE_NOT_IN_LOAD,
 * PACKAGE_ALREADY_LOADED, PACKAGE_NOT_READY, PACKAGE_OTHER_CARRIER, LOAD_NOT_FULLY_LOADED, LOAD_EMPTY,
 * LABEL_OUTDATED, ORDER_BALANCE_NOT_PAID, OPTIMISTIC_LOCK, INVALID_LOAD_TRANSITION… (xem `errors.ts`).
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { beLoadPageSchema, beLoadSchema, beManifestSchema } from "./load-schemas";

import type { LoadStatus } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  CancelLoadInput,
  HandoverLoadInput,
  Load,
  LoadRow,
  LoadShipmentsInput,
  Manifest,
  OpenLoadInput,
  RemoveLoadShipmentInput,
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
  /** So khớp mã chuyến / biển số xe. */
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

/** Biên bản để in (docs 09 §4.1 bước 3): lô, người nhận, kiện, COD từng lô và tổng. */
export async function getManifest(id: string, signal?: AbortSignal): Promise<Manifest> {
  const { data } = await api.get<unknown>(`${loadPath(id)}/manifest`, { signal });
  return beManifestSchema.parse(data);
}

/**
 * Tài xế hãng tới: mở chuyến (LOADING) với các lô cho hãng đó. Gửi lại cùng `requestId` BE trả đúng
 * chuyến đã mở (kể cả hai yêu cầu cùng lúc). Không gửi `shipmentIds` = lấy các lô chờ xuất của kho
 * đã gán cho hãng này.
 */
export async function openLoad({ shipmentIds, ...input }: OpenLoadInput): Promise<Load> {
  const { data } = await api.post<unknown>(LOADS_PATH, {
    ...input,
    shipmentIds: shipmentIds?.length ? [...shipmentIds] : undefined,
  });
  return beLoadSchema.parse(data);
}

/** Đưa lô lên biên bản: chờ xuất, cùng kho, cùng hãng (hoặc chưa gán hãng). */
export async function addLoadShipments({ loadId, shipmentIds }: LoadShipmentsInput): Promise<Load> {
  const { data } = await api.post<unknown>(`${loadPath(loadId)}/shipments`, {
    shipmentIds: [...shipmentIds],
  });
  return beLoadSchema.parse(data);
}

/** Bỏ lô (cùng các kiện đã quét của nó) khỏi biên bản trước bàn giao. */
export async function removeLoadShipment({
  loadId,
  shipmentId,
}: RemoveLoadShipmentInput): Promise<Load> {
  const { data } = await api.delete<unknown>(
    `${loadPath(loadId)}/shipments/${encodeURIComponent(shipmentId)}`,
  );
  return beLoadSchema.parse(data);
}

/** Quét một kiện lên xe theo mã nhãn — chỉ nhận kiện của các lô trên biên bản (BR-03). */
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
 * Hai bên ký biên bản: chuyến DISPATCHED, các lô HANDED_OVER với COD đơn chốt. Gọi lại khi đã bàn
 * giao → 200 trả nguyên chuyến. Không gửi mã vận đơn (hãng bên thứ ba).
 */
export async function handoverLoad({ loadId, version, values }: HandoverLoadInput): Promise<Load> {
  const { data } = await api.post<unknown>(`${loadPath(loadId)}/handover`, { version, ...values });
  return beLoadSchema.parse(data);
}

/** Gọi huỷ chuyến chưa rời kho; các lô và kiện về khu chờ xuất (quản lý kho). */
export async function cancelLoad({ loadId, reason }: CancelLoadInput): Promise<Load> {
  const { data } = await api.post<unknown>(`${loadPath(loadId)}/cancellation`, { reason });
  return beLoadSchema.parse(data);
}
