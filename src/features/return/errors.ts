/**
 * Lỗi BE của trả hàng / phiếu nhập hàng hoàn → câu tiếng Việt (BE trả message tiếng Anh cho lỗi nghiệp vụ nên FE
 * chọn câu theo `errorCode` — ErrorCode.java). Không bao giờ hiện chữ của BE.
 */

import { DirectUploadError } from "@/lib/api/direct-upload";
import { ApiError } from "@/lib/api/error";
import { apiErrorMessage } from "@/lib/api/error-message";

export const RETURN_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  RETURN_REQUEST_NOT_FOUND: "Không tìm thấy yêu cầu trả hàng.",
  NOT_FOUND: "Không tìm thấy đơn hàng hoặc yêu cầu trả hàng.",
  ORDER_CANCELLED: "Đơn đã huỷ nên không có hàng để trả.",
  RETURN_ORDER_NOT_DELIVERED: "Đơn chưa giao xong nên chưa trả hàng được.",
  RETURN_ORDER_NOT_RETURNABLE: "Đơn không nhận thêm yêu cầu trả hàng ở trạng thái hiện tại.",
  // WF-05 Q-15 (BE-18): xét theo từng lô giao — lô đã được hoàn tiền trả hàng thì không trả lại lần nữa
  RETURN_SHIPMENT_NOT_RETURNABLE:
    "Lô giao này đã được giải quyết bằng một lần trả hàng có hoàn tiền nên không mở thêm yêu cầu cho lô này. Chọn lô giao khác còn trong hạn.",
  // BR-RMA-001 (docs 17 §4.10 bước 37): trong hạn chính sách — Sale nhận ngoài hạn phải ghi lý do
  RETURN_WINDOW_CLOSED:
    "Đã quá hạn đổi / trả tính từ ngày giao lô hàng. Ghi lý do nhận ngoài hạn để mở yêu cầu.",
  RETURN_QUANTITY_EXCEEDED:
    "Số lượng trả vượt số đã giao trừ phần các yêu cầu khác đang giữ. Dữ liệu đã được tải lại.",
  RETURN_QUANTITIES_INVALID:
    "Số lượng không hợp lệ (số đếm thực tế của thùng đã mở không được vượt số trên nhãn; số hoàn không vượt số đã duyệt và đã về).",
  // WF-05 Q-4 (BE-12): đề xuất 0 đồng phải có lý do cố định
  RETURN_REFUSAL_REASON_REQUIRED:
    "Mọi dòng đều 0 trong khi vẫn còn hàng hoàn được — chọn lý do không hoàn (khách đọc được lý do này).",
  RETURN_LINE_ALREADY_OPEN: "Có dòng đang nằm trong một yêu cầu trả hàng khác chưa xử lý xong.",
  // BR-RMA-002 (docs 17 BR-08)
  RETURN_CUSTOM_ITEM_NOT_DEFECTIVE:
    "Hàng in theo thiết kế của khách chỉ được trả vì lỗi có tên (lỗi in, sai thiết kế, hư hỏng, giao sai).",
  RETURN_REASON_NOT_ACCEPTED:
    "Lý do này không được nhận: giao thiếu thì sửa kết quả giao; đổi ý không thuộc chính sách trả hàng.",
  RETURN_INVALID_TRANSITION:
    "Yêu cầu đã chuyển sang trạng thái khác nên không làm được thao tác này. Dữ liệu đã được tải lại.",
  RETURN_EVIDENCE_REQUIRED: "Cần ít nhất một ảnh bằng chứng trước khi duyệt.",
  RETURN_EVIDENCE_LIMIT_REACHED: "Yêu cầu đã đủ số ảnh tối đa.",
  // Bước 1 của tải ảnh (BE `ContentTypePolicy`)
  UNSUPPORTED_MEDIA_TYPE: "Chỉ nhận ảnh JPEG, PNG hoặc WebP.",
  PAYLOAD_TOO_LARGE: "Ảnh vượt 15 MB.",
  RETURN_GOODS_REQUIRED: "Hàng của yêu cầu đã duyệt luôn phải gửi về kho trước khi hoàn tiền.",
  // Bốn mắt: người mở / đề xuất không tự duyệt
  RETURN_SELF_APPROVAL:
    "Bạn là người mở yêu cầu hoặc lập đề xuất này nên không tự duyệt được. Nhờ một người khác duyệt.",
  RETURN_CUSTOMER_NOT_ACTIVE: "Tài khoản khách không hoạt động.",
  RETURN_REFUND_NO_INSTALLMENTS:
    "Đơn không thanh toán theo đợt của hợp đồng nên không tất toán hoàn tiền tự động được.",
  IDEMPOTENCY_KEY_REUSED: "Mã yêu cầu đã dùng cho đơn khác. Đóng form và mở lại.",
  // Phiếu nhập hàng hoàn (docs 03 §4.2)
  SHIPMENT_NOT_FOUND: "Không tìm thấy chuyến hàng.",
  SHIPMENT_NOT_RETURNED: "Chuyến này chưa được ghi nhận hoàn về.",
  RETURN_NOT_AWAITING_GOODS:
    "Yêu cầu trả hàng ở trạng thái không nhận phiếu nhập hàng hoàn (chưa duyệt, bị từ chối hoặc đã rút trước khi duyệt). Dữ liệu đã được tải lại.",
  // WF-05 Q-11 (BE-13): nhiều phiếu cho một yêu cầu / một chuyến hoàn về, nhưng chỉ một phiếu NHÁP mỗi lúc
  RETURN_RECEIPT_ALREADY_OPEN:
    "Nguồn này đang có một phiếu nhập hàng hoàn nháp. Xác nhận hoặc huỷ phiếu nháp đó trước khi lập phiếu cho kiện tiếp theo.",
  // WF-05 BE-23: còn phiếu nháp đang đếm thì chưa chốt "Đã nhận đủ hàng", đề xuất / duyệt / kết thúc không hoàn
  RETURN_RECEIPT_DRAFT_OPEN:
    "Kho đang đếm một phiếu nhập hàng hoàn của yêu cầu này. Chờ kho xác nhận hoặc huỷ phiếu đó rồi mới chốt “Đã nhận đủ hàng”, đề xuất hoặc duyệt hoàn tiền. Dữ liệu đã được tải lại.",
  // WF-05 Q-11 (BE-22): phiếu chỉ nhận SKU đã được duyệt — hàng khác là hàng của khách, giữ hộ, không nhập tồn
  RETURN_CARTON_NOT_CLAIMED:
    "SKU của thùng này không nằm trong số hàng đã duyệt trả nên không nhận vào phiếu (không nhập tồn, không hoàn). Để riêng, giữ hộ khách và báo Sale ghi biên nhận giữ hộ (kèm ảnh) trên yêu cầu trả hàng.",
  // WF-05 Q-18 (BE-43): hàng lẻ — ảnh bắt buộc, tối đa số đã duyệt còn lại
  RETURN_LOOSE_EXCEEDS_APPROVED:
    "Số hàng lẻ làm tổng đã về của SKU này vượt số đã duyệt trả. Ghi đúng số trong phạm vi đã duyệt; phần vượt giữ hộ khách, báo Sale ghi biên nhận trên yêu cầu trả hàng.",
  RETURN_LOOSE_PHOTO_REQUIRED: "Hàng lẻ phải kèm ảnh. Chụp hoặc chọn ảnh rồi ghi lại.",
  // WF-05 Q-18: phiếu có thùng mở / hàng lẻ — Quản lý kho xác nhận, khác người đếm
  RETURN_RECEIPT_MANAGER_CONFIRMATION_REQUIRED:
    "Phiếu có thùng đã mở hoặc hàng lẻ: chỉ Quản lý kho xác nhận được. Nhờ Quản lý kho xác nhận phiếu này.",
  RETURN_RECEIPT_SELF_CONFIRMATION:
    "Bạn đã quét thùng hoặc ghi hàng lẻ trên phiếu này. Phiếu có thùng mở / hàng lẻ phải do một Quản lý kho khác xác nhận.",
  GOODS_RECEIPT_NOT_FOUND: "Không tìm thấy phiếu nhập hàng hoàn.",
  LOCATION_NOT_FOUND: "Không tìm thấy khu cách ly.",
  LOCATION_AREA_MISMATCH:
    "Khu đã chọn không phải khu cách ly của kho xuất đơn. Chọn kho xuất của đơn rồi chọn lại khu.",
  LOCATION_NOT_USABLE: "Khu cách ly đang khoá hoặc ngừng dùng.",
  RETURN_CARTON_NOT_OF_SOURCE: "Thùng này không thuộc chuyến / đơn của phiếu.",
  RETURN_CARTON_IN_WAREHOUSE: "Thùng này đang ở trong kho, không phải hàng hoàn.",
  INVALID_RECEIPT_TRANSITION:
    "Phiếu không còn ở trạng thái nháp, hoặc chưa có thùng nào để xác nhận. Dữ liệu đã được tải lại.",
  INVALID_STOCK_PACKAGE_TRANSITION:
    "Có thùng vừa được nhận trên phiếu khác. Dữ liệu đã được tải lại, gỡ thùng đó rồi xác nhận lại.",
  STOCK_PACKAGE_NOT_FOUND: "Không tìm thấy thùng có mã LPN này.",
  // ── WF-05 (BE PR #362, #364, #369) ──
  // TH-1: mỗi yêu cầu trả hàng thuộc một lô đã giao
  RETURN_SHIPMENT_REQUIRED:
    "Đơn được giao thành nhiều lô — chọn lô giao chứa hàng khách trả rồi mở lại yêu cầu.",
  RETURN_SHIPMENT_NOT_DELIVERED:
    "Lô đã chọn chưa giao tới khách nên chưa trả được hàng của lô này. Dữ liệu đã được tải lại.",
  // TH-3: đã có kiện hàng về thì không rút được nữa
  RETURN_GOODS_PARTLY_RECEIVED:
    "Đã có kiện hàng của yêu cầu này về kho nên không rút được nữa. Sale bấm “Đã nhận đủ hàng” rồi đề xuất hoàn tiền (hoặc kết thúc không hoàn tiền) theo số đã về.",
  // TH-4: thùng về bị mở chỉ được ghi giảm
  RETURN_CARTON_OPENED:
    "Thùng này về bị mở (ít hơn số trên nhãn) nên không gỡ cách ly để bán lại được — chỉ ghi giảm.",
  ORDER_DELIVERY_HAS_RETURN:
    "Lô giao này đã có yêu cầu trả hàng nên không sửa thành giao thất bại được.",
  // Audit r3 RAD-3 (BE r3c, 409): Quản lý kho ghi hàng giữ hộ đã rời kho khi Sale chưa ghi lựa chọn của khách
  RETURN_CUSTODY_CHOICE_REQUIRED:
    "Sale chưa ghi lựa chọn của khách cho hàng giữ hộ này — kho giữ nguyên hàng, chưa ghi rời kho được.",
};

