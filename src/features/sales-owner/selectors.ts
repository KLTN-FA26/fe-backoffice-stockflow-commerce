/** Phân công khách — hàm thuần (không side effect). */

import type { SalesWorkloadRow } from "@/lib/references/sales-workload";
import type { ChatWorkloadRow, StaffCover } from "./types";

export interface BoardRow extends SalesWorkloadRow {
  openConversations: number | null;
  overdueConversations: number | null;
}

/**
 * Bảng tải (§10.4) = `GET /sales/workload` ghép `GET /chat/agents/workload` theo `userId`. Mỗi Sale đang làm một dòng
 * (theo bảng tải); số chat không có → `null` (hiện "—"), không bịa số 0.
 */
export function mergeWorkload(
  sales: readonly SalesWorkloadRow[],
  chat: readonly ChatWorkloadRow[] | null | undefined,
): BoardRow[] {
  const byUser = new Map((chat ?? []).map((row) => [row.userId, row]));
  return sales.map((row) => {
    const conversations = byUser.get(row.userId);
    return {
      ...row,
      openConversations: conversations?.openConversations ?? null,
      overdueConversations: conversations?.overdueConversations ?? null,
    };
  });
}

/** So sánh số có thể vắng: vắng xếp cuối khi tăng dần. */
export function compareNullable(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

export type CoverState = "UPCOMING" | "ACTIVE" | "ENDED" | "CANCELLED";

/**
 * Trạng thái lịch thay theo ngày (BR-S07: hết lịch tự trả về, không cần làm gì). BE trả `status` thì dùng; không thì suy
 * từ `cancelledAt` và khoảng ngày so với hôm nay (`yyyy-MM-dd`, giờ Việt Nam).
 */
export function coverState(cover: StaffCover, today: string): CoverState {
  const status = cover.status?.toUpperCase();
  if (status === "CANCELLED" || cover.cancelledAt) return "CANCELLED";
  if (cover.to < today) return "ENDED";
  if (cover.from > today) return "UPCOMING";
  return "ACTIVE";
}

export const COVER_STATE_LABELS: Record<CoverState, string> = {
  UPCOMING: "Sắp tới",
  ACTIVE: "Đang lo thay",
  ENDED: "Đã hết",
  CANCELLED: "Đã huỷ",
};

/** Hôm nay theo giờ Việt Nam, `yyyy-MM-dd`. */
export function todayInVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}
