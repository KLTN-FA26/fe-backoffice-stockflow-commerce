import { DESIGN_REVIEW_LABELS, DESIGN_ROUND_LABELS } from "@/constants";

import { DataTable } from "@/components/shared/DataTable";
import { DetailPanel } from "@/components/shared/DetailPanel";

import { MONO, ROUND_DETAIL_LABELS as L } from "./copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ReviewRound, RoundApproval } from "@/features/design-review/types";

type Outcome = RoundApproval["outcomes"][number];

const OUTCOME_LABEL = {
  APPROVED: DESIGN_ROUND_LABELS.resultApproved,
  NOT_APPROVED: DESIGN_ROUND_LABELS.resultNotApproved,
  SKIPPED: DESIGN_ROUND_LABELS.resultSkipped,
} as const;

/**
 * Kết quả "Duyệt tất cả" theo từng thiết kế; tên lấy từ `round` BE trả cùng response (thiết kế đã duyệt vẫn có `design`).
 * `NOT_APPROVED` hiện câu BE trả; không có câu thì nhãn chung — không hiện mã lỗi thô (backoffice-erp-ui B17).
 */
export function RoundApprovalResult({
  result,
  round,
}: {
  result: RoundApproval["outcomes"];
  round: ReviewRound;
}) {
  const designs = new Map(round.designs.map((entry) => [entry.designId, entry.design]));
  const columns: ColumnDef<Outcome>[] = [
    {
      key: "design",
      header: L.colDesign,
      // Không có tên → nhãn trung tính, không mảnh UUID (BO-UX-6)
      cell: (row) => (
        <span className="text-ink-primary font-medium">
          {designs.get(row.designId)?.name ?? DESIGN_ROUND_LABELS.unnamedDesign}
        </span>
      ),
    },
    {
      key: "outcome",
      header: L.colOutcome,
      cell: (row) => <span className="font-medium">{OUTCOME_LABEL[row.outcome]}</span>,
    },
    {
      key: "message",
      header: L.colMessage,
      cell: (row) => {
        if (row.outcome === "NOT_APPROVED")
          return <span className="text-ink-secondary">{row.message ?? L.notApprovedFallback}</span>;
        const sku = row.outcome === "APPROVED" ? designs.get(row.designId)?.customerSku : null;
        return sku ? (
          <span className="text-ink-secondary">
            {DESIGN_REVIEW_LABELS.approvedWithSku} <span className={MONO}>{sku}</span>
          </span>
        ) : (
          <span className="text-ink-tertiary">—</span>
        );
      },
    },
  ];

  return (
    <DetailPanel
      title={DESIGN_ROUND_LABELS.resultTitle}
      count={result.length}
      description={L.resultDescription}
      flush
      className="mb-5"
    >
      <DataTable
        className="rounded-none border-0 shadow-none"
        data={result}
        columns={columns}
        rowKey={(row) => row.designId}
        pageSize={20}
      />
    </DetailPanel>
  );
}