export function returnErrorMessage(error: unknown): string {
  return apiErrorMessage(error, RETURN_ERROR_MESSAGES);
}

/**
 * "Rút thay khách" (audit r2 M-3): `RETURN_RECEIPT_DRAFT_OPEN` ở đây nghĩa là chưa rút được vì kho đang đếm — câu chung của
 * mã đó nói về chốt hàng / hoàn tiền nên không hợp.
 */
export function cancelReturnErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "RETURN_RECEIPT_DRAFT_OPEN")
    return "Kho đang đếm một kiện của yêu cầu này trên phiếu nhập hàng hoàn nháp nên chưa rút được. Chờ kho xác nhận (hàng đã về — không rút nữa) hoặc huỷ phiếu đó rồi rút lại. Dữ liệu đã được tải lại.";
  return returnErrorMessage(error);
}

/** Ghi lựa chọn của khách cho hàng giữ hộ / Quản lý kho ghi đã thực hiện (WF-05 Q-4, audit r2 returns H1). */
export function custodyChoiceErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "RETURN_INVALID_TRANSITION")
      return "Yêu cầu này không có thùng nào đang giữ hộ để ghi lựa chọn (chưa kết thúc, hoặc khoản hoàn tiền đã lấy lại mọi thùng). Dữ liệu đã được tải lại.";
    if (error.code === "INVALID_STOCK_PACKAGE_TRANSITION")
      return "Kho đã thực hiện lựa chọn trước của khách cho thùng này — không đổi được nữa. Dữ liệu đã được tải lại.";
    if (error.code === "STOCK_PACKAGE_DECISION_PENDING")
      return "Sale chưa ghi lựa chọn của khách cho thùng này — kho giữ nguyên, chưa thực hiện được.";
    if (error.code === "STOCK_PACKAGE_NOT_FOUND")
      return "Thùng này không còn trong danh sách giữ hộ khách. Dữ liệu đã được tải lại.";
    if (error.code === "VALIDATION_FAILED")
      return "Dữ liệu chưa hợp lệ: huỷ hộ phải nêu biên bản khách đồng ý; ghi chú tối đa 500 ký tự.";
  }
  return returnErrorMessage(error);
}

