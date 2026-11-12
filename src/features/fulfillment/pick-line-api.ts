/**
 * Dòng lấy hàng — API layer, khớp BE `FulfillmentController` (docs 07 §4.2, §4.4: quét vị trí + LPN, báo thiếu
 * kèm lý do, phân bổ lại thùng). Parse tại biên (api-conventions §3.2); status BE → tên Title Case. Mọi thao tác ghi gửi
 * `Idempotency-Key` (`lib/api/idempotency`) để bấm lại an toàn.
 */

import { PICK_LINE_LIMITS, PICK_LINE_STATUS_BY_API } from "@/constants";
import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { bePickLinePageSchema, bePickLineSchema } from "./pick-line-schemas";
import { byWalkingOrder } from "./pick-line-selectors";

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
 * Mọi dòng của một task theo lộ trình đi lấy: mã vị trí rồi SKU (docs 07 §4.1 bước 2, §6 "đi theo thứ tự mã vị
 * trí"). BE sắp `sequenceNo`, nhưng dòng thêm sau khi phân bổ lại / lấy bổ sung được đánh số tiếp ở cuối nên FE sắp
 * lại theo lộ trình. Một trang tối đa 200 dòng (Pages.MAX_PAGE_SIZE); task dài hơn thì tải tiếp các trang sau —
 * màn cần đủ dòng để tính tiến độ.
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
    if (!parsed.hasNext) return lines.sort(byWalkingOrder);
  }
}

/**
 * Xác nhận một dòng: quét vị trí rồi LPN của thùng (`{locationCode, lpn}`, không có số lượng — BR-04, BR-10). Chỉ
 * người được gán; BE kiểm rồi, tuỳ đích của task, trừ tồn (DISPATCH → Picked) hoặc chuyển thùng sang khu chờ xuất
 * (STAGING → Staged) cùng transaction. Gửi lại đúng nội dung cho dòng đã lấy → 200 như cũ.
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
 * Báo thiếu thùng: người được gán đứng ở vị trí của dòng, báo `{locationCode, reason}` (NOT_FOUND | DAMAGED). Dòng →
 * SHORT cả thùng, không trừ / không chuyển tồn, đơn tạm giữ (lý do INVENTORY) và thùng vào phiếu kiểm kê mù tới
 * khi phân bổ lại. Lặp lại cùng báo thiếu → 200 như cũ.
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
 * Phân bổ lại một dòng SHORT sang thùng khác của kho (nguyên thùng, FIFO theo ngày nhập, không bao giờ lấy lại
 * thùng vừa thiếu — docs 07 §4.4 bước 10, BR-03): dòng cũ → CANCELLED, trả các dòng OPEN mới. Không đủ thùng → 409
 * INSUFFICIENT_STOCK, không đổi gì.
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
