/** Phân công khách — hàm thuần (không side effect). */

import { LEAD_INTEREST_LABELS, LEAD_STATUS_LABELS } from "@/constants/labels-sales-owner";
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

/** Trạng thái BE thêm sau (chưa có nhãn) không hiện mã tiếng Anh. */
export const UNKNOWN_STATUS_LABEL = "Trạng thái khác";

export const leadStatusLabel = (status: string | null | undefined) =>
  status ? (LEAD_STATUS_LABELS[status as LeadStatus] ?? UNKNOWN_STATUS_LABEL) : "—";

/** Nhóm hàng khách quan tâm; mã BE thêm sau (chưa có nhãn) bỏ qua, không hiện mã tiếng Anh. */
export function leadInterestsLabel(codes: readonly string[] | null | undefined): string {
  return (
    (codes ?? [])
      .map((code) => LEAD_INTEREST_LABELS[code])
      .filter(Boolean)
      .join(", ") || "—"
  );
}

/**
 * Ghi chú hệ thống BE viết tiếng Anh (hằng số cố định) → câu tiếng Việt. D44: `StaffDeactivationListener.LEAD_RELEASED_NOTE`
 * — tài khoản Sale bị khoá / vô hiệu hoá, lead đang mở về lại hàng chờ của quản lý.
 */
const LEAD_SYSTEM_NOTES: Readonly<Record<string, string>> = {
  "The salesperson's account was locked or disabled: back to the managers' queue":
    "Tài khoản của Sale được giao đã bị khoá hoặc vô hiệu hoá — khách tiềm năng về lại hàng chờ của quản lý.",
};

/** Người gửi lại form nói gì (chỉ các ô cần để liên hệ; ô trống bỏ qua). */
export interface LeadResubmission {
  company: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
}

const RESUBMISSION_PREFIX = "The form was sent again: company ";
/**
 * Nhãn các phần sau tên công ty, đúng thứ tự BE ghi (`LeadService.resubmissionNote`): `; <nhãn> <giá trị>`; chỉ `contact`
 * luôn có. Tên người liên hệ có thể kèm chức danh trong ngoặc — giữ nguyên.
 */
const RESUBMISSION_PARTS = [
  ["taxCode", "; tax code "],
  ["contact", "; contact "],
  ["phone", "; phone "],
  ["email", "; e-mail "],
  ["province", "; province "],
  ["interests", "; interests "],
  ["monthlyVolume", "; monthly volume "],
  ["note", "; note "],
] as const;

/**
 * Đọc ghi chú `RESUBMITTED` của BE (tiếng Anh, định dạng cố định — review P5): `The form was sent again: company X[; tax
 * code T]; contact C[ (chức danh)][; phone P][; e-mail E][; province …][; interests …][; monthly volume …][; note …]`.
 * Không đúng định dạng (thiếu tiền tố / thiếu `contact`, SĐT hay email không giống SĐT / email) → `null`: màn hình chỉ
 * hiện "Khách gửi lại form", không bao giờ hiện câu tiếng Anh nguyên văn.
 */
export function parseLeadResubmission(note: string | null | undefined): LeadResubmission | null {
  if (!note?.startsWith(RESUBMISSION_PREFIX)) return null;
  const rest = note.slice(RESUBMISSION_PREFIX.length);
  const values: Record<string, string> = {};
  let key = "company";
  let from = 0;
  for (const [next, marker] of RESUBMISSION_PARTS) {
    const at = rest.indexOf(marker, from);
    if (at < 0) continue;
    values[key] = rest.slice(from, at);
    key = next;
    from = at + marker.length;
  }
  values[key] = rest.slice(from);
  const clean = (value: string | undefined) => value?.trim() || null;
  const result: LeadResubmission = {
    company: clean(values.company),
    contact: clean(values.contact),
    phone: clean(values.phone),
    email: clean(values.email),
  };
  if (!result.contact) return null;
  if (result.phone && !/^\+?[\d\s().-]{6,}$/.test(result.phone)) return null;
  if (result.email && !/^[^\s@]+@[^\s@]+$/.test(result.email)) return null;
  return result;
}

/** Ghi chú do người gõ (Sale ghi khi liên hệ, quản lý ghi lý do loại) — hiện nguyên văn. */
const NOTE_TYPED_BY_PEOPLE = new Set(["CONTACTED", "DISQUALIFIED"]);

/**
 * Một dòng lịch sử lead để đọc (§10.7): `title` việc gì, `note` ghi chú hiện được, `resubmission` nội dung form gửi lại,
 * `by` ai làm (vắng = hệ thống: form công khai, khoá tài khoản trả lead về hàng chờ). Không hiện tiếng Anh của BE: ghi
 * chú hệ thống đã biết dịch sang tiếng Việt, ghi chú người gõ (liên hệ, loại) giữ nguyên, còn lại ẩn.
 */
export function leadHistoryLine(entry: LeadHistoryEntry): {
  title: string;
  note: string | null;
  resubmission: LeadResubmission | null;
  by: string;
} {
  const raw = entry.note?.trim() || null;
  const by = entry.changedByName?.trim() || "Hệ thống";
  if (entry.kind === "RESUBMITTED")
    return {
      title: "Khách gửi lại form",
      note: null,
      resubmission: parseLeadResubmission(raw),
      by,
    };
  const note = raw
    ? (LEAD_SYSTEM_NOTES[raw] ?? (NOTE_TYPED_BY_PEOPLE.has(entry.toStatus ?? "") ? raw : null))
    : null;
  const line = (title: string) => ({ title, note, resubmission: null, by });
  if (!entry.fromStatus) return line("Khách gửi form");
  const reassigned = !!entry.fromUserId && entry.fromUserId !== entry.toUserId;
  switch (entry.toStatus) {
    case "ASSIGNED":
      return line(
        entry.toName
          ? reassigned
            ? `Giao lại cho ${entry.toName} (trước: ${entry.fromName ?? "Sale khác"})`
            : `Giao cho ${entry.toName}`
          : leadStatusLabel(entry.toStatus),
      );
    case "NEW":
      return line("Trả về hàng chờ");
    case "CONTACTED":
    case "CONVERTED":
    case "DISQUALIFIED":
      return line(leadStatusLabel(entry.toStatus));
    default:
      return line(`${leadStatusLabel(entry.fromStatus)} → ${leadStatusLabel(entry.toStatus)}`);
  }
}
