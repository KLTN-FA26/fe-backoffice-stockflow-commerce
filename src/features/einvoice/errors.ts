/**
 * Lỗi BE của module hoá đơn điện tử → câu tiếng Việt (BE trả message tiếng Anh; FE chọn câu theo
 * `errorCode`, ErrorCode.java). Không hiện chữ của BE.
 */

import { WITHDRAWAL_PROVIDER_STATE_LABELS } from "@/constants/labels-einvoice";
import { ApiError } from "@/lib/api/error";
import { apiErrorMessage, apiFieldErrors } from "@/lib/api/error-message";
import { formatDateTime } from "@/lib/format/date";

import { draftOutOfDateDetailsSchema, withdrawalRefusalDetailsSchema } from "./schemas";
import { warningLabel } from "./selectors";

export const EINVOICE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  EINVOICE_NOT_FOUND: "Không tìm thấy hoá đơn điện tử.",
  EINVOICE_INVALID_TRANSITION: "Trạng thái hiện tại của hoá đơn không cho phép thao tác này.",
  EINVOICE_NOT_DRAFT: "Chỉ sửa được hoá đơn nháp. Dữ liệu đã được tải lại.",
  // docs 21 BR-06: tên, mã số thuế, địa chỉ bên mua bắt buộc trước khi phát hành
  EINVOICE_BUYER_PROFILE_INCOMPLETE:
    "Thiếu tên, mã số thuế hoặc địa chỉ bên mua. Nhờ Sale bổ sung hồ sơ khách rồi bấm “Làm mới bên mua”.",
  EINVOICE_NOT_INVOICEABLE: "Lần giao này chưa giao thành công nên chưa lập được hoá đơn.",
  EINVOICE_DELIVERY_TIME_MISSING:
    "Lần giao chưa có thời điểm giao thành công để ghi ngày lập. Nhờ Quản lý kho ghi nhận trước.",
  EINVOICE_SERIES_NOT_CONFIGURED:
    "Chưa cấu hình ký hiệu hoá đơn cho năm của hoá đơn. Nhờ Quản trị hệ thống cấu hình.",
  // BE `findEarlierSubmitting`: hoá đơn cùng NCC / mẫu số / ký hiệu, ngày lập sớm hơn, đang SUBMITTING —
  // nháp hay bị từ chối ngày sớm hơn KHÔNG chặn (chỉ là cảnh báo EARLIER_INVOICE_PENDING)
  EINVOICE_OLDER_DRAFT_PENDING:
    "Một hoá đơn cùng ký hiệu có ngày lập sớm hơn đang chờ nhà cung cấp trả kết quả. Chờ kết quả của hoá đơn đó (hoặc bấm “Kiểm tra lại” trên hoá đơn đó) rồi phát hành hoá đơn này.",
  EINVOICE_NOT_ISSUED: "Hoá đơn chưa phát hành nên chưa có tệp XML / PDF.",
  EINVOICE_PROVIDER_UNAVAILABLE:
    "Nhà cung cấp hoá đơn điện tử đang không phản hồi. Hệ thống sẽ tự kiểm tra lại.",
  EINVOICE_PROVIDER_ACCOUNT_INCOMPLETE:
    "Chưa lưu tài khoản nhà cung cấp hoá đơn điện tử. Nhờ Quản trị hệ thống cấu hình.",
  // docs 21 BR-04 / BR-05: chống phát hành trùng
  EINVOICE_RESUBMISSION_REFUSED:
    "Không gửi lại được: nhà cung cấp có thể đang giữ hoá đơn này. Liên hệ nhà cung cấp rồi bấm “Kiểm tra lại”.",
  // BE HĐ-1 / WF-05 Q-5, BE-59: câu chung; `einvoiceErrorMessage` ghép thêm câu trả lời của NCC và "Rút được từ
  // <giờ>" từ `details` (FE không tự tính mốc).
  EINVOICE_WITHDRAWAL_REFUSED:
    "Chưa rút được hoá đơn. Bấm “Kiểm tra lại” để hỏi lại nhà cung cấp rồi thử rút sau.",
  // WF-05 Q-5 (F-12): không xác nhận được kết quả → phải có văn bản của bộ phận hỗ trợ NCC
  EINVOICE_WITHDRAWAL_EVIDENCE_REQUIRED:
    "Không xác nhận được kết quả với nhà cung cấp: chỉ rút được khi có văn bản trả lời của bộ phận hỗ trợ nhà cung cấp. Nhập số phiếu hoặc nội dung trả lời rồi rút lại.",
  // WF-05 Q-8 (F-13): số / ký hiệu / ngày nhập khác bản ghi tra lại từ NCC
  EINVOICE_PORTAL_RECORD_MISMATCH:
    "Số, ký hiệu hoặc ngày vừa nhập không khớp với bản ghi tra lại từ nhà cung cấp. Kiểm tra lại trên cổng nhà cung cấp rồi nhập đúng.",
  EINVOICE_PORTAL_FILE_INVALID:
    "Tệp XML / PDF không đọc được, hoặc XML là của hoá đơn khác (số, ký hiệu, mã số thuế bên bán). Tải đúng tệp của hoá đơn này từ cổng nhà cung cấp.",
  // WF-05 Q-8 (F-14)
  EINVOICE_REVERSAL_STILL_SENDABLE:
    "Bản giảm này vẫn gửi được qua nhà cung cấp — hãy phát hành nó. Chỉ huỷ khi nhà cung cấp không còn dùng được, không điều chỉnh được, hoặc đã từ chối nhiều lần.",
  EINVOICE_EXTERNAL_REDUCTION_NOT_APPLICABLE:
    "Hoá đơn này không cần ghi hoá đơn giảm làm ngoài hệ thống: chưa có bản giảm không gửi được bị huỷ, và đây không phải hoá đơn thay thế cần giảm.",
  // WF-05 BE-11 (F-15)
  EINVOICE_REVERSAL_NOT_APPLICABLE:
    "Không lập bản giảm do giao thất bại được: hoá đơn không còn hiệu lực, lần giao hiện đang là “đã giao”, hoặc hoá đơn đã được giảm.",
  // WF-05 BE-25 (F-16): `einvoiceErrorMessage` ghép thêm các cảnh báo mới từ `details.warnings`
  EINVOICE_DRAFT_OUT_OF_DATE:
    "Nháp vừa được kiểm lại và có cảnh báo mới. Xem các cảnh báo rồi bấm phát hành lại nếu vẫn đúng.",
  // WF-05 Q-10, Q-1 §1.5 bước 6
  EINVOICE_LATE_ISSUE_REASON_REQUIRED:
    "Hoá đơn phát hành sau ngày giao (lập trễ): nhập lý do phát hành trễ rồi phát hành lại.",
  // WF-05 Q-9: trả hàng / chiết khấu / giao thất bại trên hoá đơn thay thế
  EINVOICE_REPLACEMENT_NOT_ADJUSTABLE:
    "Không điều chỉnh được hoá đơn thay thế. Trả hàng hoặc giao thất bại trên hoá đơn thay thế: Kế toán làm trên cổng nhà cung cấp rồi ghi lại số và tệp vào hệ thống (không dùng “Thay thế” cho trả hàng).",
  // WF-05 Q-22 BR-09
  EINVOICE_QUOTA_EXHAUSTED:
    "Nhà cung cấp đã hết lượt phát hành hoá đơn. Hoá đơn vẫn là nháp, không gửi đi; nạp thêm lượt xong hệ thống tự phát hành tiếp.",
  // BO-10: thiếu khoá mã hoá bí mật của máy chủ (BE `EInvoiceProviderAccountService.storeAccount`)
  SECRETS_UNAVAILABLE:
    "Máy chủ chưa cấu hình khoá mã hoá bí mật nên chưa lưu được mật khẩu. Nhờ quản trị máy chủ cấu hình rồi thử lại.",
  // BO-10: điều chỉnh vì trả hàng nêu mã yêu cầu trả hàng không có (BE `EInvoiceCorrections`)
  RETURN_REQUEST_NOT_FOUND: "Không tìm thấy yêu cầu trả hàng với mã đã nhập.",
  // BE HĐ-5: điều chỉnh / thay thế chỉ đi qua NCC đã phát hành hoá đơn gốc
  EINVOICE_ORIGINAL_PROVIDER_UNAVAILABLE:
    "Nhà cung cấp đã phát hành hoá đơn gốc không còn dùng được (chưa có tài khoản hoặc ký hiệu cho năm). Không gửi điều chỉnh / thay thế qua nhà cung cấp khác — nhờ Quản trị hệ thống cấu hình lại.",
  // BE HĐ-1: NCC không có mẫu số + ký hiệu này trên tài khoản
  EINVOICE_SERIES_NOT_AT_PROVIDER:
    "Nhà cung cấp không có mẫu số và ký hiệu này trên tài khoản. Nhờ Quản trị hệ thống chọn ký hiệu đã đăng ký với nhà cung cấp.",
  // BE HĐ-7: dòng thuế suất 0% (không chịu thuế) chưa phát hành được
  EINVOICE_TAX_EXEMPT_NOT_SUPPORTED:
    "Hoá đơn có dòng hàng không chịu thuế (0%) — chưa phát hành được. Sửa nhóm thuế của sản phẩm rồi huỷ và lập lại hoá đơn nháp.",
  EINVOICE_PROVIDER_CANNOT_CORRECT:
    "Nhà cung cấp đang dùng chưa hỗ trợ điều chỉnh / thay thế. Chứng từ được giữ ở dạng nháp.",
  EINVOICE_NOT_IN_FORCE: "Chỉ điều chỉnh / thay thế được hoá đơn đã phát hành còn hiệu lực.",
  // docs 21 BR-08: đã điều chỉnh thì không thay thế và ngược lại
  // WF-05 Q-9: sai sót trên hoá đơn thay thế → lập thay thế tiếp
  EINVOICE_CORRECTION_FORM_FIXED:
    "Hoá đơn đang được chỉnh theo hình thức kia (điều chỉnh / thay thế) — giữ hình thức đã dùng trước. Sai sót trên hoá đơn thay thế thì lập hoá đơn thay thế mới.",
  EINVOICE_CORRECTION_NOT_APPLICABLE: "Cách chỉnh này không áp dụng cho hoá đơn này.",
  EINVOICE_AGREEMENT_REQUIRED:
    "Cần gắn văn bản thoả thuận với bên mua (tệp, số, ngày) trước khi phát hành điều chỉnh vì sai sót.",
  EINVOICE_ADJUSTMENT_EXCEEDS_INVOICE: "Điều chỉnh giảm vượt quá giá trị còn lại của hoá đơn.",
  EINVOICE_ERROR_NOTICE_NOT_FOUND: "Không tìm thấy thông báo sai sót.",
  EINVOICE_ERROR_NOTICE_NOT_SENDABLE:
    "Không gửi được thông báo này: hoá đơn còn thông báo khác đang mở, hoặc thông báo đã có phản hồi.",
  // BE HĐ-6: SePay / Viettel không gửi được mẫu 04/SS-HĐĐT
  EINVOICE_ERROR_NOTICE_NOT_SUPPORTED:
    "Nhà cung cấp của hoá đơn này không gửi được thông báo sai sót. Lập mẫu 04/SS-HĐĐT trên cổng của nhà cung cấp hoặc cổng cơ quan thuế.",
  // BE `EInvoiceDrafts`: máy chủ chưa cấu hình thông tin bên bán (stockflow.seller.*)
  SELLER_PROFILE_UNAVAILABLE:
    "Máy chủ chưa cấu hình thông tin bên bán (tên, mã số thuế, địa chỉ) nên chưa lập được hoá đơn. Nhờ quản trị máy chủ cấu hình.",
  CUSTOMER_NOT_FOUND: "Không tìm thấy khách hàng của đơn để ghi bên mua trên hoá đơn.",
  STORAGE_ERROR: "Không lưu / đọc được tệp trên kho lưu trữ. Thử lại sau ít phút.",
  UNSUPPORTED_MEDIA_TYPE: "Văn bản thoả thuận phải là tệp PDF.",
  OPTIMISTIC_LOCK: "Hoá đơn vừa được người khác cập nhật. Dữ liệu đã được tải lại.",
};

