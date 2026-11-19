/**
 * Lỗi BE của trả hàng / phiếu nhập hàng hoàn → câu tiếng Việt (BE trả message tiếng Anh cho lỗi nghiệp vụ nên FE
 * chọn câu theo `errorCode` — ErrorCode.java). Không bao giờ hiện chữ của BE.
 */

import { DirectUploadError } from "@/lib/api/direct-upload";
import { apiErrorMessage } from "@/lib/api/error-message";

export const RETURN_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  RETURN_REQUEST_NOT_FOUND: "Không tìm thấy yêu cầu trả hàng.",
  NOT_FOUND: "Không tìm thấy đơn hàng hoặc yêu cầu trả hàng.",
  ORDER_CANCELLED: "Đơn đã huỷ nên không có hàng để trả.",
  RETURN_ORDER_NOT_DELIVERED: "Đơn chưa giao xong nên chưa trả hàng được.",
  RETURN_ORDER_NOT_RETURNABLE: "Đơn không nhận thêm yêu cầu trả hàng ở trạng thái hiện tại.",
  // BR-RMA-001 (docs 17 §4.10 bước 37): trong hạn chính sách — Sale nhận ngoài hạn phải ghi lý do
  RETURN_WINDOW_CLOSED:
    "Đã quá hạn đổi / trả tính từ ngày giao lô hàng. Ghi lý do nhận ngoài hạn để mở yêu cầu.",
  RETURN_QUANTITY_EXCEEDED:
    "Số lượng trả vượt số đã giao trừ phần các yêu cầu khác đang giữ. Dữ liệu đã được tải lại.",
  RETURN_QUANTITIES_INVALID: "Số lượng các dòng không hợp lệ.",
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
  RETURN_NOT_AWAITING_GOODS: "Yêu cầu trả hàng không còn chờ hàng về. Dữ liệu đã được tải lại.",
  // Chuyến hoàn về: một phiếu chưa huỷ; yêu cầu trả hàng (WF-05 TH-3, mỗi kiện một phiếu): một phiếu nháp mỗi lúc
  RETURN_RECEIPT_ALREADY_OPEN:
    "Nguồn này đã có một phiếu nhập hàng hoàn đang mở. Với yêu cầu trả hàng: xác nhận hoặc huỷ phiếu nháp đó trước khi lập phiếu cho kiện tiếp theo.",
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
};

export function returnErrorMessage(error: unknown): string {
  return apiErrorMessage(error, RETURN_ERROR_MESSAGES);
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
] as const;
