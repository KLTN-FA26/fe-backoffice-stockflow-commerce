import { z } from "zod";

import { CONTRACT_ESIGN_LIMITS as L, CONTRACT_TERMS_REVIEW } from "@/constants/contract-esign";

import { isoDate } from "@/lib/validation/primitives";

const optionalText = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự`).nullish();
export const contractSignerSchema = z.object({
  name: optionalText(L.signer),
  title: optionalText(L.signer),
  authorizationRef: optionalText(L.authorization),
});
export const contractStandardTermsSchema = z.object({
  penaltyPercent: z.number().int(),
  quantityTolerancePercent: z.number().int(),
  warrantyMonths: z.number().int(),
});
/** SalesContracts.ContractView: nullable fields may be omitted by Jackson. */
export const contractTermsShape = {
  specialTerms: optionalText(L.specialTerms),
  penaltyPercent: z.number().int().min(0).max(L.penaltyPercent).nullish(),
  quantityTolerancePercent: z.number().int().min(0).max(L.quantityTolerancePercent).nullish(),
  warrantyMonths: z.number().int().min(0).max(L.warrantyMonths).nullish(),
  sellerSigner: contractSignerSchema.nullish(),
  buyerSigner: contractSignerSchema.nullish(),
  revision: z.number().int().positive().nullish(),
  termsReview: z.enum(CONTRACT_TERMS_REVIEW).nullish(),
  standardTerms: contractStandardTermsSchema.nullish(),
  nonStandardTerms: z.boolean().nullish(),
  termsReviewDetail: z
    .object({
      note: z.string().nullish(),
      requestedBy: z.string().nullish(),
      requestedAt: z.string().nullish(),
      decidedBy: z.string().nullish(),
      decidedAt: z.string().nullish(),
    })
    .nullish(),
  signBy: z.string().nullish(),
  overdueToSign: z.boolean().nullish(),
  customerSignedAt: z.string().nullish(),
  canSign: z.boolean().nullish(),
  canRequestChanges: z.boolean().nullish(),
};
const certificateSchema = z.object({
  subject: z.string().nullish(),
  issuer: z.string().nullish(),
  serial: z.string().nullish(),
  notBefore: z.string().nullish(),
  notAfter: z.string().nullish(),
  signedAt: z.string().nullish(),
  certificateValidAtSigning: z.boolean().nullish(),
});
export const contractInspectionSchema = z.object({
  kind: z.string().nullish(),
  valid: z.boolean().nullish(),
  coversWholeDocument: z.boolean().nullish(),
  matchesSentDocument: z.boolean().nullish(),
  chainChecked: z.boolean().nullish(),
  signers: z.array(certificateSchema).nullish(),
  reason: z.string().nullish(),
});
export const contractSignatureSchema = z.object({
  method: z.string().nullish(),
  signerName: z.string().nullish(),
  signerTitle: z.string().nullish(),
  email: z.string().nullish(),
  signedAt: z.string().nullish(),
  ip: z.string().nullish(),
  otpVerified: z.boolean().nullish(),
  byName: z.string().nullish(),
  certificateSubject: z.string().nullish(),
  certificateIssuer: z.string().nullish(),
  testCertificate: z.boolean().nullish(),
  inspection: contractInspectionSchema.nullish(),
});
export const contractSignaturesSchema = z.object({
  customer: contractSignatureSchema.nullish(),
  company: contractSignatureSchema.nullish(),
  documentSha256: z.string().nullish(),
  verificationCode: z.string().nullish(),
});
export const contractRevisionsSchema = z.array(
  z.object({
    revision: z.number().int().nullish(),
    sentAt: z.string().nullish(),
    sentBy: z.string().nullish(),
    sentByName: z.string().nullish(),
    changeRequestReason: z.string().nullish(),
    changeRequestedAt: z.string().nullish(),
    documentAvailable: z.boolean().nullish(),
  }),
);
const optionalNumberInput = (max: number) =>
  z
    .string()
    .trim()
    .refine(
      (v) => v === "" || (/^\d+$/.test(v) && Number(v) <= max),
      `Nhập số nguyên từ 0 đến ${max}`,
    )
    .optional();
export const contractTermsFormShape = {
  specialTerms: z.string().trim().max(L.specialTerms, "Tối đa 4000 ký tự").optional(),
  penaltyPercent: optionalNumberInput(L.penaltyPercent),
  quantityTolerancePercent: optionalNumberInput(L.quantityTolerancePercent),
  warrantyMonths: optionalNumberInput(L.warrantyMonths),
  sellerSignerName: optionalText(L.signer),
  sellerSignerTitle: optionalText(L.signer),
  authorizationRef: optionalText(L.authorization),
  buyerSignerName: optionalText(L.signer),
  buyerSignerTitle: optionalText(L.signer),
};
/** HOP-DONG-API.md §/sign-by: Vietnamese business date, today through today + 60 inclusive. */
export function contractSignBySchema(today: string, lastDay: string) {
  return z.object({
    signBy: isoDate.refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return (
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === value &&
        value >= today &&
        value <= lastDay
      );
    }, "Ngày ký phải từ hôm nay đến tối đa 60 ngày tới"),
  });
}
export type ContractInspection = z.infer<typeof contractInspectionSchema>;
export type ContractSignatures = z.infer<typeof contractSignaturesSchema>;
export const companyCertificateSchema = certificateSchema
  .omit({ signedAt: true, certificateValidAtSigning: true })
  .extend({
    testCertificate: z.boolean().nullish(),
  });
export type CompanyCertificate = z.infer<typeof companyCertificateSchema>;