/** Cảnh báo mới BE vừa thấy khi kiểm lại nháp lúc phát hành tay (`details.warnings`, WF-05 F-16). */
export function outOfDateWarnings(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.code !== "EINVOICE_DRAFT_OUT_OF_DATE") return [];
  const parsed = draftOutOfDateDetailsSchema.safeParse(error.details ?? {});
  return parsed.success ? parsed.data.warnings : [];
}

export interface WithdrawalRefusal {
  providerState: string | null;
  withdrawableFrom: string | null;
  /** Q-5: lần rút sau phải kèm văn bản của bộ phận hỗ trợ NCC. */
  evidenceRequired: boolean;
}

/** `details` của lần rút bị từ chối (WF-05 F-12, BE-59); lỗi khác → null. */
export function withdrawalRefusal(error: unknown): WithdrawalRefusal | null {
  if (
    !(error instanceof ApiError) ||
    (error.code !== "EINVOICE_WITHDRAWAL_REFUSED" &&
      error.code !== "EINVOICE_WITHDRAWAL_EVIDENCE_REQUIRED")
  )
    return null;
  const parsed = withdrawalRefusalDetailsSchema.safeParse(error.details ?? {});
  const providerState = parsed.success ? (parsed.data.providerState ?? null) : null;
  return {
    providerState,
    withdrawableFrom: parsed.success ? (parsed.data.withdrawableFrom ?? null) : null,
    evidenceRequired:
      error.code === "EINVOICE_WITHDRAWAL_EVIDENCE_REQUIRED" || providerState === "UNCONFIRMED",
  };
}

