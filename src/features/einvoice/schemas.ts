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
  EINVOICE_UNKNOWN,
  EXTERNAL_REDUCTION_BASES,
  SIGNATURE_STATUSES,
  WITHDRAWAL_BLOCKS,
  WITHDRAWAL_PROVIDER_STATES,
} from "@/constants/einvoice";
import { bePageSchema } from "@/lib/api/page-schema";

/** Chuỗi BE có thể thêm giá trị mới (cảnh báo, kết quả gọi NCC…) — đọc là chuỗi, hiển thị tra bảng. */
const openString = z.string();

/**
 * Enum BE đọc tolerant (cùng cách `features/order/schemas.ts`): chuỗi ngoài `values` → `UNKNOWN` thay vì
 * làm hỏng cả response — BE PR #369 thêm `CorrectionBasis.DELIVERY_FAILED` và trang chi tiết của điều
 * chỉnh đó không mở được. Chỉ nhận CHUỖI: vắng key / null / sai kiểu ở field bắt buộc vẫn fail.
 */
function tolerantEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.union([
    z.enum(values),
    z.string().transform((): typeof EINVOICE_UNKNOWN => EINVOICE_UNKNOWN),
  ]);
}
const statusSchema = tolerantEnum(EINVOICE_STATUSES);
const typeSchema = tolerantEnum(EINVOICE_TYPES);

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
  type: typeSchema,
  status: statusSchema,
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
  correctionBasis: tolerantEnum(CORRECTION_BASES).nullish(),
  correctionReason: z.string().nullish(),
  /** Điều chỉnh vì sai sót cần văn bản thoả thuận trước khi phát hành (TT 91/2026 Điều 10). */
  agreementRequired: z.boolean(),
  agreement: z.object({ number: z.string(), date: z.string() }).nullish(),
  returnRequestId: z.string().nullish(),
  listedInvoiceIds: z.array(z.string()).nullish(),
  /** Hoá đơn ngày sớm hơn chưa phát hành đang giữ nháp này lại (cảnh báo EARLIER_INVOICE_PENDING). */
  earlierPendingInvoice: z.string().nullish(),
  /**
   * WF-05 HĐ-3: lần giao của hoá đơn bị sửa thành thất bại lúc nào — đã phát hành thì bị điều chỉnh giảm toàn bộ
   * (căn cứ DELIVERY_FAILED), bị từ chối thì huỷ thay vì gửi lại. Vắng khi chưa bị đánh dấu / đã gỡ đánh dấu.
   */
  deliveryFailedAt: z.string().nullish(),
  /**
   * WF-05 F-11 (BE-36): hoá đơn gốc đã bị giảm toàn bộ (giao thất bại) — không còn hiệu lực để điều chỉnh / thay thế.
   * Vắng với BE cũ.
   */
  reversedAt: z.string().nullish(),
  /** WF-05 F-11: NCC của hoá đơn gửi được 04/SS-HĐĐT. Vắng với BE cũ → dự phòng theo `ERROR_NOTICE_PROVIDERS`. */
  errorNoticeSupported: z.boolean().nullish(),
  /** WF-05 F-13: `PROVIDER` (qua API) hoặc `PORTAL_RECORD` (Kế toán ghi lại từ cổng NCC). Chuỗi mở. */
  issuedVia: openString.nullish(),
  /**
   * Ngày giao (Asia/Ho_Chi_Minh, `YYYY-MM-DD`) của lần giao hoá đơn này — để tính "Lập trễ N ngày" (WF-05 Q-10).
   * HỢP ĐỒNG GIẢ ĐỊNH: BE chưa có trường này trên DTO; vắng → nhãn "Lập trễ" không số ngày.
   */
  deliveredOn: z.string().nullish(),
  /**
   * Audit r2 H-2 (BE `WithdrawalRule`): "Rút" (`/withdrawal`) được nhận ngay lúc này, xét theo câu trả lời gần nhất của
   * NCC — cùng luật BE áp khi rút. Vắng (BE cũ) = null → KHÔNG hiện nút (Q-5: hoá đơn NCC đang giữ không bao giờ rút; BE
   * cũ không cho FE biết điều đó).
   */
  withdrawable: z.boolean().nullish(),
  /** Vì sao chưa rút được (`WITHDRAWAL_BLOCKS`); null khi rút được. Mã lạ → UNKNOWN. */
  withdrawalBlockedBy: tolerantEnum(WITHDRAWAL_BLOCKS).nullish(),
  /** TOO_RECENT: rút được từ mốc này (instant). */
  withdrawableFrom: z.string().nullish(),
  /** NCC không xác nhận được kết quả → rút phải kèm `supportReference` (văn bản của hỗ trợ NCC, Q-5). */
  withdrawalEvidenceRequired: z.boolean().nullish(),
  /**
   * Audit r2 M-10 (BE `EInvoicePortalReductions.applicability`): "Ghi hoá đơn giảm" (`/external-reductions`) được nhận.
   * Vắng (BE cũ) = null → không hiện nút.
   */
  externalReductionAllowed: z.boolean().nullish(),
  /** Căn cứ nhận được lúc này: DELIVERY_FAILED và / hoặc RETURN. Căn cứ lạ bị bỏ (không có ô nhập cho nó). */
  externalReductionBases: z
    .array(z.string())
    .nullish()
    .transform((bases) =>
      (bases ?? []).filter((basis): basis is (typeof EXTERNAL_REDUCTION_BASES)[number] =>
        (EXTERNAL_REDUCTION_BASES as readonly string[]).includes(basis),
      ),
    ),
  /** Các yêu cầu trả hàng có hàng đã hoàn tiền đang chờ giảm trên hoá đơn thay thế này — nguồn duy nhất của ô chọn. */
  externalReductionReturns: z
    .array(z.object({ returnRequestId: z.string(), rmaNumber: z.string().nullish() }))
    .nullish()
    .transform((rows) => rows ?? []),
});

