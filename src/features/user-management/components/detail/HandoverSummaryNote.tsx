"use client";

import Link from "next/link";

import { SALES_ASSIGNMENT_PATH, SALES_OWNER_ACCESS_LABELS } from "@/constants";
import { Notice } from "@/components/shared/Notice";

import { hasHandover, useHandoverSummary } from "../../handover-summary";

const L = SALES_OWNER_ACCESS_LABELS.handover;

/**
 * BR-S08: trong hộp xác nhận khoá / vô hiệu hoá — "Sale này đang phụ trách N khách, M hội thoại mở, K khách tiềm năng; sau
 * khi khoá sẽ chuyển sang chờ giao", kèm link sang màn Phân công khách. Không đọc được, hoặc không có gì để giao → không
 * hiện gì (hộp xác nhận như cũ).
 */
export function HandoverSummaryNote({
  userId,
  action,
}: {
  userId: string;
  action: "lock" | "disable";
}) {
  const query = useHandoverSummary(userId, true);
  if (!hasHandover(query.data)) return null;
  const summary = query.data;
  return (
    <Notice tone="warning">
      <span className="block">
        {L.summary(
          summary.customers,
          summary.openConversations,
          summary.openLeads,
          action === "lock" ? L.afterLock : L.afterDisable,
        )}
      </span>
      <Link
        href={SALES_ASSIGNMENT_PATH}
        className="text-accent-text mt-1 inline-block font-medium hover:underline"
      >
        {L.link}
      </Link>
    </Notice>
  );
}
