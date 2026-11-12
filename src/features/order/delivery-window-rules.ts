/**
 * Dời cửa sổ giao — luật thuần của docs 17 BR-28 (UI-only; BE kiểm lại: `DeliveryBatchService#check` và ràng buộc DB).
 * Không import React / API — test thẳng.
 */

import { WINDOW_EVIDENCE_FILE, WINDOW_CHANGE_LABELS } from "@/constants";

import { WINDOW_MOVABLE_STATES } from "./delivery-batch-lifecycle";

import type { DeliveryBatch } from "./delivery-batch-api";

type WindowBatch = Pick<DeliveryBatch, "seq" | "state" | "windowStart" | "windowEnd">;

/**
 * BR-28: chỉ dời đợt CHƯA có thùng nào bàn giao. Trạng thái hiển thị (docs §5.5) `Awaiting Stock` / `Ready` là chưa
 * bàn giao thùng nào; `In Delivery` / `Delivered` đã bàn giao, `Closed` (đơn huỷ / đóng / hoàn tất) không dời nữa. Trạng
 * thái lạ → không mở nút (không đoán). BE vẫn có thể từ chối (đợt từng có chuyến hàng đã hoàn: 409
 * DELIVERY_BATCH_WINDOW_LOCKED).
 */
export function isWindowMovable(batch: Pick<DeliveryBatch, "state">): boolean {
  return batch.state !== "UNKNOWN" && WINDOW_MOVABLE_STATES.includes(batch.state);
}

/**
 * BR-28 "giữ thứ tự với các đợt khác": ngày bắt đầu hiệu lực của các đợt không giảm theo `seq`. Trả `seq` của đợt đầu
 * tiên bị phạm khi đặt cửa sổ mới của `batchId` bắt đầu `newStart` (đợt đó sẽ bắt đầu trước đợt đứng trước nó — người
 * dùng cần dời cả các đợt sau), hoặc `null` nếu hợp lệ. Cùng cách duyệt của BE `DeliveryBatchService#check`; đợt không
 * có ngày bắt đầu bị bỏ qua.
 */
export function windowOrderViolation(
  batches: readonly WindowBatch[],
  batchSeq: number,
  newStart: string,
): number | null {
  let before: string | null = null;
  for (const batch of [...batches].sort((a, b) => a.seq - b.seq)) {
    const start = batch.seq === batchSeq ? newStart : (batch.windowStart ?? null);
    if (before !== null && start !== null && start < before) return batch.seq;
    if (start !== null) before = start;
  }
  return null;
}

/** "01/12/2026 – 05/12/2026" (ngày ISO `YYYY-MM-DD` → dd/MM/yyyy, không qua `Date` nên không lệch múi giờ). */
export function formatWindowRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const day = (iso: string | null | undefined) => {
    const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
    return match ? `${match[3]}/${match[2]}/${match[1]}` : "…";
  };
  return `${day(start)} – ${day(end)}`;
}

/** Cửa sổ hiệu lực khác cửa sổ hợp đồng = đợt đã được dời. */
export function isWindowMoved(
  batch: Pick<
    DeliveryBatch,
    "contractWindowStart" | "contractWindowEnd" | "windowStart" | "windowEnd"
  >,
): boolean {
  return (
    (batch.contractWindowStart ?? null) !== (batch.windowStart ?? null) ||
    (batch.contractWindowEnd ?? null) !== (batch.windowEnd ?? null)
  );
}

/**
 * Kiểm tệp bằng chứng TRƯỚC khi xin đường tải (BE `FileCategory.DOCUMENT`: PDF / Word / Excel / JPEG / PNG ≤ 25 MB; BE kiểm
 * lại cả loại theo byte — 415 / 413). Trả câu lỗi tiếng Việt hoặc `null` nếu hợp lệ.
 */
export function evidenceFileProblem(file: Pick<File, "size" | "type">): string | null {
  const F = WINDOW_CHANGE_LABELS.file;
  if (file.size <= 0) return F.empty;
  if (file.size > WINDOW_EVIDENCE_FILE.maxBytes) return F.tooLarge;
  if (!(WINDOW_EVIDENCE_FILE.contentTypes as readonly string[]).includes(file.type)) {
    return F.typeNotAccepted;
  }
  return null;
}
