/** Hộp xác nhận của các thao tác hoá đơn điện tử ra ngoài hệ thống / phá huỷ (docs 21 §4.2). */

export type Confirmable =
  "issue" | "void" | "voidUnsendable" | "resubmit" | "reopen" | "withdraw" | "reduceFailedDelivery";

export const CONFIRM: Record<
  Confirmable,
  { title: string; description: string; danger?: boolean; reasonLabel?: string }
> = {
  issue: {
    title: "Phát hành hoá đơn?",
    description:
      "Hoá đơn được gửi tới nhà cung cấp để ký số, cấp số và nộp cơ quan thuế; hoá đơn mang ngày phát hành (hôm nay). Đã phát hành thì không sửa, không xoá — chỉ điều chỉnh hoặc thay thế.",
  },
  void: {
    title: "Huỷ hoá đơn nháp?",
    description: "Nháp chưa từng gửi nhà cung cấp sẽ bị huỷ và không dùng lại được.",
    danger: true,
    reasonLabel: "Lý do huỷ",
  },
  // WF-05 Q-8 (F-14): bản giảm do giao thất bại không gửi được qua NCC (NCC cũ / không dùng được / từ chối nhiều lần)
  voidUnsendable: {
    title: "Huỷ bản giảm không gửi được?",
    description:
      "Chỉ dùng khi bản giảm này không gửi được qua nhà cung cấp (nhà cung cấp cũ không còn dùng được, không điều chỉnh được, hoặc đã từ chối nhiều lần). Hoá đơn gốc vẫn ghi nhận là đã giảm. Sau khi huỷ, Kế toán lập hoá đơn giảm trên cổng nhà cung cấp rồi bấm “Ghi hoá đơn giảm làm trên cổng NCC” ở hoá đơn gốc.",
    danger: true,
    reasonLabel: "Vì sao không gửi được",
  },
  resubmit: {
    title: "Gửi lại như giao dịch mới?",
    description:
      "Chỉ làm khi nhà cung cấp đã xác nhận KHÔNG giữ hoá đơn này — gửi nhầm có thể thành hai hoá đơn.",
    danger: true,
  },
  reopen: {
    title: "Mở lại thành nháp?",
    description: "Hoá đơn bị từ chối trở lại nháp để sửa nguyên nhân rồi phát hành lại.",
  },
  // BE HĐ-1 (`EInvoiceIssuance.withdraw`), WF-05 Q-5
  withdraw: {
    title: "Rút hoá đơn khỏi nhà cung cấp?",
    description:
      "Hệ thống hỏi lại nhà cung cấp trước khi rút. Hoá đơn nhà cung cấp đã nhận và đang xử lý (kể cả “đã phát hành nhưng chưa có số”) là đang chờ — không bao giờ rút. Chỉ rút khi nhà cung cấp không có bản ghi, hoặc không xác nhận được kết quả và đã có văn bản trả lời của bộ phận hỗ trợ nhà cung cấp. Hoá đơn rút xong chuyển sang “Bị từ chối” để mở lại và phát hành như giao dịch mới.",
    danger: true,
    reasonLabel: "Đã kiểm tra gì với nhà cung cấp",
  },
  // WF-05 BE-11 (F-15)
  reduceFailedDelivery: {
    title: "Lập bản giảm do giao thất bại?",
    description:
      "Lần giao của hoá đơn này đã được sửa thành thất bại. Hệ thống lập nháp điều chỉnh giảm phần còn lại của hoá đơn (căn cứ “giao không thành công”); Kế toán phát hành nháp đó như thường.",
  },
};

/** Ô lý do của hộp "Phát hành" khi nháp thành lập trễ (WF-05 Q-10). */
export const LATE_REASON_LABEL = "Lý do phát hành trễ (ghi vào nhật ký)";
/** Ô văn bản của bộ phận hỗ trợ NCC khi rút (WF-05 Q-5, F-12). */
export const SUPPORT_REFERENCE_LABEL = "Số phiếu / nội dung trả lời của hỗ trợ nhà cung cấp";
