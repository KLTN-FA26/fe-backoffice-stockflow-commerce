/**
 * Sale phụ trách khách — luật "ai được làm" của chế độ chặt (KE-HOACH sales-owner, BR-S12; D1 = chặt). Thuần, không gọi
 * API: hook ở `sales-owner-queries.ts`. Đặt ở `lib/references` để báo giá, hợp đồng (đơn), chat và hộp yêu cầu báo giá
 * cùng dùng mà không import chéo feature.
 *
 * Gương của BE `SalesOwnership.mayActFor` (HOP-DONG-API "customer :: api"): được làm khi là người phụ trách, người đang lo
 * thay hôm nay, người có `customer-sales-owners:UPDATE` (Sales Manager, Admin), hoặc khi khách không có người phụ trách
 * đang làm (`UNASSIGNED` / `NEEDS_ASSIGNMENT`). UI-only — Backend phải re-check (409 CUSTOMER_OWNED_BY_OTHER_SALES).
 */

import { z } from "zod";

import { SALES_OWNER_ACCESS_LABELS as L, SALES_OWNER_ERROR_CODES } from "@/constants";

import { ApiError } from "@/lib/api/error";
import { serverMessageOf } from "@/lib/api/error-message";
import { formatDate } from "@/lib/format/date";

/**
 * BE `GET /customers/{id}/sales-owner`. Mọi trường mới đọc lỏng (BE song song): thiếu / lạ thì coi như không biết, không
 * làm hỏng trang.
 */
export const salesOwnerSchema = z.object({
  customerId: z.string().nullish(),
  salesOwnerId: z.string().nullish(),
  salesOwnerName: z.string().nullish(),
  active: z.boolean().nullish(),
  state: z.string().nullish(),
  since: z.string().nullish(),
  cover: z
    .object({ userId: z.string(), name: z.string().nullish(), until: z.string().nullish() })
    .nullish()
    .catch(null),
  version: z.number().nullish(),
});
export type SalesOwner = z.infer<typeof salesOwnerSchema>;

export interface SalesOwnerAccess {
  /** BE đã trả người phụ trách (endpoint có, người xem được đọc). `false` → không chặn gì, BE vẫn kiểm. */
  known: boolean;
  /** Khách có người phụ trách đang làm (BR-S12 chỉ áp cho khách có chủ). */
  owned: boolean;
  ownerName: string | null;
  /** Người xem là người phụ trách hoặc người đang lo thay. */
  mine: boolean;
  /** Người xem được lập / sửa / gửi / huỷ báo giá, hợp đồng, chủ động mở chat. */
  mayAct: boolean;
  /** Câu giải thích khi bị chặn (tooltip + dòng ghi chú). */
  blockedReason: string | null;
  /** Người xem đang lo thay cho người phụ trách (BR-S07). */
  coverNote: string | null;
}

/** Không biết người phụ trách (đang tải, BE chưa có endpoint, không có quyền đọc): không chặn — BE kiểm lại. */
export const UNKNOWN_SALES_OWNER_ACCESS: SalesOwnerAccess = {
  known: false,
  owned: false,
  ownerName: null,
  mine: false,
  mayAct: true,
  blockedReason: null,
  coverNote: null,
};

/** Khách có người phụ trách đang làm: `ASSIGNED`; BE cũ không gửi `state` thì xét có chủ và chủ còn làm. */
export function hasActiveOwner(owner: SalesOwner): boolean {
  if (owner.state) return owner.state === "ASSIGNED" && owner.active !== false;
  return !!owner.salesOwnerId && owner.active !== false;
}

/** Tên người phụ trách để ghép câu (BE luôn gửi tên; vắng thì nói "Sale khác"). */
const nameOf = (owner: SalesOwner) => owner.salesOwnerName?.trim() || null;

/**
 * BR-S12 cho một khách và người đang xem. `isManager` = có `customer-sales-owners:UPDATE`.
 */
export function salesOwnerAccessOf(
  owner: SalesOwner | null | undefined,
  meId: string | null | undefined,
  isManager: boolean,
): SalesOwnerAccess {
  if (!owner) return UNKNOWN_SALES_OWNER_ACCESS;
  const owned = hasActiveOwner(owner);
  const ownerName = nameOf(owner);
  const isOwner = !!meId && owner.salesOwnerId === meId;
  const isCover = !!meId && owner.cover?.userId === meId && !isOwner;
  const coverNote =
    owned && isCover && owner.cover
      ? L.coveringFor(
          ownerName ?? "Sale phụ trách",
          owner.cover.until ? formatDate(owner.cover.until) : null,
        )
      : null;
  const mayAct = !owned || isOwner || isCover || isManager;
  return {
    known: true,
    owned,
    ownerName,
    mine: isOwner || isCover,
    mayAct,
    blockedReason: mayAct ? null : ownedByOtherSentence(ownerName),
    coverNote,
  };
}

export function ownedByOtherSentence(name: string | null | undefined): string {
  return name ? L.ownedByOther(name) : L.ownedByOtherUnnamed;
}

/** Dòng "Sale phụ trách" (hộp thư chat, hộp yêu cầu báo giá) — `null` khi không biết. */
export function salesOwnerLine(owner: SalesOwner | null | undefined): string | null {
  if (!owner) return null;
  const name = nameOf(owner);
  if (hasActiveOwner(owner)) {
    const cover = owner.cover?.name?.trim();
    return cover ? L.ownerCover(name ?? "—", cover) : L.owner(name ?? "—");
  }
  return owner.state === "NEEDS_ASSIGNMENT" ? L.needsAssignment(name) : L.unassigned;
}

const ownerDetailsSchema = z
  .object({
    salesOwnerName: z.string().nullish(),
    ownerName: z.string().nullish(),
  })
  .catch({});

/** Tên người phụ trách BE gửi kèm lỗi (`details`), nếu có. */
function ownerNameFromError(error: ApiError): string | null {
  const details = ownerDetailsSchema.parse(error.details ?? {});
  return details.salesOwnerName?.trim() || details.ownerName?.trim() || null;
}

/**
 * Câu cho hai lỗi phụ trách của BE, hoặc `null` khi lỗi khác (nơi gọi dùng câu của mình). Tên lấy theo thứ tự: tên màn
 * đã biết → `details` của BE → câu của BE (đã nêu tên) → câu chung.
 */
export function salesOwnerErrorMessage(
  error: unknown,
  knownOwnerName?: string | null,
): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === SALES_OWNER_ERROR_CODES.ownedByOther) {
    const name = knownOwnerName?.trim() || ownerNameFromError(error);
    if (name) return L.ownedByOther(name);
    return serverMessageOf(error) ?? L.ownedByOtherUnnamed;
  }
  if (error.code === SALES_OWNER_ERROR_CODES.claimOnly) {
    const name = knownOwnerName?.trim() || ownerNameFromError(error);
    if (name) return L.claimOwned(name);
    return serverMessageOf(error) ?? L.claimOwnedUnnamed;
  }
  return null;
}

/** Lỗi cho biết người phụ trách đã đổi so với màn đang hiện → tải lại người phụ trách. */
export function isSalesOwnerError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === SALES_OWNER_ERROR_CODES.ownedByOther ||
      error.code === SALES_OWNER_ERROR_CODES.claimOnly)
  );
}
