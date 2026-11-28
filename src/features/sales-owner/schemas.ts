/**
 * Phân công khách — DTO (hợp đồng API sales-owner, BE-A / BE-B / BE-C). BE làm song song: mọi trường ngoài id đọc lỏng
 * (`nullish`), enum lạ → `null`; danh sách nhận cả mảng lẫn `PageResponse`. Jackson `non_null`: trường null bị bỏ khỏi
 * JSON. Hai lớp schema (api-conventions §3.1): DTO ở đây, Input ở `inputs.ts`.
 */

import { z } from "zod";

import {
  LEAD_HISTORY_KINDS,
  LEAD_STATUSES,
  OWNER_CHANGE_REQUEST_STATUSES,
  SALES_OWNER_CHANGE_REASONS,
} from "@/constants/sales-owner";

/** Mảng, hoặc `PageResponse` (lấy `items`) — BE chưa chốt endpoint nào phân trang. */
export function listOf<T extends z.ZodType>(item: T) {
  return z
    .union([z.array(item), z.object({ items: z.array(item) })])
    .transform((v) => (Array.isArray(v) ? v : v.items));
}

/** Trang có `totalElements` / `page` (BE `PageResponse`); mảng trần → một trang. */
export function pageOf<T extends z.ZodType>(item: T) {
  return z
    .union([
      z.array(item),
      z.object({
        items: z.array(item),
        page: z.number().int().min(0),
        size: z.number().int().positive(),
        totalElements: z.number().int().min(0),
        totalPages: z.number().int().min(0),
        hasNext: z.boolean(),
        hasPrevious: z.boolean(),
      }),
    ])
    .transform((v) =>
      Array.isArray(v)
        ? {
            items: v,
            page: 0,
            size: Math.max(1, v.length),
            totalElements: v.length,
            totalPages: v.length ? 1 : 0,
            hasNext: false,
            hasPrevious: false,
          }
        : v,
    );
}

/* ── Bảng tải: phần chat (BE-B `GET /chat/agents/workload`) ── */

export const chatWorkloadRowSchema = z.object({
  userId: z.string(),
  openConversations: z.number().int().nullish(),
  overdueConversations: z.number().int().nullish(),
});
export const chatWorkloadSchema = listOf(chatWorkloadRowSchema);

/* ── Chuyển khách hàng loạt (BR-S09) ── */

const skippedSchema = z.object({ customerId: z.string(), reason: z.string().nullish() });

/** `moved` là số khách đã chuyển (hoặc danh sách id — đếm). */
export const transferResultSchema = z.object({
  batchId: z.string().nullish(),
  moved: z
    .union([z.number().int(), z.array(z.string())])
    .nullish()
    .transform((v) => (Array.isArray(v) ? v.length : (v ?? 0))),
  skipped: z
    .array(skippedSchema)
    .nullish()
    .transform((v) => v ?? []),
});

/** Lô chuyển tạm (§10.1; hợp đồng, phần BO-1): `GET /customers/sales-owner-transfers?temporary=true`. */
export const transferBatchSchema = z.object({
  batchId: z.string(),
  fromUserId: z.string().nullish(),
  fromName: z.string().nullish(),
  toNames: z.array(z.string()).nullish(),
  reason: z.enum(SALES_OWNER_CHANGE_REASONS).nullish().catch(null),
  note: z.string().nullish(),
  temporary: z.boolean().nullish(),
  createdAt: z.string().nullish(),
  createdByName: z.string().nullish(),
  moved: z.number().int().nullish(),
  /** Khách của lô còn đang ở người nhận (trả lại được). */
  stillHeld: z.number().int().nullish(),
  returnedAt: z.string().nullish(),
});
export const transferBatchListSchema = listOf(transferBatchSchema);

/** Cài đặt phân công của một Sale (D13). */
export const assignmentSettingsSchema = z.object({
  paused: z
    .boolean()
    .nullish()
    .transform((v) => v ?? false),
  capacityPerMonth: z.number().int().nullish(),
});

/* ── Khách tiềm năng (§10.3, §10.7) ── */

export const leadSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  taxCode: z.string().nullish(),
  contactName: z.string().nullish(),
  contactTitle: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  province: z.string().nullish(),
  interests: z.array(z.string()).nullish(),
  monthlyVolume: z.union([z.string(), z.number()]).nullish(),
  note: z.string().nullish(),
  /** Trạng thái lạ (BE thêm sau) giữ nguyên chữ: không có thao tác nào (lifecycle), nhãn hiện nguyên văn. */
  status: z.union([z.enum(LEAD_STATUSES), z.string()]),
  assignedTo: z.string().nullish(),
  assignedToName: z.string().nullish(),
  contactNote: z.string().nullish(),
  disqualifyReason: z.string().nullish(),
  customerId: z.string().nullish(),
  createdAt: z.string().nullish(),
});
export const leadPageSchema = pageOf(leadSchema);

/**
 * Một dòng `GET /leads/{id}/history` (cũ trước). `fromStatus` vắng = lần gửi form đầu. `kind` vắng / lạ → coi như
 * `CHANGE`; `RESUBMITTED`: khách gửi lại form, `note` là nội dung form mới (công ty, MST, người liên hệ, SĐT, email…).
 */
export const leadHistoryEntrySchema = z.object({
  fromStatus: z.string().nullish(),
  toStatus: z.string().nullish(),
  fromUserId: z.string().nullish(),
  fromName: z.string().nullish(),
  toUserId: z.string().nullish(),
  toName: z.string().nullish(),
  note: z.string().nullish(),
  changedById: z.string().nullish(),
  changedByName: z.string().nullish(),
  changedAt: z.string(),
  kind: z
    .enum(LEAD_HISTORY_KINDS)
    .nullish()
    .catch(null)
    .transform((v) => v ?? "CHANGE"),
});
export const leadHistorySchema = listOf(leadHistoryEntrySchema);

/* ── Lịch người thay (BR-S07) ── */

export const staffCoverSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string().nullish(),
  coverUserId: z.string(),
  coverUserName: z.string().nullish(),
  from: z.string(),
  to: z.string(),
  reason: z.string().nullish(),
  /** BE có thể trả trạng thái hoặc thời điểm huỷ — FE suy trạng thái từ ngày khi không có. */
  status: z.string().nullish(),
  cancelledAt: z.string().nullish(),
  createdByName: z.string().nullish(),
});
export const staffCoverListSchema = listOf(staffCoverSchema);

/* ── Yêu cầu đổi Sale của khách (§10.5) ── */

export const ownerChangeRequestSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: z.string().nullish(),
  currentOwnerId: z.string().nullish(),
  currentOwnerName: z.string().nullish(),
  preferredSalesUserId: z.string().nullish(),
  preferredSalesName: z.string().nullish(),
  /** Cờ "vận động": Sale được nêu tên đã nhắn / liên hệ khách gần đây (§10.5 bước 3). */
  preferredSalesRecentlyContacted: z.boolean().nullish(),
  reason: z.string().nullish(),
  note: z.string().nullish(),
  status: z.union([z.enum(OWNER_CHANGE_REQUEST_STATUSES), z.string()]),
  createdAt: z.string().nullish(),
  decidedAt: z.string().nullish(),
  decidedByName: z.string().nullish(),
  decisionNote: z.string().nullish(),
});
export const ownerChangeRequestPageSchema = pageOf(ownerChangeRequestSchema);
