/** Hoá đơn điện tử — API layer (BE `EInvoiceController`). Parse tại biên. Cấu hình: `settings-api.ts`. */

import { z } from "zod";

import { api } from "@/lib/api/client";

import {
  einvoiceDtoSchema,
  einvoiceListItemDtoSchema,
  einvoicePageDtoSchema,
  errorNoticeDtoSchema,
  fileLinkDtoSchema,
  providerCallDtoSchema,
  registerEntryDtoSchema,
  signatureDtoSchema,
} from "./schemas";

import type {
  CorrectionBasis,
  EInvoiceFileKind,
  EInvoiceStatus,
  EInvoiceType,
  ExternalReductionBasis,
  PortalResultOutcome,
} from "@/constants/einvoice";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  AdjustInput,
  AgreementInput,
  DrawUpInput,
  EInvoice,
  EInvoiceListItem,
  EInvoiceSignature,
  ErrorNotice,
  ErrorNoticeInput,
  FileLink,
  ProviderCall,
  RegisterEntry,
  RegisterRange,
  ReplaceInput,
  ReviseDraftInput,
} from "./types";

const BASE = "/einvoices";
const seg = encodeURIComponent;
const one = (id: string) => `${BASE}/${seg(id)}`;
const parse = (data: unknown) => einvoiceDtoSchema.parse(data);

export interface ListEInvoiceParams extends ListQueryParams {
  status?: EInvoiceStatus;
  type?: EInvoiceType;
  orderId?: string;
  customerId?: string;
  /** `YYYY-MM-DD` — ngày lập từ / đến. */
  issuedFrom?: string;
  issuedTo?: string;
  /** ISO instant: chưa phát hành và hạn phát hành trước mốc này. */
  dueBefore?: string;
  /**
   * Chỉ hoá đơn mang cảnh báo này (bộ lọc "Hoá đơn lập trễ" = `ISSUED_LATE`, WF-05 Q-10) — BE G3 `GET /einvoices
   * ?warning=` (enum `EInvoice.Warning`) lọc ở máy chủ nên tổng số / số trang đúng.
   */
  warning?: string;
}

export async function listEInvoices(
  params: ListEInvoiceParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<EInvoiceListItem>> {
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 15),
  });
  for (const key of [
    "status",
    "type",
    "orderId",
    "customerId",
    "issuedFrom",
    "issuedTo",
    "dueBefore",
    "warning",
  ] as const) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  const { data } = await api.get<unknown>(BASE, { params: query, signal });
  return einvoicePageDtoSchema.parse(data);
}

export async function getEInvoice(id: string, signal?: AbortSignal): Promise<EInvoice> {
  const { data } = await api.get<unknown>(one(id), { signal });
  return parse(data);
}

export async function listProviderCalls(id: string, signal?: AbortSignal): Promise<ProviderCall[]> {
  const { data } = await api.get<unknown>(`${one(id)}/provider-calls`, { signal });
  return z.array(providerCallDtoSchema).parse(data);
}

/** Link tải XML / PDF có hạn ngắn; 409 `EINVOICE_NOT_ISSUED` trước khi phát hành. */
export async function getFileLink(id: string, kind: EInvoiceFileKind): Promise<FileLink> {
  const { data } = await api.get<unknown>(`${one(id)}/files/${kind}`);
  return fileLinkDtoSchema.parse(data);
}

export async function listCorrections(
  id: string,
  signal?: AbortSignal,
): Promise<EInvoiceListItem[]> {
  const { data } = await api.get<unknown>(`${one(id)}/corrections`, { signal });
  return z.array(einvoiceListItemDtoSchema).parse(data);
}

/* ── Nháp & phát hành (docs 21 §4.1–4.2, §4.5) ───────────────────────────────────── */

export async function drawUpEInvoice(input: DrawUpInput): Promise<EInvoice> {
  const { data } = await api.post<unknown>(BASE, input);
  return parse(data);
}

export interface VersionedInput {
  id: string;
  version: number;
}

