import { CONTRACT_ESIGN_LABELS as L, CONTRACT_TERMS_LABELS } from "@/constants/contract-esign";

import { StatusDot as StatusBadge } from "@/components/shared/StatusDot";

import type { SalesContract } from "../../sales-contract-schemas";

const REVIEW_TONES = {
  NONE: "Draft",
  PENDING: "Pending Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;
export function ContractEsignBadges({
  contract,
}: {
  contract: Pick<SalesContract, "termsReview" | "overdueToSign" | "nonStandardTerms">;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {contract.nonStandardTerms && <StatusBadge domain="order" status="Nonstandard" />}
      {contract.termsReview && contract.termsReview !== "NONE" && (
        <StatusBadge
          domain="order"
          status={REVIEW_TONES[contract.termsReview]}
          label={CONTRACT_TERMS_LABELS[contract.termsReview]}
        />
      )}
      {contract.overdueToSign && <StatusBadge domain="order" status="Overdue" label={L.overdue} />}
    </span>
  );
}