/**
 * Hàng giữ hộ trên biên nhận (audit r3 RAD-3): Sale ghi lựa chọn / Quản lý kho ghi đã rời kho. RETURN_INVALID_TRANSITION ở
 * đây nghĩa là hàng đã rời kho, hoặc yêu cầu bổ sung đã chọn không còn nhận hàng.
 */
export function custodyNoteErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "RETURN_INVALID_TRANSITION")
      return "Hàng này đã được ghi rời kho, hoặc yêu cầu trả hàng bổ sung đã bị từ chối / rút / hết hạn nên không nhận hàng — Sale ghi lại lựa chọn của khách. Dữ liệu đã được tải lại.";
    if (error.code === "NOT_FOUND")
      return "Không tìm thấy biên nhận giữ hộ này trên yêu cầu. Dữ liệu đã được tải lại.";
    if (error.code === "VALIDATION_FAILED")
      return "Dữ liệu chưa hợp lệ: huỷ hộ phải nêu biên bản khách đồng ý; nhận trên yêu cầu bổ sung phải chọn một yêu cầu khác của cùng khách; ghi chú tối đa 500 ký tự.";
  }
  return returnErrorMessage(error);
}

/** Lỗi của bước PUT lên kho lưu trữ (tải ảnh bằng chứng). */
const STORAGE_ERROR_MESSAGES: Readonly<Record<DirectUploadError["kind"], string>> = {
  refused: "Kho lưu trữ từ chối ảnh (đường tải đã hết hạn hoặc tệp đã đổi). Chọn lại ảnh.",
  network: "Không tới được kho lưu trữ. Kiểm tra mạng rồi chọn lại ảnh.",
  aborted: "Đã huỷ tải ảnh.",
};

