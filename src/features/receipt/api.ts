/**
 * Goods receipt — API layer, khớp `GoodsReceiptController` của BE sau 4A-9 (`/goods-receipts`): danh sách, chi
 * tiết, xác nhận, huỷ. Tạo phiếu theo Đơn sản xuất + kiểm đếm (`POST /production`, `PUT /{id}/lines`) thuộc
 * SCRUM-566; tạo theo PO / không chứng từ, duyệt vượt dung sai, QC đã bị BE gỡ (4A-8, 2b).
 *
 * Base URL của env đã gồm `/api/v1` → path không ghi `v1`.
 * Parse tại biên (api-conventions §3.2): zod validate một lần ở đây, map `status` BE ↔ FE.
 */

import { PAGE_SIZE, RECEIPT_API_STATUS_BY_STATUS, RECEIPT_STATUS_BY_API } from "@/constants";
import { api } from "@/lib/api/client";

import { beGoodsReceiptPageSchema, beGoodsReceiptSchema } from "./schemas";

import type { ReceiptStatus, ReceiptTypeApi } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  GoodsReceipt,
  GoodsReceiptApiDto,
  GoodsReceiptRow,
  GoodsReceiptRowApiDto,
} from "./types";

const RECEIPTS_PATH = "/goods-receipts";

/** Spring bind `@RequestParam List<GoodsReceiptStatus> status` từ `status=A&status=B`. */
export const REPEAT_ARRAY_PARAMS = { indexes: null } as const;

/** Giờ nghiệp vụ VN — BE lọc `receivedFrom/To` theo Instant (DATE_TIME). */
const VN_OFFSET = "+07:00";

export function toReceipt(dto: GoodsReceiptApiDto): GoodsReceipt {
  return { ...dto, status: RECEIPT_STATUS_BY_API[dto.status] };
}

function toReceiptRow(dto: GoodsReceiptRowApiDto): GoodsReceiptRow {
  return { ...dto, status: RECEIPT_STATUS_BY_API[dto.status] };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** yyyy-MM-dd (ngày VN) → Instant 00:00 ngày đó. */
export function dayStartInstant(day: string): string {
  return new Date(`${day}T00:00:00.000${VN_OFFSET}`).toISOString();
}

/**
 * Mốc `receivedTo` cho "đến hết ngày `day`": BE lọc `receivedAt < receivedTo` (loại trừ —
 * GoodsReceiptRepositoryAdapter#receivedBetween) → gửi 00:00 ngày hôm sau.
 */
export function dayAfterStartInstant(day: string): string {
  return new Date(new Date(`${day}T00:00:00.000${VN_OFFSET}`).getTime() + DAY_MS).toISOString();
}

/* ── List ────────────────────────────────────────────────────────────── */

export interface ListGoodsReceiptParams extends ListQueryParams {
  /** Trang đánh số từ 0 (BE PageResponse). */
  page?: number;
  size?: number;
  status?: ReceiptStatus[];
  productionOrderId?: string;
  /** Kho của phiếu — màn Nhận hàng trong tab theo kho luôn gửi kho trên URL (BE `GoodsReceiptSearch.Criteria`). */
  warehouseId?: string;
  /** Bỏ trống: mọi loại. Phiếu hàng hoàn có màn riêng (`features/return`). */
  receiptType?: ReceiptTypeApi;
  /** BE so khớp số phiếu (`GoodsReceiptSearch.Criteria.number`). */
  search?: string;
  /** yyyy-MM-dd theo giờ VN. */
  receivedFrom?: string;
  receivedTo?: string;
  /** `field,asc|desc` — BE SortWhitelist chỉ nhận receivedAt / receiptNumber / status. */
  sort?: string;
}

export async function listGoodsReceipts(
  params: ListGoodsReceiptParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<GoodsReceiptRow>> {
  const { data } = await api.get<unknown>(RECEIPTS_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.md,
      status: params.status?.map((status) => RECEIPT_API_STATUS_BY_STATUS[status]),
      productionOrderId: params.productionOrderId || undefined,
      warehouseId: params.warehouseId || undefined,
      receiptType: params.receiptType,
      search: params.search?.trim() || undefined,
      receivedFrom: params.receivedFrom ? dayStartInstant(params.receivedFrom) : undefined,
      receivedTo: params.receivedTo ? dayAfterStartInstant(params.receivedTo) : undefined,
      sort: params.sort?.trim() || undefined,
    },
    paramsSerializer: REPEAT_ARRAY_PARAMS,
    signal,
  });
  const page = beGoodsReceiptPageSchema.parse(data);
  return { ...page, items: page.items.map(toReceiptRow) };
}

/* ── Detail ──────────────────────────────────────────────────────────── */

export const receiptPath = (id: string) => `${RECEIPTS_PATH}/${encodeURIComponent(id)}`;

export async function postReceipt(path: string, body?: unknown): Promise<GoodsReceipt> {
  const { data } = await api.post<unknown>(path, body);
  return toReceipt(beGoodsReceiptSchema.parse(data));
}

export async function getGoodsReceipt(id: string, signal?: AbortSignal): Promise<GoodsReceipt> {
  const { data } = await api.get<unknown>(receiptPath(id), { signal });
  return toReceipt(beGoodsReceiptSchema.parse(data));
}

/* ── Chốt phiếu ──────────────────────────────────────────────────────── */

/**
 * Xác nhận phiếu theo Đơn sản xuất: thùng thành tồn Inbound, Đơn sản xuất cập nhật tiến độ, phiếu sang In Putaway
 * (docs 03 §4.1 bước 6–7). Phiếu mua hàng cũ BE trả `INVALID_RECEIPT_TRANSITION`.
 */
export const confirmGoodsReceipt = (receiptId: string) =>
  postReceipt(`${receiptPath(receiptId)}/confirmation`);

/** BR-05 (docs 03 §6): chỉ huỷ được phiếu Draft. */
export const cancelGoodsReceipt = (receiptId: string) =>
  postReceipt(`${receiptPath(receiptId)}/cancellation`);
