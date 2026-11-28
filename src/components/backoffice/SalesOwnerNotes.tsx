"use client";

import { cn } from "cn";
import { Lock, UserRoundCheck } from "lucide-react";

import { salesOwnerLine } from "@/lib/references/sales-owner-access";
import { useSalesOwner } from "@/lib/references/sales-owner-queries";

import type { SalesOwnerAccess } from "@/lib/references/sales-owner-access";

/**
 * Ghi chú dưới nhóm nút của báo giá / hợp đồng / chat (BR-S12): vì sao nút bị tắt ("Khách này do A phụ trách…"), hoặc
 * "Bạn đang lo thay cho A tới …" (BR-S07). Không biết người phụ trách thì không hiện gì.
 */
export function SalesOwnerAccessNote({
  access,
  id,
  className,
}: {
  access: Pick<SalesOwnerAccess, "blockedReason" | "coverNote">;
  /** Để nút tắt trỏ `aria-describedby` vào câu lý do. */
  id?: string;
  className?: string;
}) {
  if (!access.blockedReason && !access.coverNote) return null;
  return (
    <div className={cn("space-y-0.5 text-xs", className)}>
      {access.blockedReason && (
        <p id={id} className="text-ink-secondary flex items-start gap-1.5">
          <Lock className="text-ink-tertiary mt-0.5 size-3 shrink-0" aria-hidden />
          <span>{access.blockedReason}</span>
        </p>
      )}
      {access.coverNote && (
        <p className="text-ink-secondary flex items-start gap-1.5">
          <UserRoundCheck className="text-info mt-0.5 size-3 shrink-0" aria-hidden />
          <span>{access.coverNote}</span>
        </p>
      )}
    </div>
  );
}

/** "Sale phụ trách: A" / "Chưa có Sale phụ trách" / "Cần giao người phụ trách" của một khách; không biết thì không hiện. */
export function SalesOwnerLine({
  customerId,
  className,
}: {
  customerId: string;
  className?: string;
}) {
  const owner = useSalesOwner(customerId);
  const line = salesOwnerLine(owner.data);
  if (!line) return null;
  return <span className={cn("text-ink-tertiary block truncate text-xs", className)}>{line}</span>;
}