/** Lỗi tải ảnh bằng chứng: lỗi PUT lên kho, còn lại theo mã BE (khai báo / gắn ảnh). */
export function returnEvidenceErrorMessage(error: unknown): string {
  if (error instanceof DirectUploadError) return STORAGE_ERROR_MESSAGES[error.kind];
  return returnErrorMessage(error);
}

/** Lỗi "dữ liệu đã đổi": tải lại trước khi cho thao tác tiếp. */
export const RETURN_STALE_CODES = [
  "RETURN_INVALID_TRANSITION",
  "RETURN_QUANTITY_EXCEEDED",
  "RETURN_NOT_AWAITING_GOODS",
  "INVALID_RECEIPT_TRANSITION",
  "INVALID_STOCK_PACKAGE_TRANSITION",
  "RETURN_SHIPMENT_NOT_DELIVERED",
  "RETURN_GOODS_PARTLY_RECEIVED",
  "RETURN_RECEIPT_DRAFT_OPEN",
  "STOCK_PACKAGE_NOT_FOUND",
] as const;

/**
 * 409 `RETURN_RECEIPT_ALREADY_OPEN` (BE G4: một phiếu NHÁP mỗi lúc cho mỗi chuyến / mỗi yêu cầu) kèm `details.receiptId`
 * = phiếu nháp đang mở → id đó để màn mở phiếu; lỗi khác → null.
 */
export function openDraftReceiptOf(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== "RETURN_RECEIPT_ALREADY_OPEN") return null;
  const id = error.details?.receiptId;
  return typeof id === "string" && id !== "" ? id : null;
}
