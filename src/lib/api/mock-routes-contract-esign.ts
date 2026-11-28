/** Mock endpoints from HOP-DONG-API.md; PDFs are demo fixtures, never actual cryptographic validation. */
import { SALES_CONTRACT_PERMISSIONS } from "@/constants";
import {
  CONTRACT_ESIGN_PERMISSIONS as P,
  CONTRACT_ESIGN_LIMITS as LIMITS,
} from "@/constants/contract-esign";
import { SALES_OWNER_PERMISSIONS } from "@/constants/sales-owner";

import { registerMockRoute } from "./mock-adapter";
import { chatCaller } from "./mock-chat-store";
import { contractEsignState, hasNonstandardTerms } from "./mock-contract-esign";
import { loadContract, signContract } from "./mock-contract-rules";
import { contractView } from "./mock-contract-store";
import { mockActorId } from "./mock-display-names";
import { guarded, refuse } from "./mock-quote-refusal";
import { WF02_USERS, addDays, vnDay } from "./mock-quote-seed";
import { bodyOf, ok, pathParams } from "./mock-route-utils";
import { activeCoverOf } from "./mock-routes-sales-work";
import { ownerView } from "./mock-routes-sales-owner";
import { callerWith } from "./mock-sales-owner-store";
import { mockTextPdf } from "./mock-text-pdf";

import type { AxiosRequestConfig } from "axios";

const BASE = "/orders/:id/contract";
const idOf = (config: AxiosRequestConfig) => pathParams(config).id ?? "";
const link = () =>
  ok({
    url: URL.createObjectURL(mockTextPdf(["STOCKFLOW MOCK PDF - not a signed legal document"])),
  });

