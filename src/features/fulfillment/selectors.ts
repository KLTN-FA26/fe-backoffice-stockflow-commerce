/**
 * Fulfillment task — selectors thuần (không side effect), derive từ dữ liệu BE trả về.
 */

import { FULFILLMENT_LIMITS, PACK_STATUS } from "@/constants";

import type { FulfillmentTask, IntegrityEvidence, TaskLine } from "./types";

/** Scheme được phép mở cho URL ký của file thiết kế — chặn `javascript:` / `data:` / `blob:`… */
const ARTIFACT_URL_PROTOCOLS: readonly string[] = ["https:", "http:"];

/**
 * URL tải file thiết kế có an toàn để mở/gán vào tab không: phải là URL tuyệt đối và scheme
 * `https:` / `http:`. URL do BE trả, nhưng đây là lớp chặn cuối trước `tab.location.href`.
 */
export function isSafeArtifactUrl(url: string): boolean {
  if (!URL.canParse(url)) return false;
  return ARTIFACT_URL_PROTOCOLS.includes(new URL(url).protocol);
}

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
export function designedLines(lines: readonly TaskLine[]): readonly TaskLine[] {
  return lines.filter((line) => !!line.designSnapshotId);
}

export interface DesignLineView {
  /** Id dòng đơn hàng — tham số `{lineId}` của endpoint tải artifact. */
  lineId: string;
  /** Thiếu khi task không kèm `lines` (câu trả lời thao tác ghi — chỉ biết dòng qua evidence). */
  sku?: string;
  quantity?: number;
  /** Checksum đã khoá lúc khách chốt thiết kế — từ lần đối chiếu gần nhất (TaskLine BE không có). */
  lockedChecksum?: string;
  latestEvidence?: IntegrityEvidence;
}

/**
 * Dòng cần đối chiếu thiết kế ở trạm đóng gói: dòng in của `task.lines` (SKU / SL, SCRUM-466). TaskLine BE
 * không có checksum đã khoá → lấy `expectedChecksum` của lần đối chiếu mới nhất (chưa đối chiếu thì chưa có).
 * Task không kèm `lines` → suy từ evidence.
 */
export function designLineViews(
  task: Pick<FulfillmentTask, "integrityEvidence" | "lines">,
): readonly DesignLineView[] {
  const latest = latestEvidenceByLine(task.integrityEvidence);
  if (task.lines) {
    return designedLines(task.lines).map((line) => {
      const evidence = latest.get(line.lineId);
      return {
        lineId: line.lineId,
        sku: line.sku,
        quantity: line.quantity,
        lockedChecksum: evidence?.expectedChecksum,
        latestEvidence: evidence,
      };
    });
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
