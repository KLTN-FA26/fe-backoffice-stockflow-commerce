import { SALES_CONTRACT_PERMISSIONS } from "@/constants";
import { CONTRACT_ESIGN_PERMISSIONS as P } from "@/constants/contract-esign";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ContractEsignAction } from "./sales-contract-esign-api";
import type { SalesContract } from "./sales-contract-schemas";

/** VerificationCodes.grouped: display only; the backend normalizes submitted codes. */
export function formatContractVerificationCode(code: string) {
  const compact = code.replace(/[\s-]/g, "").toUpperCase();
  return compact.length === 12
    ? `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8)}`
    : code;
}

/** HOP-DONG-API.md QĐ-4: known nonstandard content needs approval before sending. Numeric defaults remain server-owned. */
export function contractTermsNeedApproval(
  contract: Pick<SalesContract, "specialTerms" | "termsReview" | "nonStandardTerms">,
) {
  return (
    contract.termsReview !== "APPROVED" &&
    (contract.nonStandardTerms ?? !!contract.specialTerms?.trim())
  );
}

/** HOP-DONG-API.md Lifecycle and QĐ-2/4. UI-only; backend rechecks permission and four eyes. */
export function contractEsignActions(
  contract: SalesContract,
  can: (code: PermissionCode) => boolean,
): ContractEsignAction[] {
  const actions: ContractEsignAction[] = [];
  if (contract.status === "DRAFT" && contract.termsReview != null) {
    if (contract.termsReview === "PENDING") {
      if (can(SALES_CONTRACT_PERMISSIONS.update)) actions.push("withdraw");
      if (can(P.terms)) actions.push("approve", "reject");
    } else if (
      contract.creditReview !== "PENDING" &&
      contract.termsReview !== "APPROVED" &&
      (contract.nonStandardTerms ?? !!contract.specialTerms?.trim()) &&
      can(SALES_CONTRACT_PERMISSIONS.update)
    )
      actions.push("review");
  }
  if (
    contract.status === "SENT" &&
    contract.signBy != null &&
    can(SALES_CONTRACT_PERMISSIONS.update)
  )
    actions.push("extend");
  if (contract.status === "CUSTOMER_SIGNED" && can(P.signature))
    actions.push("companySign", "upload");
  return actions;
}
