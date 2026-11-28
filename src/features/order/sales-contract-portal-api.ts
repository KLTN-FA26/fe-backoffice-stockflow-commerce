import { z } from "zod";

import { CONTRACT_ESIGN_PATHS as P } from "@/constants/contract-esign";

import { api } from "@/lib/api/client";

import { optionalContractEndpoint } from "./sales-contract-esign-api";
import { contractRevisionsSchema } from "./sales-contract-esign-schemas";
import { downloadLinkDtoSchema, salesContractDtoSchema } from "./sales-contract-schemas";

/** SalesContractService.portalCopy: reopened drafts expose CHANGES_REQUESTED and no draft content. */
export const portalContractSchema = salesContractDtoSchema.extend({
  status: z.union([z.literal("CHANGES_REQUESTED"), salesContractDtoSchema.shape.status]),
});

export function getPortalContract(orderId: string, signal?: AbortSignal) {
  return optionalContractEndpoint(async () => {
    const { data } = await api.get<unknown>(P.portal(orderId), { signal });
    return portalContractSchema.parse(data);
  });
}

export function getPortalContractRevisions(orderId: string, signal?: AbortSignal) {
  return optionalContractEndpoint(async () => {
    const { data } = await api.get<unknown>(P.portal(orderId, "/revisions"), { signal });
    return contractRevisionsSchema.parse(data);
  });
}

/** Both endpoints return DownloadLink, never PDF bytes. */
export function getPortalSignaturePage(orderId: string) {
  return portalLink(orderId, "/signature-page");
}

export function getPortalRevisionDocument(orderId: string, revision: number) {
  return portalLink(orderId, `/revisions/${revision}/document`);
}

function portalLink(orderId: string, suffix: string) {
  return optionalContractEndpoint(async () => {
    const { data } = await api.get<unknown>(P.portal(orderId, suffix));
    return downloadLinkDtoSchema.parse(data);
  });
}

/** ContractSigning.Verification: public company facts, without personal or monetary data. */
export const contractVerificationSchema = z.object({
  contractNumber: z.string(),
  revision: z.number().int(),
  sellerName: z.string(),
  buyerName: z.string(),
  status: z.string(),
  customerSignedAt: z.string().nullish(),
  companySignedAt: z.string().nullish(),
  documentSha256: z.string().nullish(),
  testCertificate: z.boolean(),
});