export async function reviseDraft(
  input: VersionedInput & Partial<ReviseDraftInput> & { lineNames?: Record<string, string> },
): Promise<EInvoice> {
  const { id, ...body } = input;
  const { data } = await api.put<unknown>(one(id), body);
  return parse(data);
}

const versioned =
  (action: string) =>
  async ({ id, version }: VersionedInput): Promise<EInvoice> => {
    const { data } = await api.post<unknown>(`${one(id)}/${action}`, { version });
    return parse(data);
  };

/** Chép lại bên mua từ hồ sơ pháp lý của khách (docs 21 §4.2 bước 4). */
export const refreshBuyer = versioned("buyer-refresh");
export interface IssueInput extends VersionedInput {
  /** Cảnh báo Kế toán đã xem lúc bấm phát hành (WF-05 F-16, BE-25); BE kiểm lại, có cảnh báo mới → 409. */
  acknowledgedWarnings?: string[];
  /**
   * Lý do phát hành trễ (sau ngày giao) — BE G3 `IssueEInvoiceRequest.lateReason` (≤ 500), ghi nhật ký audit (WF-05
   * Q-10). Bắt buộc với hoá đơn gốc phát hành sau ngày giao (400 `EINVOICE_LATE_ISSUE_REASON_REQUIRED`), bỏ qua khi khác.
   */
  lateReason?: string;
}

/**
 * Phát hành — trả về `SUBMITTING` ngay; kết quả về sau (docs 21 §4.2 bước 5–6). Chỉ gửi `acknowledgedWarnings` /
 * `lateReason` khi có (BE cũ chỉ nhận `{version}`).
 */
export async function issueEInvoice(input: IssueInput): Promise<EInvoice> {
  const { id, version, acknowledgedWarnings, lateReason } = input;
  const body: Record<string, unknown> = { version };
  if (acknowledgedWarnings && acknowledgedWarnings.length > 0)
    body.acknowledgedWarnings = acknowledgedWarnings;
  const reason = lateReason?.trim();
  if (reason) body.lateReason = reason;
  const { data } = await api.post<unknown>(`${one(id)}/issuance`, body);
  return parse(data);
}
/** Mở lại hoá đơn bị từ chối thành nháp để sửa (docs 21 §4.2 bước 7). */
export const reopenEInvoice = versioned("reopening");
/** Gửi như giao dịch mới khi NCC xác nhận không giữ hoá đơn (cảnh báo UNKNOWN_TO_PROVIDER, BR-04). */
export const resubmitEInvoice = versioned("resubmission");

/**
 * Huỷ nháp. `reasonCode: "UNSENDABLE_REVERSAL"` = huỷ bản giảm do giao thất bại không gửi được qua NCC (WF-05 Q-8,
 * F-14); BE 409 `EINVOICE_REVERSAL_STILL_SENDABLE` khi nó vẫn gửi được.
 */
export async function voidDraft(
  input: VersionedInput & { reason: string; reasonCode?: string },
): Promise<EInvoice> {
  const { id, reasonCode, ...body } = input;
  const { data } = await api.post<unknown>(
    `${one(id)}/void`,
    reasonCode ? { ...body, reasonCode } : body,
  );
  return parse(data);
}

/**
 * Rút hoá đơn kẹt ở NCC (SUBMITTING → REJECTED, lý do = điều Kế toán đã kiểm trên cổng NCC) để mở lại và phát hành
 * như giao dịch mới (BE HĐ-1). WF-05 Q-5 / F-12: `supportReference` (≤ 200) = số phiếu / nội dung trả lời của hỗ trợ
 * NCC — bắt buộc khi NCC không xác nhận được kết quả (409 `EINVOICE_WITHDRAWAL_EVIDENCE_REQUIRED`); từ chối khác:
 * 409 `EINVOICE_WITHDRAWAL_REFUSED` + `details`.
 */
export async function withdrawEInvoice(
  input: VersionedInput & { reason: string; supportReference?: string },
): Promise<EInvoice> {
  const { id, supportReference, ...body } = input;
  const reference = supportReference?.trim();
  const { data } = await api.post<unknown>(
    `${one(id)}/withdrawal`,
    reference ? { ...body, supportReference: reference } : body,
  );
  return parse(data);
}

