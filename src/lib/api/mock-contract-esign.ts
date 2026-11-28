/** E-sign demo state belongs to the existing contract objects, so resetting their store resets this state too. */
import { CONTRACT_ESIGN_LIMITS as LIMITS } from "@/constants/contract-esign";

import { refuse } from "./mock-quote-refusal";
import { addDays, vnDay } from "./mock-quote-seed";

import type { MockContract } from "./mock-contract-store";

/** ContractProperties defaults; production reads these numbers from ContractView.standardTerms. */
export const MOCK_STANDARD_TERMS = {
  penaltyPercent: 8,
  quantityTolerancePercent: 5,
  warrantyMonths: 6,
} as const;
interface Signer {
  name?: string | null;
  title?: string | null;
  authorizationRef?: string | null;
}
interface Inspection {
  kind: "DIGITAL" | "SCAN";
  valid: boolean;
  coversWholeDocument: boolean;
  matchesSentDocument: boolean;
  chainChecked: false;
  signers: {
    subject: string;
    issuer: string;
    serial: string;
    notBefore: string;
    notAfter: string;
    signedAt: string;
  }[];
}
interface Signature {
  method: string;
  signerName: string;
  signerTitle: string;
  signedAt: string;
  certificateSubject?: string;
  certificateIssuer?: string;
  testCertificate?: boolean;
  inspection?: Inspection;
}
interface EsignState {
  specialTerms: string | null;
  penaltyPercent: number | null;
  quantityTolerancePercent: number | null;
  warrantyMonths: number | null;
  sellerSigner: Signer | null;
  buyerSigner: Signer | null;
  revision: number;
  termsReview: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  termsReviewDetail: {
    note: string | null;
    requestedBy?: string;
    requestedAt?: string;
    decidedBy?: string;
    decidedAt?: string;
  } | null;
  signBy: string | null;
  customerSignedAt: string | null;
  revisions: {
    revision: number;
    sentAt: string;
    sentByName: string;
    changeRequestReason?: string;
    changeRequestedAt?: string;
    documentAvailable: boolean;
  }[];
  signatures: {
    customer?: Signature;
    company?: Signature;
    documentSha256?: string;
    verificationCode?: string;
  };
}
const states = new WeakMap<MockContract, EsignState>();
export function contractEsignState(contract: MockContract): EsignState {
  let state = states.get(contract);
  if (!state) {
    state = {
      specialTerms: null,
      penaltyPercent: null,
      quantityTolerancePercent: null,
      warrantyMonths: null,
      sellerSigner: null,
      buyerSigner: null,
      revision: 1,
      termsReview: "NONE",
      termsReviewDetail: null,
      signBy: contract.sentAt ? addDays(vnDay(new Date(contract.sentAt)), 7) : null,
      customerSignedAt: null,
      revisions: contract.sentAt
        ? [
            {
              revision: 1,
              sentAt: contract.sentAt,
              sentByName: contract.seller.representative ?? contract.seller.name,
              documentAvailable: true,
            },
          ]
        : [],
      signatures: {},
    };
    states.set(contract, state);
  }
  return state;
}
export function contractEsignView(contract: MockContract) {
  const {
    revisions: _revisions,
    signatures: _signatures,
    ...fields
  } = contractEsignState(contract);
  void _revisions;
  void _signatures;
  return {
    ...fields,
    standardTerms: MOCK_STANDARD_TERMS,
    nonStandardTerms: hasNonstandardTerms(contract),
    customerSignature: _signatures.customer,
    companySignature: _signatures.company,
    verificationCode: _signatures.verificationCode,
    canSign: contract.status === "SENT" && (!fields.signBy || fields.signBy >= vnDay()),
    canRequestChanges: contract.status === "SENT",
    overdueToSign: contract.status === "SENT" && !!fields.signBy && fields.signBy < vnDay(),
  };
}
export const hasNonstandardTerms = (contract: MockContract) => {
  const state = contractEsignState(contract);
  return (
    !!state.specialTerms?.trim() ||
    (["penaltyPercent", "quantityTolerancePercent", "warrantyMonths"] as const).some(
      (key) => state[key] != null && state[key] !== MOCK_STANDARD_TERMS[key],
    )
  );
};
export function saveContractEsignTerms(contract: MockContract, body: Record<string, unknown>) {
  const state = contractEsignState(contract);
  for (const key of ["penaltyPercent", "quantityTolerancePercent", "warrantyMonths"] as const) {
    const value = body[key];
    if (value != null) {
      if (
        value !== null &&
        (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > LIMITS[key])
      )
        refuse(400, "VALIDATION_FAILED", "Điều khoản không hợp lệ.");
      state[key] = typeof value === "number" && value !== MOCK_STANDARD_TERMS[key] ? value : null;
    }
  }
  if (typeof body.specialTerms === "string" && body.specialTerms.length > LIMITS.specialTerms)
    refuse(400, "VALIDATION_FAILED", "Thoả thuận quá dài.");
  if (typeof body.specialTerms === "string") state.specialTerms = body.specialTerms.trim() || null;
  for (const key of ["sellerSigner", "buyerSigner"] as const) {
    const raw = body[key];
    if (raw && typeof raw === "object") {
      const record = raw as Record<string, unknown>;
      const signer: Signer = {};
      for (const field of ["name", "title", "authorizationRef"] as const) {
        const value = record[field];
        if (
          typeof value === "string" &&
          value.length > (field === "authorizationRef" ? LIMITS.authorization : LIMITS.signer)
        )
          refuse(400, "VALIDATION_FAILED", "Thông tin người ký quá dài.");
        signer[field] = typeof value === "string" ? value : null;
      }
      state[key] = signer;
    }
  }
  state.termsReview = "NONE";
  state.termsReviewDetail = null;
}
export function requireTermsUnlocked(contract: MockContract) {
  if (contractEsignState(contract).termsReview === "PENDING")
    refuse(409, "CONTRACT_TERMS_REVIEW_PENDING", "Hợp đồng đang chờ duyệt điều khoản.");
}
export function requireTermsApproved(contract: MockContract) {
  if (hasNonstandardTerms(contract) && contractEsignState(contract).termsReview !== "APPROVED")
    refuse(409, "CONTRACT_TERMS_REVIEW_REQUIRED", "Cần duyệt điều khoản trước khi gửi.");
}
export function recordContractRevision(contract: MockContract) {
  const state = contractEsignState(contract);
  state.signBy = addDays(vnDay(), 7);
  if (!state.revisions.some((revision) => revision.revision === state.revision))
    state.revisions.push({
      revision: state.revision,
      sentAt: contract.sentAt ?? new Date().toISOString(),
      sentByName: contract.seller.representative ?? contract.seller.name,
      documentAvailable: true,
    });
}
