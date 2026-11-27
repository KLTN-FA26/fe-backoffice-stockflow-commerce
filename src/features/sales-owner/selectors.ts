/** Phân công khách — hàm thuần (không side effect). */

import { LEAD_STATUS_LABELS } from "@/constants/labels-sales-owner";
import { SALES_OWNER_LIMITS } from "@/constants/sales-owner";

import type { LeadStatus } from "@/constants/sales-owner";
import type { SalesWorkloadRow } from "@/lib/references/sales-workload";
import type { ChatWorkloadRow, LeadHistoryEntry, StaffCover } from "./types";

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

const COVER_STATES = ["UPCOMING", "ACTIVE", "ENDED", "CANCELLED"] as const;
export type CoverState = (typeof COVER_STATES)[number];

const isCoverState = (value: string | undefined): value is CoverState =>
  COVER_STATES.some((state) => state === value);

/**
 * Trạng thái lịch thay theo ngày (BR-S07: hết lịch tự trả về, không cần làm gì). BE trả `status` (hợp đồng, phần BO-1:
 * `ACTIVE` / `UPCOMING` / `ENDED` / `CANCELLED`) thì dùng; không có hoặc lạ thì suy từ `cancelledAt` và khoảng ngày so với
 * hôm nay (`yyyy-MM-dd`, giờ Việt Nam).
 */
export function coverState(cover: StaffCover, today: string): CoverState {
  const status = cover.status?.toUpperCase();
  if (status === "CANCELLED" || cover.cancelledAt) return "CANCELLED";
  if (isCoverState(status)) return status;
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

/**
 * Chọn "mọi khách" của một Sale đang phụ trách hơn 500 khách (bảng tải): BE từ chối cả lô (BR-S09,
 * `SALES_OWNER_TRANSFER_TOO_LARGE`) → cảnh báo trước và không gửi. Không biết số khách → để BE kiểm.
 */
export function overTransferCap(
  scope: "all" | "picked",
  sourceCustomers: number | null | undefined,
): boolean {
  return scope === "all" && (sourceCustomers ?? 0) > SALES_OWNER_LIMITS.transferMax;
}

const leadStatus = (status: string | null | undefined) =>
  status ? (LEAD_STATUS_LABELS[status as LeadStatus] ?? status) : "—";

/**
 * Một dòng lịch sử lead để đọc (§10.7): `title` việc gì, `note` ghi chú / nội dung form gửi lại, `by` ai làm (vắng =
 * hệ thống: form công khai, khoá tài khoản trả lead về hàng chờ). `RESUBMITTED`: khách gửi lại form, lead không đổi.
 */
export function leadHistoryLine(entry: LeadHistoryEntry): {
  title: string;
  note: string | null;
  by: string;
} {
  const note = entry.note?.trim() || null;
  const by = entry.changedByName?.trim() || "Hệ thống";
  if (entry.kind === "RESUBMITTED") return { title: "Khách gửi lại form", note, by };
  if (!entry.fromStatus) return { title: "Khách gửi form", note, by };
  const reassigned = !!entry.fromUserId && entry.fromUserId !== entry.toUserId;
  switch (entry.toStatus) {
    case "ASSIGNED":
      return {
        title: entry.toName
          ? reassigned
            ? `Giao lại cho ${entry.toName} (trước: ${entry.fromName ?? "Sale khác"})`
            : `Giao cho ${entry.toName}`
          : leadStatus(entry.toStatus),
        note,
        by,
      };
    case "NEW":
      return { title: "Trả về hàng chờ", note, by };
    case "CONTACTED":
    case "CONVERTED":
    case "DISQUALIFIED":
      return { title: leadStatus(entry.toStatus), note, by };
    default:
      return {
        title: `${leadStatus(entry.fromStatus)} → ${leadStatus(entry.toStatus)}`,
        note,
        by,
      };
  }
}
