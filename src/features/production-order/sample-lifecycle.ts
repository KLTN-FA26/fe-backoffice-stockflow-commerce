/**
 * Vòng mẫu in — nút nào hiện (kltn-docs 17 §4.3 bước 9, §5.3, BR-24; khớp BE `SampleRounds#open`):
 * - vòng 1: Đơn sản xuất `Accepted`, có cờ duyệt mẫu, chưa có vòng nào → `Sample Pending`;
 * - vòng in lại: `Sample Pending` và vòng gần nhất khách "yêu cầu in lại" — bắt buộc lý do in lại;
 * - thêm ảnh / video, ghi ngày gửi mẫu vật: chỉ vòng đang chờ khách.
 * Khách trả lời ở storefront (SCRUM-764), không có ở đây. UI-only — Backend phải re-check (production-orders:UPDATE).
 */

import { PRODUCTION_ORDER_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { SampleRound, SampleRounds } from "./sample-schemas";

export interface SampleRoundActions {
  openFirst: boolean;
  openReprint: boolean;
  /** Vòng đang chờ khách — đích của thêm tệp / ghi ngày gửi mẫu vật. */
  waitingRound: SampleRound | null;
}

export const latestRound = (rounds: readonly SampleRound[]): SampleRound | null =>
  rounds.reduce<SampleRound | null>(
    (latest, round) => (!latest || round.roundNo > latest.roundNo ? round : latest),
    null,
  );

export function sampleRoundActions(
  view: Pick<SampleRounds, "status" | "sampleApprovalRequired" | "rounds" | "waitingRoundId">,
  can: (code: PermissionCode) => boolean,
): SampleRoundActions {
  const update = can(PRODUCTION_ORDER_PERMISSIONS.update);
  if (!update || !view.sampleApprovalRequired)
    return { openFirst: false, openReprint: false, waitingRound: null };
  const latest = latestRound(view.rounds);
  const waiting = view.rounds.find((round) => round.id === view.waitingRoundId) ?? null;
  return {
    openFirst: view.status === "ACCEPTED" && latest === null,
    openReprint: view.status === "SAMPLE_PENDING" && latest?.result === "REPRINT_REQUESTED",
    waitingRound: view.status === "SAMPLE_PENDING" ? waiting : null,
  };
}

/**
 * Mở vòng này có làm số vòng tính phí vượt số lần miễn phí không (14 BR-18; docs 17 §4.3 bước 9) — chỉ để cảnh báo
 * trước, không chặn. Vòng 1 và vòng "khách đổi ý" có tính; "lỗi in" không.
 */
export function willExceedFreeRounds(
  view: Pick<SampleRounds, "freeSampleRounds" | "countedRounds">,
  counts: boolean,
): boolean {
  if (!counts || view.freeSampleRounds === null || view.freeSampleRounds === undefined)
    return false;
  return view.countedRounds + 1 > view.freeSampleRounds;
}
