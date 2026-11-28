import { CONTRACT_ESIGN_LABELS as L } from "@/constants/contract-esign";

import { formatDate } from "@/lib/format/date";

import type { SalesContract } from "../../sales-contract-schemas";

export function ContractTermsSummary({ contract }: { contract: SalesContract }) {
  if (contract.termsReview == null && contract.specialTerms == null && contract.signBy == null)
    return null;
  return (
    <div className="text-ink-secondary space-y-2 text-[0.8125rem]">
      <h3 className="text-ink-primary font-semibold">{L.terms}</h3>
      {contract.specialTerms && (
        <p className="break-words whitespace-pre-wrap">{contract.specialTerms}</p>
      )}
      <dl className="grid gap-2 sm:grid-cols-3">
        {(["penaltyPercent", "quantityTolerancePercent", "warrantyMonths"] as const).map(
          (field) => (
            <div key={field}>
              <dt>{L[field]}</dt>
              <dd className="text-ink-primary font-medium tabular-nums">
                {contract[field] ?? contract.standardTerms?.[field] ?? "—"}
              </dd>
            </div>
          ),
        )}
      </dl>
      {(contract.sellerSigner || contract.buyerSigner) && (
        <>
          <h3 className="text-ink-primary font-semibold">{L.signers}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <p>
              Bên bán: {contract.sellerSigner?.name ?? "—"} · {contract.sellerSigner?.title ?? "—"}
              {contract.sellerSigner?.authorizationRef &&
                ` · Giấy uỷ quyền: ${contract.sellerSigner.authorizationRef}`}
            </p>
            <p>
              Bên mua: {contract.buyerSigner?.name ?? "—"} · {contract.buyerSigner?.title ?? "—"}
            </p>
          </div>
        </>
      )}
      {contract.signBy && (
        <p>
          Hạn ký: <span className="font-medium tabular-nums">{formatDate(contract.signBy)}</span>
        </p>
      )}
    </div>
  );
}
