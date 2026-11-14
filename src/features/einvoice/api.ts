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
} from "./schemas";

import type {
  CorrectionBasis,
  EInvoiceFileKind,
  EInvoiceStatus,
  EInvoiceType,
} from "@/constants/einvoice";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  AdjustInput,
  AgreementInput,
  DrawUpInput,
  EInvoice,
  EInvoiceListItem,
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
/** Phát hành — trả về `SUBMITTING` ngay; kết quả về sau (docs 21 §4.2 bước 5–6). */
export const issueEInvoice = versioned("issuance");
/** Mở lại hoá đơn bị từ chối thành nháp để sửa (docs 21 §4.2 bước 7). */
export const reopenEInvoice = versioned("reopening");
/** Gửi như giao dịch mới khi NCC xác nhận không giữ hoá đơn (cảnh báo UNKNOWN_TO_PROVIDER, BR-04). */
export const resubmitEInvoice = versioned("resubmission");

export async function voidDraft(input: VersionedInput & { reason: string }): Promise<EInvoice> {
  const { id, ...body } = input;
  const { data } = await api.post<unknown>(`${one(id)}/void`, body);
  return parse(data);
}

/** Tra lại kết quả theo mã giao dịch (docs 21 §4.2 bước 8). */
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
  const { data } = await api.put<unknown>(`${one(input.id)}/agreement`, form);
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