const stateLabel = (state: string | null): string | null =>
  state != null && state in WITHDRAWAL_PROVIDER_STATE_LABELS
    ? WITHDRAWAL_PROVIDER_STATE_LABELS[state as keyof typeof WITHDRAWAL_PROVIDER_STATE_LABELS]
    : null;

/**
 * Câu tiếng Việt cho lỗi BE. Lỗi mang `details` máy đọc được thì ghép thêm dữ kiện: rút bị từ chối → câu trả lời của
 * NCC và "Rút được từ <giờ>" (F-12); nháp lỗi thời → các cảnh báo mới (F-16).
 */
export function einvoiceErrorMessage(error: unknown): string {
  const base = apiErrorMessage(error, EINVOICE_ERROR_MESSAGES);
  const refusal = withdrawalRefusal(error);
  if (refusal) {
    const from = refusal.withdrawableFrom
      ? `Rút được từ ${formatDateTime(refusal.withdrawableFrom)}.`
      : null;
    const state = refusal.evidenceRequired ? null : stateLabel(refusal.providerState);
    return [base, state, from].filter((part): part is string => !!part).join(" ");
  }
  const warnings = outOfDateWarnings(error);
  if (warnings.length > 0) return `${base} ${warnings.map(warningLabel).join(" ")}`;
  return base;
}

