/**
 * Hoá đơn điện tử — DTO của BE (module `invoicing`: `EInvoiceController`, `EInvoiceSettingsController`).
 * Schema nhập liệu: `input-schemas.ts`. Jackson `non_null` bỏ trường chưa đặt → `.nullish()`.
 * Docs: ecommerce/21-e-invoice.
 */

import { z } from "zod";

import {
  CORRECTION_BASES,
  EINVOICE_STATUSES,
  EINVOICE_TYPES,
  ERROR_NOTICE_STATUSES,
  ERROR_NOTICE_SUBJECTS,
} from "@/constants/einvoice";
import { bePageSchema } from "@/lib/api/page-schema";

/** Chuỗi BE có thể thêm giá trị mới (cảnh báo, kết quả gọi NCC…) — đọc là chuỗi, hiển thị tra bảng. */
const openString = z.string();

export const partyDtoSchema = z.object({
  name: z.string().nullish(),
  taxCode: z.string().nullish(),
  address: z.string().nullish(),
  email: z.string().nullish(),
});

export const einvoiceLineDtoSchema = z.object({
  id: z.string(),
  lineNo: z.number().int(),
  /** BE `EInvoiceLine.Kind`: GOODS (hàng), FEE (phí khuôn / vận chuyển), NOTE (dòng ghi chú). */
  kind: openString,
  feeKind: z.string().nullish(),
  orderLineId: z.string().nullish(),
  sku: z.string().nullish(),
  itemName: z.string(),
  unit: z.string().nullish(),
  quantity: z.number().int(),
  unitsPerCarton: z.number().int().nullish(),
  unitPrice: z.number(),
  taxRate: z.number().nullish(),
  amount: z.number(),
  taxAmount: z.number(),
});

export const taxRateTotalDtoSchema = z.object({
  taxRate: z.number().nullish(),
  amount: z.number(),
  taxAmount: z.number(),
});

/** BE `EInvoiceResponse` — chi tiết một hoá đơn (docs 21 §3 Output). */
export const einvoiceDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: z.enum(EINVOICE_TYPES),
  status: z.enum(EINVOICE_STATUSES),
  /** Đã có ít nhất một hoá đơn điều chỉnh phát hành (docs 21 §5.1 `Adjusted` — BE là cờ). */
  adjusted: z.boolean(),
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  contractNumber: z.string().nullish(),
  shipmentId: z.string().nullish(),
  shipmentCode: z.string().nullish(),
  deliveryBatchId: z.string().nullish(),
  customerId: z.string(),
  originalEInvoiceId: z.string().nullish(),
  provider: z.string().nullish(),
  templateCode: z.string().nullish(),
  symbol: z.string().nullish(),
  invoiceNumber: z.number().int().nullish(),
  taxAuthorityCode: z.string().nullish(),
  lookupCode: z.string().nullish(),
  /** Ngày lập = thời điểm hãng báo giao thành công (docs 21 §4.1, open-questions G8). */
  issueDate: z.string().nullish(),
  /** Hạn phát hành; quá hạn mà chưa phát hành → `overdue`. */
  issueDueAt: z.string().nullish(),
  overdue: z.boolean(),
  signedAt: z.string().nullish(),
  seller: partyDtoSchema.nullish(),
  buyer: partyDtoSchema.nullish(),
  currency: z.string(),
  paymentMethod: z.string().nullish(),
  lines: z.array(einvoiceLineDtoSchema),
  totalsByRate: z.array(taxRateTotalDtoSchema),
  subtotal: z.number(),
  taxTotal: z.number(),
  grandTotal: z.number(),
  amountInWords: z.string().nullish(),
  warnings: z.array(openString),
  rejectionCode: z.string().nullish(),
  rejectionMessage: z.string().nullish(),
  submittedAt: z.string().nullish(),
  issuedAt: z.string().nullish(),
  voidedAt: z.string().nullish(),
  voidReason: z.string().nullish(),
  hasFiles: z.boolean(),
  /** Khoá lạc quan: mọi thao tác ghi gửi lại `version` đã đọc. */
  version: z.number().int(),
  correctionBasis: z.enum(CORRECTION_BASES).nullish(),
  correctionReason: z.string().nullish(),
  /** Điều chỉnh vì sai sót cần văn bản thoả thuận trước khi phát hành (TT 91/2026 Điều 10). */
  agreementRequired: z.boolean(),
  agreement: z.object({ number: z.string(), date: z.string() }).nullish(),
  returnRequestId: z.string().nullish(),
  listedInvoiceIds: z.array(z.string()).nullish(),
  /** Hoá đơn ngày sớm hơn chưa phát hành đang giữ nháp này lại (cảnh báo EARLIER_INVOICE_PENDING). */
  earlierPendingInvoice: z.string().nullish(),
});

