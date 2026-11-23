import { DESIGN_REVIEW_LABELS, DESIGN_ROUND_LABELS } from "@/constants";

import type { ReviewRound, RoundApproval } from "@/features/design-review/types";

const OUTCOME_LABEL = {
  APPROVED: DESIGN_ROUND_LABELS.resultApproved,
  NOT_APPROVED: DESIGN_ROUND_LABELS.resultNotApproved,
  SKIPPED: DESIGN_ROUND_LABELS.resultSkipped,
} as const;

/** Kết quả "Duyệt tất cả" theo từng thiết kế; tên lấy từ `round` BE trả cùng response (thiết kế đã duyệt vẫn có `design`). */
export function RoundApprovalResult({
  result,
  round,
}: {
  result: RoundApproval["outcomes"];
  round: ReviewRound;
}) {
  const designs = new Map(round.designs.map((entry) => [entry.designId, entry.design]));
  return (
    <section aria-label={DESIGN_ROUND_LABELS.resultTitle} className="space-y-2">
      <h2 className="text-ink-primary text-sm font-semibold">{DESIGN_ROUND_LABELS.resultTitle}</h2>
      <table className="border-border-default w-full border text-left text-[0.8125rem]">
        <tbody>
          {result.map((row) => (
            <tr key={row.designId} className="border-border-default border-t">
              <td className="p-2">
                {/* Không có tên → nhãn trung tính, không mảnh UUID (BO-UX-6) */}
                {designs.get(row.designId)?.name ?? DESIGN_ROUND_LABELS.unnamedDesign}
              </td>
              <td className="p-2 font-medium">{OUTCOME_LABEL[row.outcome]}</td>
              <td className="text-ink-secondary p-2">
                {row.outcome === "NOT_APPROVED" ? (row.message ?? row.errorCode ?? "") : ""}
                {row.outcome === "APPROVED" && designs.get(row.designId)?.customerSku
                  ? `${DESIGN_REVIEW_LABELS.approvedWithSku} ${designs.get(row.designId)?.customerSku}`
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
