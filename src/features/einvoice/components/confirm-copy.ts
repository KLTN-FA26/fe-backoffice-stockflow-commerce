/** Hộp xác nhận của các thao tác hoá đơn điện tử ra ngoài hệ thống / phá huỷ (docs 21 §4.2). */

export type Confirmable = "issue" | "void" | "resubmit" | "reopen" | "withdraw";

export const CONFIRM: Record<
  Confirmable,
  { title: string; description: string; danger?: boolean; reasonLabel?: string }
> = {
  issue: {
    title: "Phát hành hoá đơn?",
    description:
      "Hoá đơn được gửi tới nhà cung cấp để ký số, cấp số và nộp cơ quan thuế. Đã phát hành thì không sửa, không xoá — chỉ điều chỉnh hoặc thay thế.",
  },
  void: {
    title: "Huỷ hoá đơn nháp?",
    description: "Nháp chưa từng gửi nhà cung cấp sẽ bị huỷ và không dùng lại được.",
    danger: true,
    reasonLabel: "Lý do huỷ",
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
  // BE HĐ-1 (`EInvoiceIssuance.withdraw`)
  withdraw: {
    title: "Rút hoá đơn khỏi nhà cung cấp?",
    description:
      "Hệ thống hỏi lại nhà cung cấp trước khi rút: chỉ rút khi nhà cung cấp không có bản ghi của hoá đơn, hoặc vẫn không trả lời được sau 1 ngày từ lần gửi cuối. Hoá đơn chuyển sang “Bị từ chối” để mở lại thành nháp và phát hành như giao dịch mới. Ghi rõ điều đã kiểm tra trên cổng hoặc với bộ phận hỗ trợ của nhà cung cấp.",
    danger: true,
    reasonLabel: "Đã kiểm tra gì với nhà cung cấp",
  },
};