/** BE `EInvoiceListItemResponse`. */
export const einvoiceListItemDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: z.enum(EINVOICE_TYPES),
  status: z.enum(EINVOICE_STATUSES),
  adjusted: z.boolean(),
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  shipmentId: z.string().nullish(),
  shipmentCode: z.string().nullish(),
  customerId: z.string(),
  buyerName: z.string().nullish(),
  buyerTaxCode: z.string().nullish(),
  issueDate: z.string().nullish(),
  issueDueAt: z.string().nullish(),
  overdue: z.boolean(),
  templateCode: z.string().nullish(),
  symbol: z.string().nullish(),
  invoiceNumber: z.number().int().nullish(),
  subtotal: z.number(),
  taxTotal: z.number(),
  grandTotal: z.number(),
  warnings: z.array(openString),
  rejectionCode: z.string().nullish(),
  issuedAt: z.string().nullish(),
});
export const einvoicePageDtoSchema = bePageSchema(einvoiceListItemDtoSchema);

/** BE `ProviderCallResponse` — nhật ký gọi nhà cung cấp (docs 21 §3 Output). */
export const providerCallDtoSchema = z.object({
  provider: z.string(),
  transactionId: z.string().nullish(),
  operation: openString,
  outcome: openString,
  httpStatus: z.number().int().nullish(),
  errorCode: z.string().nullish(),
  calledAt: z.string(),
  durationMs: z.number(),
});

export const fileLinkDtoSchema = z.object({ url: z.string(), expiresAt: z.string() });

/** BE `EInvoiceErrorNoticeResponse` — thông báo sai sót 04/SS-HDDT. */
export const errorNoticeDtoSchema = z.object({
  id: z.string(),
  einvoiceId: z.string(),
  formCode: z.string(),
  subject: z.enum(ERROR_NOTICE_SUBJECTS).nullish(),
  reason: z.string(),
  correctBuyerName: z.string().nullish(),
  correctBuyerAddress: z.string().nullish(),
  status: z.enum(ERROR_NOTICE_STATUSES),
  sentAt: z.string().nullish(),
  responseCode: z.string().nullish(),
  responseMessage: z.string().nullish(),
  respondedAt: z.string().nullish(),
  recordedBy: z.string().nullish(),
  recordedAt: z.string(),
  formName: z.string().nullish(),
});

/** BE `EInvoiceRegisterEntryResponse` — bảng kê theo kỳ. */
export const registerEntryDtoSchema = z.object({
  templateCode: z.string(),
  symbol: z.string(),
  invoiceNumber: z.number().int(),
  issueDate: z.string(),
  type: z.enum(EINVOICE_TYPES),
  status: z.enum(EINVOICE_STATUSES),
  adjusted: z.boolean(),
  buyerName: z.string().nullish(),
  buyerTaxCode: z.string().nullish(),
  buyerAddress: z.string().nullish(),
  orderNumber: z.string().nullish(),
  subtotal: z.number(),
  taxTotal: z.number(),
  grandTotal: z.number(),
  taxAuthorityCode: z.string().nullish(),
  lookupCode: z.string().nullish(),
  originalReference: z.string().nullish(),
  totalsByRate: z.array(taxRateTotalDtoSchema),
});

/* ── Cấu hình (System Admin) ───────────────────────────────────────────────────────── */

export const einvoiceSettingsDtoSchema = z.object({
  provider: z.string(),
  environment: z.string().nullish(),
  endpoint: z.string().nullish(),
  username: z.string().nullish(),
  /** Mật khẩu đã lưu — không bao giờ trả lại giá trị (docs 21 BR-10). */
  secretSet: z.boolean(),
  autoIssue: z.boolean(),
  series: z.array(
    z.object({ templateCode: z.string(), symbol: z.string(), year: z.number().int() }),
  ),
  version: z.number().int(),
});

export const einvoiceProviderDtoSchema = z.object({
  provider: z.string(),
  environment: z.string().nullish(),
  username: z.string().nullish(),
  secretSet: z.boolean(),
  active: z.boolean(),
  autoIssue: z.boolean(),
  version: z.number().int(),
});