async function write(
  config: AxiosRequestConfig,
  action: "review" | "approve" | "reject" | "withdraw" | "extend" | "sign" | "upload",
) {
  const permission =
    action === "sign" || action === "upload"
      ? P.signature
      : action === "approve" || action === "reject"
        ? P.terms
        : SALES_CONTRACT_PERMISSIONS.update;
  const caller = await callerWith(permission);
  if (typeof caller !== "string") return caller;
  const form = config.data instanceof FormData ? config.data : null;
  const body = form ? { version: Number(form.get("version")) } : bodyOf(config);
  const { contract, order } = await loadContract(idOf(config), Number(body.version));
  const state = contractEsignState(contract);
  // BR-S12 (sales-owner contract): every new write except company signature observes strict ownership.
  if (action === "review" || action === "withdraw" || action === "extend") {
    const actor = await chatCaller();
    const owner = await ownerView(order.customerId);
    const cover = owner?.salesOwnerId ? await activeCoverOf(owner.salesOwnerId) : null;
    if (
      owner?.salesOwnerId &&
      caller !== owner.salesOwnerId &&
      caller !== cover?.userId &&
      !actor?.can(SALES_OWNER_PERMISSIONS.update)
    )
      refuse(409, "CUSTOMER_OWNED_BY_OTHER_SALES", "Khách đang thuộc Sale khác phụ trách.");
  }
  if (action === "sign" || action === "upload") {
    if (contract.status !== "CUSTOMER_SIGNED")
      refuse(409, "SALES_CONTRACT_STATUS_INVALID", "Khách chưa ký hợp đồng.");
    if (caller === mockActorId(WF02_USERS.sales) || caller === contract.sentBy)
      refuse(409, "CONTRACT_SIGNER_IS_AUTHOR", "Người lập hoặc gửi không được ký.");
    const file = form?.get("file");
    // Conservative mock: cannot validate CMS in the browser. Uploads are inspected as scans and refused here.
    if (action === "upload") {
      if (!(file instanceof File) || file.size > LIMITS.pdfBytes)
        refuse(400, "VALIDATION_FAILED", "Chọn PDF tối đa 20 MB.");
      return refuse(422, "CONTRACT_SIGNED_FILE_REJECTED", "Bản scan không có chữ ký số.", [], {
        reason: "NO_DIGITAL_SIGNATURE",
      });
    }
    const customerSignature = state.signatures.customer;
    const result = await signContract(
      contract.orderId,
      null,
      { version: contract.version, signedOn: vnDay(), uploadId: `${contract.id}.pdf` },
      null,
    );
    if (customerSignature) state.signatures.customer = customerSignature;
    state.signatures.company = {
      method: "SYSTEM",
      signerName:
        typeof body.signerName === "string"
          ? body.signerName
          : (state.sellerSigner?.name ?? contract.seller.representative ?? ""),
      signerTitle:
        typeof body.signerTitle === "string"
          ? body.signerTitle
          : (state.sellerSigner?.title ?? contract.seller.representativeTitle ?? ""),
      signedAt: result.contract.signedAt ?? new Date().toISOString(),
      certificateSubject: contract.seller.name,
      certificateIssuer: "STOCKFLOW TEST CA",
      testCertificate: true,
    };
    return ok(contractView(result.contract, result.order));
  }
  if (action === "extend") {
    const day = typeof body.signBy === "string" ? body.signBy : "";
    if (
      contract.status !== "SENT" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      day < vnDay() ||
      day > addDays(vnDay(), LIMITS.extendDays)
    )
      refuse(400, "VALIDATION_FAILED", "Hạn ký không hợp lệ.");
    state.signBy = day;
  } else {
    if (contract.status !== "DRAFT")
      refuse(409, "SALES_CONTRACT_STATUS_INVALID", "Chỉ duyệt điều khoản hợp đồng nháp.");
    if (action === "review") {
      if (state.termsReview === "PENDING")
        refuse(409, "CONTRACT_TERMS_REVIEW_PENDING", "Hợp đồng đang chờ duyệt điều khoản.");
      if (!hasNonstandardTerms(contract))
        refuse(409, "CONTRACT_TERMS_REVIEW_NOT_NEEDED", "Không cần duyệt điều khoản chuẩn.");
      state.termsReview = "PENDING";
      state.termsReviewDetail = {
        note: null,
        requestedBy: caller,
        requestedAt: new Date().toISOString(),
      };
    } else {
      if (state.termsReview !== "PENDING")
        refuse(409, "CONTRACT_TERMS_REVIEW_NOT_PENDING", "Hợp đồng không còn chờ duyệt.");
      if (action === "reject" && (typeof body.note !== "string" || !body.note.trim()))
        refuse(400, "VALIDATION_FAILED", "Cần lý do từ chối.");
      state.termsReview =
        action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "NONE";
      state.termsReviewDetail =
        action === "withdraw"
          ? null
          : {
              ...state.termsReviewDetail,
              note: typeof body.note === "string" ? body.note : null,
              decidedBy: caller,
              decidedAt: new Date().toISOString(),
            };
    }
  }
  contract.version += 1;
  const result = await loadContract(contract.orderId);
  return ok(contractView(result.contract, result.order));
}
export function registerContractEsignMockRoutes() {
  registerMockRoute(
    "GET",
    `${BASE}/company-signature/identity`,
    guarded(async (config) => {
      const caller = await callerWith(P.signature);
      if (typeof caller !== "string") return caller;
      const { contract } = await loadContract(idOf(config));
      return ok({
        subject: contract.seller.name,
        issuer: "STOCKFLOW TEST CA",
        testCertificate: true,
      });
    }),
  );
  for (const [suffix, action] of [
    ["/terms-review", "review"],
    ["/terms-review/approval", "approve"],
    ["/terms-review/rejection", "reject"],
    ["/terms-review/withdrawal", "withdraw"],
    ["/sign-by", "extend"],
    ["/company-signature", "sign"],
    ["/company-signature/upload", "upload"],
  ] as const)
    registerMockRoute(
      action === "extend" ? "PUT" : "POST",
      `${BASE}${suffix}`,
      guarded((config) => write(config, action)),
    );
  for (const suffix of ["/revisions", "/signatures"] as const)
    registerMockRoute(
      "GET",
      `${BASE}${suffix}`,
      guarded(async (config) => {
        const caller = await callerWith(SALES_CONTRACT_PERMISSIONS.read);
        if (typeof caller !== "string") return caller;
        const { contract } = await loadContract(idOf(config));
        const state = contractEsignState(contract);
        return ok(suffix === "/revisions" ? state.revisions : state.signatures);
      }),
    );
  for (const suffix of ["/revisions/:revision/document", "/company-signature/document"])
    registerMockRoute(
      "GET",
      `${BASE}${suffix}`,
      guarded(async (config) => {
        const caller = await callerWith(
          suffix.includes("company") ? P.signature : SALES_CONTRACT_PERMISSIONS.read,
        );
        if (typeof caller !== "string") return caller;
        await loadContract(idOf(config));
        return link();
      }),
    );
}
