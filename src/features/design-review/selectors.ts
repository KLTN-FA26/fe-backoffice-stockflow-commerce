/** Hàm thuần của màn duyệt thiết kế — không side effect. */

import { DESIGN_PERMISSIONS, DESIGN_SUBMISSION_ROLES } from "@/constants";

import { formatFixed } from "@/lib/format";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { Design, DesignArtifact } from "./types";

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

/** Mã rút gọn của người làm (BE chỉ trả `actorId`, không có tên). */
export function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : "Hệ thống";
}