const MULTIPART = { headers: { "Content-Type": "multipart/form-data" } };

export interface PortalResultInput extends VersionedInput {
  outcome: PortalResultOutcome;
  invoiceNumber?: number;
  taxAuthorityCode?: string;
  lookupCode?: string;
  xml?: File;
  pdf?: File;
  note: string;
}

/**
 * Ghi kết quả Kế toán đã kiểm trên cổng NCC cho hoá đơn kẹt "đang gửi" (WF-05 Q-8, BE-08, F-13; `einvoices:APPROVE`).
 * BE tra lại NCC: khác → 409 `EINVOICE_PORTAL_RECORD_MISMATCH`; tệp sai → 422 `EINVOICE_PORTAL_FILE_INVALID`.
 */
export async function recordPortalResult(input: PortalResultInput): Promise<EInvoice> {
  const form = new FormData();
  form.append("outcome", input.outcome);
  if (input.invoiceNumber !== undefined) form.append("invoiceNumber", String(input.invoiceNumber));
  if (input.taxAuthorityCode) form.append("taxAuthorityCode", input.taxAuthorityCode);
  if (input.lookupCode) form.append("lookupCode", input.lookupCode);
  if (input.xml) form.append("xml", input.xml);
  if (input.pdf) form.append("pdf", input.pdf);
  form.append("note", input.note);
  form.append("version", String(input.version));
  const { data } = await api.post<unknown>(`${one(input.id)}/portal-result`, form, MULTIPART);
  return parse(data);
}

export interface ExternalReductionInput {
  id: string;
  symbol: string;
  templateCode: string;
  invoiceNumber: number;
  /** `YYYY-MM-DD` — ngày của hoá đơn giảm trên cổng NCC. */
  issueDate: string;
  pdf: File;
  /** BE G3: bắt buộc — XML là hoá đơn theo luật, số / ký hiệu / ngày đã nhập được đối chiếu với nó. */
  xml: File;
  note: string;
  /** Căn cứ (BE `CorrectionBasis`): DELIVERY_FAILED (mặc định của BE) hoặc RETURN kèm `returnRequestId`. */
  basis: ExternalReductionBasis;
  returnRequestId?: string;
}

/**
 * Ghi hoá đơn giảm Kế toán đã làm trên cổng NCC (WF-05 Q-8 / Q-9, BE-10, F-13): sau khi bản giảm không gửi được bị
 * huỷ, hoặc với hoá đơn thay thế cần giảm (giao thất bại, hoặc trả hàng — `basis` RETURN + `returnRequestId`). BE đọc
 * tệp XML và đối chiếu với số đã nhập (422 `EINVOICE_PORTAL_FILE_INVALID`); không hỏi lại NCC. Trả về hoá đơn điều chỉnh
 * mới (`issuedVia` PORTAL_RECORD).
 */
export async function recordExternalReduction(input: ExternalReductionInput): Promise<EInvoice> {
  const form = new FormData();
  form.append("symbol", input.symbol);
  form.append("templateCode", input.templateCode);
  form.append("invoiceNumber", String(input.invoiceNumber));
  form.append("issueDate", input.issueDate);
  form.append("pdf", input.pdf);
  form.append("xml", input.xml);
  form.append("note", input.note);
  form.append("basis", input.basis);
  if (input.basis === "RETURN" && input.returnRequestId)
    form.append("returnRequestId", input.returnRequestId);
  const { data } = await api.post<unknown>(`${one(input.id)}/external-reductions`, form, MULTIPART);
  return parse(data);
}

/**
 * Lập bản giảm do giao thất bại cho hoá đơn gốc mà lần giao không còn "đã giao" (WF-05 BE-11, F-15). 409
 * `EINVOICE_REVERSAL_NOT_APPLICABLE` khi không áp dụng.
 */
export const reduceFailedDelivery = versioned("delivery-failure-reduction");

