/** Hàm thuần của màn duyệt thiết kế — không side effect. */

import { DESIGN_PERMISSIONS, DESIGN_SUBMISSION_ROLES } from "@/constants";

import { formatFixed } from "@/lib/format";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { Design, DesignArtifact, ReviewRound } from "./types";

type SubmissionRole = (typeof DESIGN_SUBMISSION_ROLES)[number];

export interface Submission {
  /** Bản mới nhất của mỗi role khách gửi, theo thứ tự hiển thị (role chưa có file thì vắng). */
  current: DesignArtifact[];
  /** Các file còn lại — những lần gửi trước, mới nhất trước. */
  previous: DesignArtifact[];
}

/**
 * Bộ file đang chờ duyệt. BE trả mọi file từng gửi, không có cờ "bản hiện tại" (`DesignArtifactRepositoryAdapter.java:49-54`);
 * khi chờ duyệt khách không tải thêm được file, nên bản mới nhất (`storedAt` lớn nhất) của mỗi role là bộ đang duyệt.
 */
export function currentSubmission(artifacts: readonly DesignArtifact[]): Submission {
  const newestFirst = [...artifacts].sort((a, b) => b.storedAt.localeCompare(a.storedAt));
  const byRole = new Map<SubmissionRole, DesignArtifact>();
  for (const artifact of newestFirst) {
    const role = DESIGN_SUBMISSION_ROLES.find((r) => r === artifact.role);
    if (role && !byRole.has(role)) byRole.set(role, artifact);
  }
  const current = DESIGN_SUBMISSION_ROLES.flatMap((role) => byRole.get(role) ?? []);
  const currentIds = new Set(current.map((a) => a.artifactId));
  return { current, previous: newestFirst.filter((a) => !currentIds.has(a.artifactId)) };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "chờ 2 ngày", "chờ 3 giờ", "chờ 5 phút", "vừa gửi"; `null` khi chưa gửi duyệt. */
export function waitingSince(design: Pick<Design, "reviewRequestedAt">, now: Date): string | null {
  if (!design.reviewRequestedAt) return null;
  const waited = now.getTime() - new Date(design.reviewRequestedAt).getTime();
  if (waited >= DAY) return `chờ ${Math.floor(waited / DAY)} ngày`;
  if (waited >= HOUR) return `chờ ${Math.floor(waited / HOUR)} giờ`;
  if (waited >= MINUTE) return `chờ ${Math.floor(waited / MINUTE)} phút`;
  return "vừa gửi";
}

/** Chỉ thiết kế đang chờ duyệt và người có `design-designs:APPROVE`. UI-only — BE kiểm lại (12 BR-06/BR-11). */
export function isDecidable(
  design: Pick<Design, "status">,
  can: (code: PermissionCode) => boolean,
): boolean {
  return design.status === "PENDING_REVIEW" && can(DESIGN_PERMISSIONS.approve);
}

/** Nhãn theo bảng; mã lạ (dòng lịch sử cũ…) hiện nguyên văn. */
export function labelOf(labels: Readonly<Record<string, string>>, code: string): string {
  return labels[code] ?? code;
}

const KB = 1024;
const MB = KB * KB;

/** "812,4 KB", "6,0 MB". */
export function fileSizeLabel(bytes: number): string {
  return bytes < MB ? `${formatFixed(bytes / KB, 1)} KB` : `${formatFixed(bytes / MB, 1)} MB`;
}

/**
 * Phần do người gõ trong ghi chú một dòng lịch sử, hoặc `null`. BE ghi ghi chú máy bằng tiếng Anh cho mọi loại
 * (DesignDecisionType.java): RETURNED là lý do Điều phối gõ; APPROVED là "Snapshot …, SKU …, checksum …" rồi
 * ". <ghi chú>" nếu có (DesignReviewService.java:321); các loại khác (QUOTE_REQUESTED, SUBMITTED_FOR_REVIEW,
 * PREFLIGHT_FAILED…) là chuỗi máy, không hiện.
 */
export function historyNote(entry: { decision: string; notes?: string | null }): string | null {
  const notes = entry.notes?.trim();
  if (!notes) return null;
  if (entry.decision === "RETURNED") return notes;
  if (entry.decision === "APPROVED") {
    // Dòng duyệt cũ / seed demo (vd "Đạt: 300 DPI…") không có tiền tố máy: là chữ người gõ, hiện nguyên văn.
    if (!notes.startsWith("Snapshot ")) return notes;
    const typed = /\bchecksum \S+?\. ([\s\S]+)$/.exec(notes)?.[1]?.trim();
    return typed || null;
  }
  return null;
}

/**
 * Người làm của một mốc lịch sử. BE chỉ trả `actorId` (không tên, có thể là khách hoặc nhân viên) → không hiện mảnh
 * UUID (BO-UX-6): mốc do hệ thống ghi (không `actorId`) ghi "Hệ thống", còn lại bỏ trống.
 */
export function historyActor(id: string | null): string | null {
  return id ? null : "Hệ thống";
}

/** `ApproveRoundRequest.designs` @Size(min = 1, max = 20): một lần "Duyệt tất cả" gửi tối đa chừng này thiết kế. */
export const ROUND_APPROVE_BATCH_MAX = 20;

/** Thiết kế còn chờ trong vòng (chưa có outcome, đang `PENDING_REVIEW`) ở đúng `version` đang hiển thị — body "Duyệt tất cả". */
export function pendingInRound(round: Pick<ReviewRound, "designs">): {
  id: string;
  version: number;
}[] {
  return round.designs.flatMap(({ designId, design, outcome }) =>
    outcome == null && design?.status === "PENDING_REVIEW"
      ? [{ id: designId, version: design.version }]
      : [],
  );
}

/** Đã duyệt / đã trả lại / còn chờ (chưa có outcome). */
export function roundProgress(round: Pick<ReviewRound, "designs">): {
  approved: number;
  returned: number;
  waiting: number;
} {
  const count = (outcome: "APPROVED" | "RETURNED" | null) =>
    round.designs.filter((entry) => (entry.outcome ?? null) === outcome).length;
  return { approved: count("APPROVED"), returned: count("RETURNED"), waiting: count(null) };
}
