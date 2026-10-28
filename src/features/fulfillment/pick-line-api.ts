/**
 * Dòng lấy hàng — API layer, khớp BE `FulfillmentController` (SCRUM-267/274/275, báo thiếu + phân bổ lại
 * BE PR #147). Parse tại biên (api-conventions §3.2); status BE → tên Title Case. Mọi thao tác ghi gửi
 * `Idempotency-Key` (`lib/api/idempotency`) để bấm lại an toàn.
 */

import { PICK_LINE_LIMITS, PICK_LINE_STATUS_BY_API } from "@/constants";
import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { bePickLinePageSchema, bePickLineSchema } from "./pick-line-schemas";

import type {
  ConfirmPickLineInput,
  PickLine,
  PickLineApiDto,
  ReallocateShortLineInput,
  ReportShortPickInput,
} from "./types";

const linesPath = (taskId: string) => `/fulfillment/tasks/${encodeURIComponent(taskId)}/pick-lines`;
const linePath = (taskId: string, lineId: string) =>
  `${linesPath(taskId)}/${encodeURIComponent(lineId)}`;

export function toPickLine(dto: PickLineApiDto): PickLine {
  return { ...dto, status: PICK_LINE_STATUS_BY_API[dto.status] };
}

const parseLine = (data: unknown) => toPickLine(bePickLineSchema.parse(data));

/**
 * Mọi dòng của một task theo lộ trình (BE sắp `sequenceNo`). Một trang tối đa 200 dòng
 * (Pages.MAX_PAGE_SIZE); task dài hơn thì tải tiếp các trang sau — màn cần đủ dòng để tính tiến độ.
 */
export async function listPickLines(taskId: string, signal?: AbortSignal): Promise<PickLine[]> {
  const lines: PickLine[] = [];
  for (let page = 0; ; page += 1) {
    const { data } = await api.get<unknown>(linesPath(taskId), {
      params: { page, size: PICK_LINE_LIMITS.pageSize },
      signal,
    });
    const parsed = bePickLinePageSchema.parse(data);
    lines.push(...parsed.items.map(toPickLine));
    if (!parsed.hasNext) return lines;
  }
}

/**
 * Xác nhận một dòng: vị trí → SKU / barcode → số lượng (phải bằng đúng phân bổ). Chỉ người được
 * gán; BE kiểm và trừ tồn cùng transaction. Gửi lại đúng nội dung cho dòng đã lấy → 200 như cũ.
 */
export async function confirmPickLine({
  taskId,
  lineId,
  values,
  idempotencyKey,
}: ConfirmPickLineInput): Promise<PickLine> {
  const { data } = await api.post<unknown>(
    `${linePath(taskId, lineId)}/confirmation`,
    values,
    idempotencyRequestConfig(idempotencyKey),
  );
  return parseLine(data);
}

/**
 * Báo thiếu: người được gán đứng ở vị trí của dòng, tìm thấy `foundQuantity` (< phân bổ). Dòng → SHORT,
 * không trừ tồn, đơn tạm giữ (lý do INVENTORY) tới khi phân bổ lại. Lặp lại cùng báo thiếu → 200 như cũ.
 */
export async function reportShortPick({
  taskId,
  lineId,
  values,
  idempotencyKey,
}: ReportShortPickInput): Promise<PickLine> {
  const { data } = await api.post<unknown>(
    `${linePath(taskId, lineId)}/short`,
    values,
    idempotencyRequestConfig(idempotencyKey),
  );
  return parseLine(data);
}

/**
 * Phân bổ lại một dòng SHORT sang bin khác còn hàng (FEFO, không dùng lại bin thiếu): dòng cũ → CANCELLED,
 * trả các dòng OPEN mới ở cuối lộ trình. Không đủ hàng → 409 INSUFFICIENT_STOCK, không đổi gì.
 */
export async function reallocateShortLine({
  taskId,
  lineId,
  idempotencyKey,
}: ReallocateShortLineInput): Promise<PickLine[]> {
  const { data } = await api.post<unknown>(
    `${linePath(taskId, lineId)}/reallocation`,
    undefined,
    idempotencyRequestConfig(idempotencyKey),
  );
  return bePickLineSchema.array().parse(data).map(toPickLine);
}