/** Chữ ký số trên XML của hoá đơn đã phát hành, kiểm lúc hỏi (BO-09). 409 `EINVOICE_NOT_ISSUED` trước khi phát hành. */
export async function getSignature(id: string, signal?: AbortSignal): Promise<EInvoiceSignature> {
  const { data } = await api.get<unknown>(`${one(id)}/signature`, { signal });
  return signatureDtoSchema.parse(data);
}

/** Kiểm chữ ký một tệp XML bất kỳ (bản của khách, bản nghi bị sửa) — không lưu gì; > 5 MB → 413. */
export async function checkSignature(file: File): Promise<EInvoiceSignature> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<unknown>(`${BASE}/signature-checks`, form, MULTIPART);
  return signatureDtoSchema.parse(data);
}

/** Kiểm tra lại kết quả theo mã giao dịch (docs 21 §4.2 bước 8). */
export async function reconcileEInvoice({ id }: { id: string }): Promise<EInvoice> {
  const { data } = await api.post<unknown>(`${one(id)}/reconciliation`, {});
  return parse(data);
}

/* ── Điều chỉnh, thay thế, thoả thuận (docs 21 §4.4) ─────────────────────────────── */

export async function adjustEInvoice(input: { id: string } & AdjustInput): Promise<EInvoice> {
  const { id, ...body } = input;
  const { data } = await api.post<unknown>(`${one(id)}/adjustments`, body);
  return parse(data);
}

export async function replaceEInvoice(input: { id: string } & ReplaceInput): Promise<EInvoice> {
  const { id, ...body } = input;
  const { data } = await api.post<unknown>(`${one(id)}/replacements`, body);
  return parse(data);
}

export async function attachAgreement(input: VersionedInput & AgreementInput): Promise<EInvoice> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("number", input.number);
  form.append("date", input.date);
  form.append("version", String(input.version));
  // Client mặc định gửi JSON: phải nói rõ multipart, nếu không axios đổi FormData thành JSON
  const { data } = await api.put<unknown>(`${one(input.id)}/agreement`, form, MULTIPART);
  return parse(data);
}

export async function getAgreementLink(id: string): Promise<FileLink> {
  const { data } = await api.get<unknown>(`${one(id)}/agreement`);
  return fileLinkDtoSchema.parse(data);
}

/* ── Thông báo sai sót 04/SS-HDDT ────────────────────────────────────────────────── */

export async function listErrorNotices(id: string, signal?: AbortSignal): Promise<ErrorNotice[]> {
  const { data } = await api.get<unknown>(`${one(id)}/error-notices`, { signal });
  return z.array(errorNoticeDtoSchema).parse(data);
}

export async function recordErrorNotice(
  input: { id: string } & Pick<ErrorNoticeInput, "reason"> & Partial<ErrorNoticeInput>,
): Promise<ErrorNotice> {
  const { id, ...body } = input;
  const { data } = await api.post<unknown>(`${one(id)}/error-notices`, {
    subject: "BUYER_NAME_ADDRESS",
    ...body,
  });
  return errorNoticeDtoSchema.parse(data);
}

export async function sendErrorNotice(input: {
  id: string;
  noticeId: string;
}): Promise<ErrorNotice> {
  const { data } = await api.post<unknown>(
    `${one(input.id)}/error-notices/${seg(input.noticeId)}/sending`,
    {},
  );
  return errorNoticeDtoSchema.parse(data);
}

/* ── Bảng kê ─────────────────────────────────────────────────────────────────────── */

export async function getRegister(
  range: RegisterRange,
  signal?: AbortSignal,
): Promise<RegisterEntry[]> {
  const { data } = await api.get<unknown>(`${BASE}/register`, {
    params: new URLSearchParams(range),
    signal,
  });
  return z.array(registerEntryDtoSchema).parse(data);
}

/** CSV UTF-8 có BOM — trả về Blob để tải xuống. */
export async function exportRegister(range: RegisterRange): Promise<Blob> {
  const { data } = await api.get<Blob>(`${BASE}/register/export`, {
    params: new URLSearchParams(range),
    responseType: "blob",
  });
  return data;
}

export type { CorrectionBasis };
