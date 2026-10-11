/**
 * Fulfillment task — selectors thuần (không side effect), derive từ dữ liệu BE trả về.
 */

import { FULFILLMENT_LIMITS, PACK_STATUS } from "@/constants";

import type { FulfillmentOrderLine, FulfillmentTask, IntegrityEvidence } from "./types";

/** Kiện đang bị giữ do lệch checksum thiết kế (flow X-CHK). */
export function isOnDesignHold(task: Pick<FulfillmentTask, "packStatus">): boolean {
  return task.packStatus === PACK_STATUS.ON_HOLD;
}

/**
 * Bản đối chiếu MỚI NHẤT của từng dòng đơn. Evidence là append-only (mỗi lần đóng gói / kiểm tra
 * lại thêm một bản ghi mỗi dòng) và BE trả mới nhất trước → lấy bản đầu tiên gặp của mỗi dòng.
 */
export function latestEvidenceByLine(
  evidence: readonly IntegrityEvidence[],
): ReadonlyMap<string, IntegrityEvidence> {
  const latest = new Map<string, IntegrityEvidence>();
  for (const entry of evidence) {
    if (!latest.has(entry.orderLineId)) latest.set(entry.orderLineId, entry);
  }
  return latest;
}

export type IntegrityOutcome = "unverified" | "match" | "mismatch";

/** Kết quả đối chiếu hiện tại của task: lệch nếu bản mới nhất của BẤT KỲ dòng nào lệch. */
export function integrityOutcome(
  task: Pick<FulfillmentTask, "integrityEvidence">,
): IntegrityOutcome {
  const latest = [...latestEvidenceByLine(task.integrityEvidence).values()];
  if (latest.length === 0) return "unverified";
  return latest.every((entry) => entry.matching) ? "match" : "mismatch";
}

/** Số lần BE đã chạy đối chiếu (mỗi lần ghi các bản cùng lúc cho mọi dòng có thiết kế). */
export function verificationCount(task: Pick<FulfillmentTask, "integrityEvidence">): number {
  const perLine = new Map<string, number>();
  for (const entry of task.integrityEvidence) {
    perLine.set(entry.orderLineId, (perLine.get(entry.orderLineId) ?? 0) + 1);
  }
  return Math.max(0, ...perLine.values());
}

/** Dòng tuỳ chỉnh: có thiết kế đã khoá kèm theo. */
export function designedLines(
  lines: readonly FulfillmentOrderLine[],
): readonly FulfillmentOrderLine[] {
  return lines.filter((line) => !!line.designSnapshotId);
}

export interface DesignLineView {
  /** Id dòng đơn hàng — tham số `{lineId}` của endpoint tải artifact. */
  lineId: string;
  /** Thiếu khi không đọc được đơn hàng (chỉ biết dòng qua evidence). */
  sku?: string;
  quantity?: number;
  /** Checksum đã khoá lúc khách chốt thiết kế. */
  lockedChecksum?: string;
  latestEvidence?: IntegrityEvidence;
}

/**
 * Dòng cần đối chiếu thiết kế ở trạm đóng gói. Ưu tiên dòng đơn (đủ SKU / SL); không đọc được đơn
 * thì suy từ evidence — chỉ có sau lần đóng gói đầu tiên.
 */
export function designLineViews(
  task: Pick<FulfillmentTask, "integrityEvidence">,
  orderLines: readonly FulfillmentOrderLine[] | undefined,
): readonly DesignLineView[] {
  const latest = latestEvidenceByLine(task.integrityEvidence);
  if (orderLines) {
    return designedLines(orderLines).map((line) => ({
      lineId: line.lineId,
      sku: line.sku,
      quantity: line.quantity,
      lockedChecksum: line.designChecksum ?? undefined,
      latestEvidence: latest.get(line.lineId),
    }));
  }
  return [...latest.values()].map((entry) => ({
    lineId: entry.orderLineId,
    lockedChecksum: entry.expectedChecksum,
    latestEvidence: entry,
  }));
}

/**
 * UUID rút gọn để hiện khi BE không trả mã đọc được. Lấy phần ĐUÔI: id của BE sinh theo thời gian
 * (vd `01a12aba-ed1f-70e8-…`), phần đầu là đồng hồ nên các bản ghi tạo gần nhau trùng 8 ký tự đầu;
 * phần đuôi mới là ngẫu nhiên.
 */
export function shortId(id: string): string {
  return id.slice(-FULFILLMENT_LIMITS.shortIdLength).toUpperCase();
}

/** Checksum SHA-256 rút gọn cho bảng (bản đầy đủ đặt ở `title`). */
export function shortChecksum(checksum: string): string {
  return checksum.slice(0, FULFILLMENT_LIMITS.checksumPreviewLength);
}
