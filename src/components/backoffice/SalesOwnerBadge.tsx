"use client";

import { SALES_OWNER_STATE_LABELS } from "@/constants/labels-sales-owner";

import { ToneDot } from "@/components/shared/column-helpers";

import type { SalesOwnerState } from "@/constants/sales-owner";

/**
 * Nhãn khách chưa có người phụ trách (hợp đồng "FE screens"): `NEEDS_ASSIGNMENT` màu hổ phách — người cũ nghỉ / bị
 * khoá, Sales Manager phải giao lại (BR-S08); `UNASSIGNED` màu xám — chưa từng có ai. `ASSIGNED` không vẽ gì: tên người
 * phụ trách đã nói đủ.
 */
export function SalesOwnerStateBadge({ state }: { state: SalesOwnerState | null | undefined }) {
  if (state === "NEEDS_ASSIGNMENT")
    return <ToneDot tone="warning" label={SALES_OWNER_STATE_LABELS.NEEDS_ASSIGNMENT} />;
  if (state === "UNASSIGNED")
    return <ToneDot tone="muted" label={SALES_OWNER_STATE_LABELS.UNASSIGNED} />;
  return null;
}
