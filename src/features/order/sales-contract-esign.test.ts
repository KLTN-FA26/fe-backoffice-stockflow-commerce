import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTRACT_ESIGN_PERMISSIONS } from "@/constants/contract-esign";

import { ApiError } from "@/lib/api/error";
import { api } from "@/lib/api/client";

import { contractDraft } from "./__fixtures__/contract";
import {
  getCompanyCertificate,
  getContractEsignLink,
  listSalesContracts,
  optionalContractEndpoint,
} from "./sales-contract-esign-api";
import {
  contractTermsNeedApproval,
  formatContractVerificationCode,
} from "./sales-contract-esign-rules";
import {
  getPortalContract,
  getPortalContractRevisions,
  getPortalRevisionDocument,
  getPortalSignaturePage,
} from "./sales-contract-portal-api";
import { contractSignBySchema, contractSignaturesSchema } from "./sales-contract-esign-schemas";
import { contractFormSchema, toContractDraftBody, toContractForm } from "./sales-contract-form";
import { allowedContractActions, CONTRACT_TRANSITIONS } from "./sales-contract-rules";
import { salesContractDtoSchema } from "./sales-contract-schemas";

afterEach(() => vi.restoreAllMocks());

describe("contract e-sign API 2026-11-28", () => {
  it("sends repeated status parameters, including multiple selected statuses", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: { items: [] } });
    await listSalesContracts({ page: 0, size: 15, status: ["SENT", "CUSTOMER_SIGNED"] });
    const config = get.mock.calls[0]?.[1];
    expect(config?.params).toBeInstanceOf(URLSearchParams);
    expect(String(config?.params)).toBe("page=0&size=15&status=SENT&status=CUSTOMER_SIGNED");
  });
  it("reads the company's active identity and download links as JSON objects", async () => {
    const identity = { subject: contractDraft.seller.name, testCertificate: true };
    const link = { url: "https://example.test/document", expiresAt: "2026-11-28T12:00:00Z" };
    const get = vi
      .spyOn(api, "get")
      .mockResolvedValueOnce({ data: identity })
      .mockResolvedValue({ data: link });
    expect(await getCompanyCertificate(contractDraft.orderId)).toEqual(identity);
    expect(get.mock.calls[0]?.[0]).toContain("/company-signature/identity");
    expect(
      await getContractEsignLink(contractDraft.orderId, "/company-signature/document"),
    ).toEqual(link);
    expect(await getPortalSignaturePage(contractDraft.orderId)).toEqual(link);
    expect(await getPortalRevisionDocument(contractDraft.orderId, 1)).toEqual(link);
    expect(get.mock.calls.at(-1)?.[0]).toBe(
      `/orders/me/${contractDraft.orderId}/contract/revisions/1/document`,
    );
    expect(get.mock.calls.some(([, config]) => config?.responseType === "blob")).toBe(false);
  });
  it("preserves the portal changes-requested status and empty draft content", async () => {
    const view = {
      ...contractDraft,
      status: "CHANGES_REQUESTED",
      deliverySchedule: [],
      paymentPlan: [],
      specialTerms: null,
      standardTerms: null,
      nonStandardTerms: false,
      canSign: false,
      canRequestChanges: false,
    };
    vi.spyOn(api, "get")
      .mockResolvedValueOnce({ data: view })
      .mockResolvedValueOnce({ data: [{ revision: 1, documentAvailable: true }] });
    expect(await getPortalContract(contractDraft.orderId)).toMatchObject(view);
    expect(await getPortalContractRevisions(contractDraft.orderId)).toEqual([
      { revision: 1, documentAvailable: true },
    ]);
  });
  it("groups the backend's 12-character verification code for display", () => {
    expect(formatContractVerificationCode("ABCDEFGHJKMN")).toBe("ABCD-EFGH-JKMN");
    expect(formatContractVerificationCode("abcd efgh-jkmn")).toBe("ABCD-EFGH-JKMN");
  });
  it("uses the backend deviation flag and clears overrides with actual defaults", () => {
    const defaults = { penaltyPercent: 8, quantityTolerancePercent: 5, warrantyMonths: 6 };
    const contract = salesContractDtoSchema.parse({
      ...contractDraft,
      standardTerms: defaults,
      nonStandardTerms: true,
      termsReview: "NONE",
      penaltyPercent: 0,
      termsReviewDetail: { note: "Cần sửa" },
    });
    expect(contractTermsNeedApproval(contract)).toBe(true);
    expect(contractTermsNeedApproval({ ...contract, nonStandardTerms: false })).toBe(false);
    const form = toContractForm(
      contract,
      contract.deliverySchedule.flatMap((batch) => batch.lines.map((line) => line.orderLineId)),
    );
    const body = toContractDraftBody(
      contractFormSchema.parse({ ...form, specialTerms: "", penaltyPercent: "" }),
      defaults,
    );
    expect(body).toMatchObject({ specialTerms: "", ...defaults });
    expect(contract.termsReviewDetail?.note).toBe("Cần sửa");
  });
  it("accepts old responses and locks customer-signed content without opening installments", () => {
    expect(salesContractDtoSchema.parse(contractDraft).termsReview).toBeUndefined();
    expect(contractSignaturesSchema.parse({})).toEqual({});
    const actions = allowedContractActions({ status: "CUSTOMER_SIGNED" }, "Draft", () => true);
    expect(actions).toEqual(["sign", "cancel"]);
    expect(CONTRACT_TRANSITIONS.CUSTOMER_SIGNED).toEqual(["SIGNED", "CANCELLED"]);
  });
  it("locks drafts pending terms approval independently of credit review", () => {
    expect(
      allowedContractActions({ status: "DRAFT", termsReview: "PENDING" }, "Draft", () => true),
    ).toEqual(["cancel", "preview"]);
    expect(CONTRACT_ESIGN_PERMISSIONS.signature).toBe("sales-contract-signatures:APPROVE");
  });
  it.each([400, 403, 404, 405])("hides unsupported endpoints (%s)", async (status) => {
    expect(
      await optionalContractEndpoint(() => Promise.reject(new ApiError(status, "HTTP", "English"))),
    ).toBeNull();
  });
  it("does not hide network or server failures", async () => {
    await expect(
      optionalContractEndpoint(() => Promise.reject(new ApiError(500, "HTTP", "English"))),
    ).rejects.toThrow();
  });
  it("validates dates including bounds and malformed dates", () => {
    const schema = contractSignBySchema("2026-11-28", "2027-01-27");
    for (const signBy of ["2026-11-28", "2027-01-27"])
      expect(schema.safeParse({ signBy }).success).toBe(true);
    for (const signBy of ["2026-11-27", "2027-01-28", "2026-13-01", ""])
      expect(schema.safeParse({ signBy }).success).toBe(false);
  });
  it("round-trips nullable terms, zero overrides and signer fields", () => {
    const contract = salesContractDtoSchema.parse({
      ...contractDraft,
      termsReview: "NONE" as const,
      specialTerms: "Điều khoản riêng",
      penaltyPercent: 0,
      sellerSigner: { name: "Người ký", title: "Giám đốc", authorizationRef: "UQ" },
    });
    const form = toContractForm(
      contract,
      contractDraft.deliverySchedule.flatMap((b) => b.lines.map((l) => l.orderLineId)),
    );
    expect(toContractDraftBody(contractFormSchema.parse(form))).toMatchObject({
      specialTerms: contract.specialTerms,
      penaltyPercent: 0,
      quantityTolerancePercent: null,
      sellerSigner: contract.sellerSigner,
    });
    for (const [field, value] of [
      ["specialTerms", "x".repeat(4001)],
      ["penaltyPercent", "9"],
      ["quantityTolerancePercent", "11"],
      ["warrantyMonths", "37"],
      ["penaltyPercent", "1.5"],
      ["warrantyMonths", "-1"],
    ])
      expect(contractFormSchema.safeParse({ ...form, [field]: value }).success).toBe(false);
  });
});