/**
 * "Ghi kết quả từ cổng" (BE `EInvoiceIssuance.recordPortalResult`) dùng lại hai mã của việc rút / đối chiếu số với
 * nghĩa riêng — câu chung của hai mã đó nói về rút hoá đơn và số nhập sai nên không hợp với hộp thoại này:
 * - `EINVOICE_WITHDRAWAL_REFUSED`: nhà cung cấp đang được hỏi về hoá đơn ngay lúc này, hoặc (cơ quan thuế từ chối) lần
 *   gửi cuối chưa đủ thời gian chờ — kèm "Ghi được từ <giờ>" khi BE gửi `details.withdrawableFrom`.
 * - `EINVOICE_PORTAL_RECORD_MISMATCH`: nhà cung cấp, hỏi lại ngay lúc ghi, nói khác điều Kế toán ghi.
 */
export function portalResultErrorMessage(error: unknown, outcome: string): string {
  if (!(error instanceof ApiError)) return einvoiceErrorMessage(error);
  if (error.code === "EINVOICE_WITHDRAWAL_REFUSED") {
    const from = withdrawalRefusal(error)?.withdrawableFrom;
    return from
      ? `Chưa ghi được: lần gửi cuối tới nhà cung cấp còn quá gần, nhà cung cấp có thể vẫn đang xử lý. Ghi được từ ${formatDateTime(from)}.`
      : "Chưa ghi được: hệ thống đang hỏi nhà cung cấp về hoá đơn này. Chờ một lát rồi thử lại.";
  }
  if (error.code === "EINVOICE_PORTAL_RECORD_MISMATCH") {
    return outcome === "ISSUED"
      ? "Nhà cung cấp, vừa được hỏi lại, không ghi hoá đơn này với số / ký hiệu đã nhập (chưa có, bị từ chối, hoặc mang số khác). Kiểm tra lại trên cổng nhà cung cấp rồi nhập đúng."
      : "Nhà cung cấp, vừa được hỏi lại, cho thấy hoá đơn đã phát hành hoặc đang xử lý — không ghi “cơ quan thuế từ chối” được. Bấm “Kiểm tra lại” để hệ thống nhận kết quả của nhà cung cấp.";
  }
  return einvoiceErrorMessage(error);
}

/**
 * BO-10: đặt `fieldErrors` của BE vào các ô của form; trả `true` khi có ít nhất một ô nhận lỗi. Chỉ nhận tên trường
 * form biết (`fields`) — trường lạ để câu chung của form.
 */
export function applyEInvoiceFieldErrors<TField extends string>(
  error: unknown,
  fields: readonly TField[],
  setFieldError: (field: TField, message: string) => void,
): boolean {
  let mapped = false;
  for (const [name, message] of Object.entries(apiFieldErrors(error))) {
    const field = fields.find((known) => known === name);
    if (field) {
      setFieldError(field, message);
      mapped = true;
    }
  }
  return mapped;
}

/** Lỗi "dữ liệu đã đổi": tải lại hoá đơn trước khi cho thao tác tiếp. */
export const EINVOICE_STALE_CODES = [
  "EINVOICE_NOT_DRAFT",
  "EINVOICE_INVALID_TRANSITION",
  "OPTIMISTIC_LOCK",
  // F-16: BE vừa kiểm lại nháp và có cảnh báo mới — tải lại để thẻ thông tin hiện chúng
  "EINVOICE_DRAFT_OUT_OF_DATE",
] as const;
