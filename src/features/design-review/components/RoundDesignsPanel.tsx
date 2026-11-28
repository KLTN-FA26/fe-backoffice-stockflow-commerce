"use client";

import { useMemo } from "react";
import { parseAsString, useQueryState } from "nuqs";

import { ClipboardCheck } from "lucide-react";

import { ADMIN_ROUTES, DESIGN_ROUND_LABELS, DESIGN_STATUS_TONE_KEY } from "@/constants";

import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";
import {
  ColumnFilterButton,
  HeaderOptionFilter,
  withHeaderFilters,
} from "@/components/shared/ColumnHeaderFilter";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { DataTable } from "@/components/shared/DataTable";
import { DetailPanel } from "@/components/shared/DetailPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import {
  MONO,
  PREVIEW_CONTENT_TYPE,
  REVIEW_LIST_COPY,
  ROUND_DESIGN_FILTER_COPY as F,
  ROUND_DETAIL_LABELS as L,
} from "./copy";
import { textIncludes } from "@/lib/text-match";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ReviewRoundDesign } from "@/features/design-review/types";

type Outcome = "approved" | "returned" | "waiting" | "gone";

const OUTCOMES: Record<Outcome, { status: string; label: string }> = {
  approved: { status: DESIGN_STATUS_TONE_KEY.APPROVED, label: DESIGN_ROUND_LABELS.outcomeApproved },
  // Trả lại = thiết kế về nháp (tone theo `DESIGN_STATUS_TONE_KEY`).
  returned: { status: DESIGN_STATUS_TONE_KEY.DRAFT, label: DESIGN_ROUND_LABELS.outcomeReturned },
  waiting: {
    status: DESIGN_STATUS_TONE_KEY.PENDING_REVIEW,
    label: DESIGN_ROUND_LABELS.outcomeWaiting,
  },
  gone: { status: DESIGN_STATUS_TONE_KEY.ARCHIVED, label: DESIGN_ROUND_LABELS.outcomeGone },
};
const OUTCOME_OPTIONS = (Object.keys(OUTCOMES) as Outcome[]).map((value) => ({
  value,
  label: OUTCOMES[value].label,
}));

/** Kết quả của thiết kế trong vòng; còn `design` mà chưa có outcome = đang chờ. */
function outcomeOf(entry: ReviewRoundDesign): Outcome {
  if (entry.outcome === "APPROVED") return "approved";
  if (entry.outcome === "RETURNED") return "returned";
  return entry.design ? "waiting" : "gone";
}

const DASH = <span className="text-ink-tertiary">—</span>;
const IN_TABLE = "rounded-none border-0 bg-transparent py-10 whitespace-normal";

function columns(
  roundId: string,
  canApprove: boolean,
  onRefreshPreview: () => void,
): ColumnDef<ReviewRoundDesign>[] {
  return [
    {
      key: "preview",
      header: L.colPreview,
      className: "whitespace-normal",
      cell: ({ design }) =>
        design?.previewUrl ? (
          <SignedFilePreview
            url={design.previewUrl}
            contentType={PREVIEW_CONTENT_TYPE}
            alt={`Ảnh xem trước ${design.name}`}
            size="thumb"
            onRefresh={onRefreshPreview}
          />
        ) : (
          DASH
        ),
    },
    {
      key: "name",
      header: L.colDesign,
      cell: ({ design }) => (
        <span className="text-ink-primary block min-w-40 font-medium">
          {design?.name ?? DESIGN_ROUND_LABELS.unnamedDesign}
        </span>
      ),
    },
    {
      key: "product",
      header: L.colProduct,
      cell: ({ design }) => (
        <span className="text-ink-secondary block min-w-40">
          {[design?.productName, design?.variantName].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "sku",
      header: L.colSku,
      cell: ({ design }) => (design?.sku ? <span className={MONO}>{design.sku}</span> : DASH),
    },
    {
      key: "outcome",
      header: L.colOutcome,
      cell: (entry) => {
        const dot = OUTCOMES[outcomeOf(entry)];
        return <StatusDot domain="order" status={dot.status} label={dot.label} />;
      },
    },
    {
      key: "actions",
      header: REVIEW_LIST_COPY.actions,
      // Thiết kế bị trả lại không còn `design` (BE chỉ trả id + outcome, 12 BR-03) → không có nút.
      cell: ({ designId, design, outcome }) =>
        canApprove && outcome == null && design?.status === "PENDING_REVIEW" ? (
          <RowActionsMenu
            label={`${REVIEW_LIST_COPY.actions} — ${design.name}`}
            actions={[
              {
                label: DESIGN_ROUND_LABELS.reviewAndDecide,
                icon: ClipboardCheck,
                href: `${ADMIN_ROUTES.designs.detail(designId)}?round=${encodeURIComponent(roundId)}`,
              },
            ]}
          />
        ) : (
          DASH
        ),
    },
  ];
}

/**
 * Bảng thiết kế của vòng — dữ liệu chính của trang nên hiện thẳng (backoffice-erp-ui B12/B16). BE trả cả bộ thiết kế cùng
 * vòng → lọc theo cột ở FE (khoá URL riêng). Panel có khung → bảng bỏ khung riêng (B14).
 */
export function RoundDesignsPanel({
  roundId,
  designs,
  canApprove,
  onRefreshPreview,
}: {
  roundId: string;
  designs: readonly ReviewRoundDesign[];
  canApprove: boolean;
  onRefreshPreview: () => void;
}) {
  const [name, setName] = useQueryState("designName", parseAsString.withDefault(""));
  const [outcome, setOutcome] = useQueryState("designOutcome", parseAsString);
  const rows = useMemo(
    () =>
      designs.filter(
        (entry) =>
          textIncludes(entry.design?.name, name) && (!outcome || outcomeOf(entry) === outcome),
      ),
    [designs, name, outcome],
  );
  const filtering = Boolean(name.trim() || outcome);
  const clear = () => {
    void setName(null);
    void setOutcome(null);
  };

  return (
    <DetailPanel title={L.designs} count={designs.length} description={L.designsDescription} flush>
      <DataTable
        className="rounded-none border-0 shadow-none"
        data={rows}
        columns={withHeaderFilters(columns(roundId, canApprove, onRefreshPreview), {
          name: (
            <ColumnFilterButton
              label={F.name.label}
              placeholder={F.name.placeholder}
              value={name}
              onChange={(value) => void setName(value || null)}
            />
          ),
          outcome: (
            <HeaderOptionFilter
              label={F.outcome.label}
              value={outcome}
              options={OUTCOME_OPTIONS}
              onChange={(value) => void setOutcome(value)}
              searchPlaceholder={F.outcome.search}
              emptyLabel={F.outcome.empty}
            />
          ),
        })}
        rowKey={(entry) => entry.designId}
        stickyHeader
        pageSize={20}
        emptyState={
          <EmptyState
            className={IN_TABLE}
            title={filtering ? F.noResults : L.emptyDesigns}
            action={
              filtering ? (
                <Button type="button" variant="outline" size="sm" onClick={clear}>
                  {REVIEW_LIST_COPY.clearFilters}
                </Button>
              ) : undefined
            }
          />
        }
      />
    </DetailPanel>
  );
}
