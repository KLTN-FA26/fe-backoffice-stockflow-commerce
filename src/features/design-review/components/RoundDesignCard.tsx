"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  DESIGN_PERMISSIONS,
  DESIGN_ROUND_LABELS,
  DESIGN_STATUS_TONE_KEY,
} from "@/constants";

import { useCan } from "@/lib/auth";

import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";
import { StatusDot } from "@/components/shared/StatusDot";
import { buttonVariants } from "@/components/ui/button";

import { MONO, PREVIEW_CONTENT_TYPE } from "./copy";

import type { ReviewRoundDesign } from "@/features/design-review/types";

/** Outcome của thiết kế trong vòng → chấm trạng thái (tone theo `DESIGN_STATUS_TONE_KEY`: trả lại = về nháp). */
function outcomeDot(entry: ReviewRoundDesign) {
  if (entry.outcome === "APPROVED")
    return { status: DESIGN_STATUS_TONE_KEY.APPROVED, label: DESIGN_ROUND_LABELS.outcomeApproved };
  if (entry.outcome === "RETURNED")
    return { status: DESIGN_STATUS_TONE_KEY.DRAFT, label: DESIGN_ROUND_LABELS.outcomeReturned };
  if (entry.design)
    return {
      status: DESIGN_STATUS_TONE_KEY.PENDING_REVIEW,
      label: DESIGN_ROUND_LABELS.outcomeWaiting,
    };
  return { status: DESIGN_STATUS_TONE_KEY.ARCHIVED, label: DESIGN_ROUND_LABELS.outcomeGone };
}

/**
 * Một thiết kế của vòng. Thiết kế bị trả lại không còn `design` (BE chỉ trả id + outcome, 12 BR-03) → chỉ hiện trạng thái,
 * không ảnh, không nút.
 */
export function RoundDesignCard({
  entry,
  roundId,
  onRefreshPreview,
}: {
  entry: ReviewRoundDesign;
  roundId: string;
  onRefreshPreview: () => void;
}) {
  const canApprove = useCan(DESIGN_PERMISSIONS.approve);
  const { design } = entry;
  const dot = outcomeDot(entry);
  const decidable = canApprove && entry.outcome == null && design?.status === "PENDING_REVIEW";

  return (
    <li className="border-border-default bg-bg-surface flex flex-col gap-3 rounded-[var(--r-md)] border p-4">
      {design?.previewUrl && (
        <SignedFilePreview
          url={design.previewUrl}
          contentType={PREVIEW_CONTENT_TYPE}
          alt={`Ảnh xem trước ${design.name}`}
          onRefresh={onRefreshPreview}
        />
      )}
      <div className="min-w-0 space-y-1">
        {design && <p className="text-ink-primary truncate font-medium">{design.name}</p>}
        {design && (
          <p className="text-ink-secondary text-[0.8125rem]">
            {[design.productName, design.variantName].filter(Boolean).join(" · ") || "—"}
          </p>
        )}
        {design?.sku && <p className={`${MONO} text-ink-tertiary`}>{design.sku}</p>}
        <StatusDot domain="order" status={dot.status} label={dot.label} />
      </div>
      {decidable && (
        <Link
          href={`${ADMIN_ROUTES.designs.detail(entry.designId)}?round=${encodeURIComponent(roundId)}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {DESIGN_ROUND_LABELS.reviewAndDecide}
        </Link>
      )}
    </li>
  );
}