/** BE `EInvoiceListItemResponse`. */
export const einvoiceListItemDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: typeSchema,
  status: statusSchema,
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
  /** WF-05 F-11: như chi tiết. */
  reversedAt: z.string().nullish(),
  /** WF-05 F-11: căn cứ của điều chỉnh (danh sách điều chỉnh / thay thế của một hoá đơn gốc). */
  correctionBasis: tolerantEnum(CORRECTION_BASES).nullish(),
  /** HỢP ĐỒNG GIẢ ĐỊNH (như chi tiết). */
  deliveredOn: z.string().nullish(),
});
export const einvoicePageDtoSchema = bePageSchema(einvoiceListItemDtoSchema);

/**
 * Một yêu cầu trả hàng của đơn để chọn khi điều chỉnh / ghi hoá đơn giảm vì trả hàng (BE `GET /returns?orderId=`, dòng
 * `ReturnRequestRowResponse`) — chỉ những trường ô chọn cần; trạng thái đọc như chuỗi (mã lạ vẫn hiện được).
 */
export const orderReturnChoiceDtoSchema = z.object({
  id: z.string(),
  rmaNumber: z.string(),
  status: z.string(),
  requestedAt: z.string().nullish(),
});
export const orderReturnChoicePageDtoSchema = bePageSchema(orderReturnChoiceDtoSchema);

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
  /** Mã theo dõi của NCC (SePay: `<create|adjust|replace>/<tracking_code>`) — bộ phận hỗ trợ NCC hỏi mã này. */
  providerReference: z.string().nullish(),
});

/** BE `EInvoiceSignatureResponse` — chữ ký số của bên bán trên XML, kiểm lúc hỏi (WF-05 BO-09). */
export const signatureDtoSchema = z.object({
  status: tolerantEnum(SIGNATURE_STATUSES),
  valid: z.boolean(),
  signer: z.string().nullish(),
  signerTaxCode: z.string().nullish(),
  signerOrganization: z.string().nullish(),
  issuer: z.string().nullish(),
  signingTime: z.string().nullish(),
  certificateValidFrom: z.string().nullish(),
  certificateValidTo: z.string().nullish(),
  certificateValidAtSigning: z.boolean().nullish(),
  buyerSigned: z.boolean().nullish(),
  chainChecked: z.boolean().nullish(),
});

