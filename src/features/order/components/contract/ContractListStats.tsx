import { SALES_CONTRACT_STATUSES, SALES_CONTRACT_STATUS_LABELS } from "@/constants";
import { CONTRACT_ESIGN_LABELS as L } from "@/constants/contract-esign";

import { StatTile } from "@/components/shared/StatTile";

import type { contractSummarySchema } from "../../sales-contract-esign-api";
import type { z } from "zod";

export function ContractListStats({ summary }: { summary: z.infer<typeof contractSummarySchema> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {SALES_CONTRACT_STATUSES.map(
        (status) =>
          summary.byStatus?.[status] != null && (
            <StatTile
              key={status}
              label={SALES_CONTRACT_STATUS_LABELS[status]}
              value={summary.byStatus[status]}
            />
          ),
      )}
      {(
        [
          ["awaitingCompanySignature", "Chờ công ty ký"],
          ["overdueToSign", L.overdue],
          ["termsReviewPending", "Chờ duyệt điều khoản"],
        ] as const
      ).map(
        ([key, label]) =>
          summary[key] != null && <StatTile key={key} label={label} value={summary[key]} />,
      )}
    </div>
  );
}
