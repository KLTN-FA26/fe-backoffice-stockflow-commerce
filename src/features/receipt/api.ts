/**
 * Goods receipt — API layer, khớp BE PR #62 (GoodsReceiptController, `/goods-receipts`).
 *
 * Base URL của env đã gồm `/api/v1` → path không ghi `v1`.
 * Parse tại biên (api-conventions §3.2): zod validate một lần ở đây, map `status` BE ↔ FE.
 */

import { PAGE_SIZE, RECEIPT_API_STATUS_BY_STATUS, RECEIPT_STATUS_BY_API } from "@/constants";
import { api } from "@/lib/api/client";

import { beGoodsReceiptPageSchema, beGoodsReceiptSchema } from "./schemas";

import type { ReceiptStatus } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  GoodsReceipt,
  GoodsReceiptApiDto,
  GoodsReceiptRow,
  GoodsReceiptRowApiDto,
  InspectLineInput,
  MoveLineToQcInput,
  ReceiptCreateValues,
  SaveReceiptLinesInput,
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

function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
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
  purchaseOrderId?: string;
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
      purchaseOrderId: params.purchaseOrderId || undefined,
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

const receiptPath = (id: string) => `${RECEIPTS_PATH}/${encodeURIComponent(id)}`;

async function postReceipt(path: string, body?: unknown): Promise<GoodsReceipt> {
  const { data } = await api.post<unknown>(path, body);
  return toReceipt(beGoodsReceiptSchema.parse(data));
}

export async function getGoodsReceipt(id: string, signal?: AbortSignal): Promise<GoodsReceipt> {
  const { data } = await api.get<unknown>(receiptPath(id), { signal });
  return toReceipt(beGoodsReceiptSchema.parse(data));
}

/* ── Kiểm đếm ────────────────────────────────────────────────────────── */

/** Tạo phiếu DRAFT cho PO (BE `CreateGoodsReceiptRequest`). */
export const createGoodsReceipt = (input: ReceiptCreateValues) =>
  postReceipt(RECEIPTS_PATH, {
    purchaseOrderId: input.purchaseOrderId,
    deliveryNote: emptyToUndefined(input.deliveryNote),
    note: emptyToUndefined(input.note),
  });

/** Thay toàn bộ kiểm đếm của phiếu DRAFT (BE `ReceiptLinesRequest`). */
export async function replaceReceiptLines({
  receiptId,
  lines,
}: SaveReceiptLinesInput): Promise<GoodsReceipt> {
  const { data } = await api.put<unknown>(`${receiptPath(receiptId)}/lines`, {
    lines: lines.map((line) => ({
      purchaseOrderLineId: line.purchaseOrderLineId,
      quantity: line.quantity,
      lotNumber: emptyToUndefined(line.lotNumber),
      expiryDate: emptyToUndefined(line.expiryDate),
      locationCode: line.locationCode,
      note: emptyToUndefined(line.note),
    })),
  });
  return toReceipt(beGoodsReceiptSchema.parse(data));
}

/** "Post": chốt số → tồn INBOUND, PO cập nhật tiến độ, phiếu sang In QC / In Putaway. */
export const confirmGoodsReceipt = (receiptId: string) =>
  postReceipt(`${receiptPath(receiptId)}/confirmation`);

/** Chỉ huỷ được DRAFT (BR-05 docs 03 §6). */
export const cancelGoodsReceipt = (receiptId: string) =>
  postReceipt(`${receiptPath(receiptId)}/cancellation`);

/* ── QC ──────────────────────────────────────────────────────────────── */

export const moveLineToQc = ({ receiptId, lineId, qcLocationCode }: MoveLineToQcInput) =>
  postReceipt(`${receiptPath(receiptId)}/lines/${encodeURIComponent(lineId)}/qc-transfer`, {
    qcLocationCode,
  });

/** BE `QcDecisionRequest`: phần SL 0 gửi `null` (BE bỏ qua phần rỗng). */
export function toQcDecisionRequest(decision: InspectLineInput["decision"]) {
  const part = ({ quantity, locationCode, reason }: InspectLineInput["decision"]["rejected"]) =>
    quantity > 0 ? { quantity, locationCode: locationCode.toUpperCase(), reason } : null;
  return {
    accepted: decision.accepted,
    quarantined: part(decision.quarantined),
    rejected: part(decision.rejected),
  };
}

export const inspectLine = ({ receiptId, lineId, decision }: InspectLineInput) =>
  postReceipt(
    `${receiptPath(receiptId)}/lines/${encodeURIComponent(lineId)}/inspection`,
    toQcDecisionRequest(decision),
  );