/**
 * `details` của 409 `EINVOICE_WITHDRAWAL_REFUSED` / `EINVOICE_WITHDRAWAL_EVIDENCE_REQUIRED` (WF-05 F-12, BE-59):
 * mốc rút được (instant | null) và câu trả lời của NCC. Đọc khoan dung — sai hình thì coi như không có.
 */
export const withdrawalRefusalDetailsSchema = z.object({
  withdrawableFrom: z.string().nullish().catch(null),
  // `UNKNOWN` là một câu trả lời thật của NCC ("chưa trả lời rõ") — giá trị lạ đọc là null, không lẫn với nó
  providerState: z.enum(WITHDRAWAL_PROVIDER_STATES).nullish().catch(null),
});

/** `details` của 409 `EINVOICE_DRAFT_OUT_OF_DATE` (WF-05 F-16, BE-25): cảnh báo mới chưa được xác nhận. */
export const draftOutOfDateDetailsSchema = z.object({
  warnings: z.array(z.string()).catch([]),
});

/** BE `EInvoiceMailResendResponse` — gửi lại hoá đơn qua e-mail đã được nhận (audit r2 einvoice M-1). */
export const mailResendDtoSchema = z.object({
  einvoiceId: z.string(),
  /** E-mail nhận hoá đơn của khách lúc này — thư đi tới đây. */
  recipient: z.string().nullish(),
  requestedAt: z.string().nullish(),
});

/** `details` của 409 `EINVOICE_BUYER_PROFILE_INCOMPLETE` khi gửi lại e-mail: `missing` = ["EMAIL"]. */
export const profileMissingDetailsSchema = z.object({
  missing: z.array(z.string()).catch([]),
});

/** `details` của 409 `EINVOICE_INVALID_TRANSITION` khi gửi lại e-mail: `reason` = SIGNATURE_INVALID. */
export const transitionReasonDetailsSchema = z.object({
  reason: z.string().nullish().catch(null),
});

export const fileLinkDtoSchema = z.object({ url: z.string(), expiresAt: z.string() });

/** BE `EInvoiceErrorNoticeResponse` — thông báo sai sót 04/SS-HDDT. */
export const errorNoticeDtoSchema = z.object({
  id: z.string(),
  einvoiceId: z.string(),
  formCode: z.string(),
  subject: tolerantEnum(ERROR_NOTICE_SUBJECTS).nullish(),
  reason: z.string(),
  correctBuyerName: z.string().nullish(),
  correctBuyerAddress: z.string().nullish(),
  status: tolerantEnum(ERROR_NOTICE_STATUSES),
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
  type: typeSchema,
  status: statusSchema,
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

/**
 * BE `EInvoiceProviderResponse`. Cờ khả năng (WF-05 F-11, BE-58) vắng với BE cũ → FE dùng bảng dự phòng trong
 * `@/constants/einvoice` (`DEPLOYMENT_ACCOUNT_PROVIDERS`, `ERROR_NOTICE_PROVIDERS`).
 */
export const einvoiceProviderDtoSchema = z.object({
  provider: z.string(),
  environment: z.string().nullish(),
  username: z.string().nullish(),
  secretSet: z.boolean(),
  active: z.boolean(),
  autoIssue: z.boolean(),
  version: z.number().int(),
  /** Tài khoản đọc từ biến môi trường máy chủ (SePay) — không lưu qua màn này. */
  accountInDeployment: z.boolean().nullish(),
  /** Biến môi trường đủ để gọi NCC. */
  deploymentAccountReady: z.boolean().nullish(),
  issuesCorrections: z.boolean().nullish(),
  adjustsReplacements: z.boolean().nullish(),
  sendsErrorNotices: z.boolean().nullish(),
});
