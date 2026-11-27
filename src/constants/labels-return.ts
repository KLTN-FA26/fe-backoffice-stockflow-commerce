/**
 * Nhãn tiếng Việt của màn trả hàng (docs 17 §4.10) và phiếu nhập hàng hoàn (docs 03 §4.2). Thuật ngữ theo
 * docs: "yêu cầu trả hàng", "RMA", "phiếu nhập Hàng hoàn", "khu cách ly", "hoàn tiền", "hoá đơn điều chỉnh giảm".
 */

import type {
  ReturnReadChannel,
  ReturnReadCustodyChoice,
  ReturnReadCustodyNoteChoice,
  ReturnReadOutcome,
  ReturnReadReason,
  ReturnReadRefusalReason,
} from "./returns";

/** Giá trị BE thêm sau, FE chưa có nhãn (WF-05 BO-11). */
const UNKNOWN_LABEL = "Không rõ";

export const RETURN_REASON_LABELS = {
  PRINT_DEFECT: "Lỗi in",
  DESIGN_MISMATCH: "Sai thiết kế so với mẫu duyệt",
  DAMAGED_IN_TRANSIT: "Hư hỏng khi vận chuyển",
  WRONG_ITEM: "Giao sai hàng",
  SHORT_DELIVERY: "Giao thiếu",
  CHANGED_MIND: "Đổi ý",
  OTHER: "Khác",
  UNKNOWN: UNKNOWN_LABEL,
} as const satisfies Record<ReturnReadReason, string>;

export const RETURN_CHANNEL_LABELS = {
  PORTAL: "Khách gửi trên cổng",
  BACK_OFFICE: "Sale mở thay khách",
  UNKNOWN: UNKNOWN_LABEL,
} as const satisfies Record<ReturnReadChannel, string>;

/**
 * Lý do từ chối hoàn (WF-05 Q-4) — trùng nhãn `label.ReturnRefusalReason.*` của bundle `_vi` BE (khách đọc cùng chữ trên
 * cổng).
 */
export const RETURN_REFUSAL_REASON_LABELS = {
  CUSTOMER_DAMAGE: "Hư hỏng do bảo quản/sử dụng",
  NOT_DEFECTIVE: "Không phát hiện lỗi",
  OUT_OF_POLICY: "Ngoài chính sách đổi trả",
  OTHER: "Lý do khác",
  UNKNOWN: UNKNOWN_LABEL,
} as const satisfies Record<ReturnReadRefusalReason, string>;

/** Lựa chọn của khách cho hàng giữ hộ (WF-05 Q-4, BE `custodyChoice`). */
export const RETURN_CUSTODY_CHOICE_LABELS = {
  SEND_BACK: "Gửi trả khách (khách chịu phí)",
  DESTROY_ON_BEHALF: "Công ty huỷ hộ (khách đồng ý, có biên bản)",
  UNKNOWN: UNKNOWN_LABEL,
} as const satisfies Record<ReturnReadCustodyChoice, string>;

/** Lựa chọn của khách cho hàng trên một biên nhận giữ hộ (audit r3 RAD-3, BE `ReturnCustodyNoteChoice`). */
export const RETURN_CUSTODY_NOTE_CHOICE_LABELS = {
  SEND_BACK: "Gửi trả khách (khách chịu phí)",
  DESTROY_ON_BEHALF: "Công ty huỷ hộ (khách đồng ý, có biên bản)",
  TAKEN_BY_RETURN: "Nhận trên yêu cầu trả hàng bổ sung",
  UNKNOWN: UNKNOWN_LABEL,
} as const satisfies Record<ReturnReadCustodyNoteChoice, string>;

/** Thùng giữ hộ khách (BE `ownership`). */
export const CUSTOMER_CUSTODY_OWNERSHIP_LABELS: Readonly<Record<string, string>> = {
  CUSTOMER_HELD: "Đang giữ hộ",
  CUSTOMER_SENT_BACK: "Đã gửi trả khách",
  CUSTOMER_DESTROYED: "Đã huỷ hộ",
};

/** Chênh lệch kho ghi khi nhận hàng trả (BE `ReturnDiscrepancy.Kind`); mã lạ → "chênh lệch", không đoán (audit r2 L14). */
export const RETURN_DISCREPANCY_KIND_LABELS: Readonly<Record<string, string>> = {
  SHORT: "Thiếu",
  EXCESS: "Thừa",
  UNEXPECTED_ITEM: "Ngoài yêu cầu",
  WRONG_ITEM: "Sai mã hàng",
};
export const RETURN_DISCREPANCY_KIND_UNKNOWN = "Chênh lệch";

/**
 * Lý do BE ghi ở lịch sử yêu cầu (BE `ReturnRequest.transitionTo` — mã + số phiếu / số tiền; audit r2 L14): câu tiếng Việt.
 * Lý do người dùng gõ (từ chối, rút) hiện nguyên văn.
 */
export const RETURN_HISTORY_REASON_LABELS = {
  APPROVED: "Đã duyệt",
  GOODS_DEADLINE_PASSED: "Hết hạn gửi hàng — chốt theo số đã về",
  RETURN_DEADLINE_PASSED: "Hết hạn gửi hàng, chưa có hàng về",
  RECEIVED: (receipt: string) => `Đã về đủ — phiếu ${receipt}`,
  RECEIVED_WITH_DISCREPANCY: (receipt: string) => `Đã về, có chênh lệch — phiếu ${receipt}`,
  RECEIVED_AFTER_DEADLINE: (receipt: string) => `Hàng về sau hạn — phiếu ${receipt}`,
  RECEIVED_AFTER_WITHDRAWAL: (receipt: string) => `Hàng về sau khi đã rút — phiếu ${receipt}`,
  GOODS_COMPLETE: "Sale chốt đã nhận đủ hàng theo số đã về",
  REFUND_SENT_BACK: "Đề xuất hoàn tiền bị trả lại",
  REFUND_PROPOSED: (amount: string) => `Đề xuất hoàn ${amount}`,
  NOTHING_PAID: "đơn chưa thanh toán",
  REFUSED: (reason: string) => `không hoàn: ${reason}`,
  RESOLVED_REFUND: (amount: string) => `Đã duyệt hoàn ${amount}`,
  RESOLVED_REFUSED: (reason: string) => `Kết thúc không hoàn tiền: ${reason}`,
  RESOLVED_NOTHING_USABLE: "Kết thúc không hoàn tiền — không có đơn vị đã duyệt về dùng được",
} as const;

/** Kết quả của yêu cầu đã xử lý xong (BE `outcome`): 0 đồng không bao giờ đọc là "Đã hoàn tiền". */
export const RETURN_OUTCOME_LABELS = {
  REFUNDED: "Đã hoàn tiền",
  REFUSED: "Đã xử lý — không hoàn tiền",
  NOTHING_TO_REFUND: "Đã xử lý — không có gì để hoàn",
  UNKNOWN: UNKNOWN_LABEL,
} as const satisfies Record<ReturnReadOutcome, string>;

export const RETURN_LABELS = {
  navLabel: "Trả hàng",
  pageTitle: "Yêu cầu trả hàng",
  tabs: { all: "Tất cả", open: "Đang xử lý", vatAdjustment: "Cần hoá đơn điều chỉnh" },
  vatAdjustmentHint:
    "Trả hàng đã hoàn tiền trên đơn có hoá đơn đã phát hành: Kế toán phát hành hoá đơn điều chỉnh giảm (nháp do hệ thống lập).",
  searchPlaceholder: "Tìm số RMA hoặc mã đơn",
  /** Lọc trên header cột (data-table-mode-a §4.1) — BE không có tham số lý do / nguồn: chỉ xét trang đang xem. */
  headerFilter: {
    reasonSearch: "Tìm lý do…",
    channelSearch: "Tìm nguồn…",
    empty: "Không có lựa chọn",
  },
  statusAll: "Mọi trạng thái",
  statusFilter: "Trạng thái",
  clearFilters: "Bỏ bộ lọc",
  emptyTitle: "Chưa có yêu cầu trả hàng",
  emptyDescription:
    "Khi khách gửi yêu cầu trả hàng trên cổng (hoặc Sale mở thay khách), yêu cầu sẽ hiện ở đây.",
  noReadDescription:
    "Bạn được mở trang nhưng chưa có quyền xem yêu cầu trả hàng. Liên hệ quản trị để được cấp.",
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem yêu cầu trả hàng.",
  notFoundTitle: "Không tìm thấy yêu cầu trả hàng",
  notFoundDescription: "Yêu cầu trả hàng không tồn tại hoặc đường dẫn không hợp lệ.",
  columns: {
    rma: "Số RMA",
    order: "Đơn hàng",
    reason: "Lý do",
    channel: "Nguồn",
    requestedAt: "Gửi lúc",
    deadline: "Hạn gửi hàng",
    settlement: "Giá trị hoàn",
    status: "Trạng thái",
    invoice: "Hoá đơn",
  },
  openInvoices: "Mở hoá đơn của đơn",
  /** WF-05 BE-23 trên dòng hàng đợi (`receiptDraftOpen`): kho đang đếm một kiện trên phiếu nháp. */
  draftReceipt: {
    counting: "Kho đang đếm trên phiếu nháp",
    open: "Mở phiếu nháp đang đếm",
  },
  detail: {
    general: "Thông tin chung",
    order: "Đơn hàng",
    customer: "Khách hàng",
    viewCustomer: "Xem hồ sơ khách",
    reason: "Lý do",
    description: "Mô tả của khách",
    channel: "Nguồn",
    requestedAt: "Gửi lúc",
    lateClaim: "Lý do nhận ngoài hạn",
    lines: "Hàng yêu cầu trả",
    sku: "SKU",
    printed: "In theo thiết kế",
    unitPrice: "Đơn giá",
    requested: "Yêu cầu",
    approved: "Duyệt",
    received: "Đã về",
    refunded: "Hoàn",
    refundAmount: "Tiền hoàn",
    evidence: "Ảnh bằng chứng",
    noEvidence: "Chưa có ảnh. Cần ít nhất một ảnh trước khi duyệt.",
    openPhoto: "Xem ảnh",
    // Sale thêm ảnh thay khách khi yêu cầu còn mở (BE `/returns/{id}/evidence/uploads` → PUT → `/evidence`)
    addPhoto: "Thêm ảnh",
    photoHint: (max: number) => `JPEG, PNG hoặc WebP, tối đa 15 MB mỗi ảnh, tối đa ${max} ảnh.`,
    photoUploading: (name: string) => `Đang tải ${name}…`,
    photoWrongType: "Chỉ nhận ảnh JPEG, PNG hoặc WebP.",
    photoTooLarge: "Ảnh vượt 15 MB.",
    photoLimit: (max: number) => `Yêu cầu đã đủ ${max} ảnh.`,
    // WF-05 Q-11: biên nhận giữ hộ — hàng về mà phiếu nhập không nhận, ghi trên yêu cầu (không nhập tồn, không hoàn)
    custody: {
      title: "Hàng giữ hộ khách",
      hint: "Hàng về mà phiếu nhập hàng hoàn không nhận (SKU không được duyệt, vượt số duyệt, kiện về sau khi đã chốt tiền) vẫn là của khách: không nhập tồn, không hoàn tiền, không điều chỉnh hoá đơn. Ghi SKU hoặc LPN, số lượng, ảnh và lựa chọn của khách (gửi trả, mở yêu cầu bổ sung, hoặc huỷ hộ có biên bản).",
      none: "Chưa ghi hàng giữ hộ nào.",
      sku: "SKU",
      lpn: "LPN",
      quantity: "Số lượng",
      note: "Ghi chú (lựa chọn của khách)",
      photo: "Ảnh hàng giữ hộ",
      photoRequired: "Chụp hoặc chọn ảnh hàng giữ hộ (JPEG, PNG hoặc WebP, tối đa 15 MB).",
      add: "Ghi biên nhận",
      uploading: "Đang tải ảnh…",
      full: (max: number) => `Đã đủ ${max} biên nhận giữ hộ.`,
      receivedAt: "Ghi lúc",
      // Audit r3 RAD-3 (Q-11 hỏi thêm): mỗi biên nhận có kết cục — Sale ghi lựa chọn của khách, Quản lý kho ghi đã rời kho
      outcome: "Kết cục",
      waitChoice: "Chờ Sale ghi lựa chọn của khách",
      takenBy: (rma: string) => `Nhận trên ${rma}`,
      chosenAt: (when: string) => `ghi lúc ${when}`,
      endedAt: (when: string) => `Đã rời kho lúc ${when}`,
      choose: "Ghi lựa chọn",
      changeChoice: "Đổi lựa chọn",
      end: "Đã rời kho",
      choiceTitle: "Lựa chọn của khách cho hàng giữ hộ",
      choiceHint:
        "Hàng trên biên nhận này là của khách, không nhập kho. Ghi đúng điều khách chọn; Quản lý kho làm theo rồi ghi hàng đã rời kho.",
      choice: "Khách chọn",
      choiceNote: "Biên bản / ghi chú",
      choiceNoteRequired: "Huỷ hộ phải nêu biên bản khách đồng ý.",
      takenByReturn: "Yêu cầu trả hàng bổ sung",
      takenByReturnHint:
        "Yêu cầu khác của cùng khách, đang chờ duyệt, chờ hàng, đã nhận hàng hoặc chờ quyết toán.",
      takenByReturnRequired: "Chọn yêu cầu trả hàng bổ sung nhận hàng này.",
      noOtherReturn:
        "Khách chưa có yêu cầu trả hàng nào khác còn nhận hàng — mở yêu cầu bổ sung trước.",
      endTitle: "Ghi hàng giữ hộ đã rời kho",
      endDescription: (what: string, choice: string) =>
        `${what}: ${choice}. Không có bút toán kho — hàng giữ hộ chưa bao giờ nhập kho. Ghi số biên bản giao trả / biên bản huỷ / phiếu nhập của yêu cầu bổ sung. Ghi xong không sửa được.`,
      endNote: "Biên bản",
    },
    // Audit r3 RAD-3 (TH-6): danh sách hàng giữ hộ trên biên nhận, cạnh thùng giữ hộ sau hoàn tiền
    custodyNotes: {
      title: "Hàng giữ hộ trên biên nhận (khác SKU, vượt số duyệt, về sau khi chốt tiền)",
      none: "Không có hàng giữ hộ nào đang chờ.",
      error: "Không tải được danh sách hàng giữ hộ.",
      what: "Hàng",
      quantity: "Số lượng",
      returnRequest: "Yêu cầu",
      keptAt: "Nhận giữ lúc",
      outcome: "Kết cục",
    },
    review: "Quyết định của Sale",
    decidedAt: "Quyết định lúc",
    reviewNote: "Ghi chú",
    rejectionReason: "Lý do từ chối",
    returnDeadline: "Hạn hàng về kho",
    receipt: "Hàng đã về",
    receivedAt: "Nhận lúc",
    quarantine: "Khu cách ly",
    receiptLink: "Phiếu nhập hàng hoàn",
    // WF-05 TH-3: khách có thể gửi hàng thành nhiều kiện, mỗi kiện một phiếu nhập
    parcels: "Các lần hàng về",
    parcel: (n: number) => `Lần ${n}`,
    parcelReceiver: "Người nhận",
    parcelVoucher: "Phiếu nhập kho 01-VT",
    discrepancies: "Chênh lệch khi nhận",
    resolution: "Hoàn tiền",
    settlementAmount: "Giá trị hoàn (gồm VAT)",
    offsetAmount: "Cấn trừ vào đợt còn nợ",
    refundedAmount: "Phải chuyển trả khách",
    proposedAt: "Đề xuất lúc",
    settledAt: "Duyệt lúc",
    vatAdjustment: "Cần hoá đơn điều chỉnh giảm",
    openRefunds: "Mở màn hoàn tiền",
    closedWithoutRefund:
      "Đã kết thúc không hoàn tiền — không có đơn vị nào đã duyệt về kho dùng được.",
    // WF-05 Q-4: đề xuất / kết quả 0 đồng có lý do cố định (khách đọc lý do + ghi chú công khai)
    outcome: "Kết quả",
    refusalReason: "Lý do không hoàn",
    refusalNote: "Ghi chú gửi khách",
    refusedNote:
      "Không hoàn tiền, không lập hoá đơn điều chỉnh. Hàng đã về vẫn là của khách: Sale ghi lựa chọn của khách (gửi trả hoặc huỷ hộ có biên bản), Quản lý kho xử lý từ khu cách ly.",
    // WF-05 BE-23: còn phiếu nhập đang đếm thì chưa chốt "Đã nhận đủ hàng", chưa đề xuất / duyệt hoàn tiền
    receiptDraftOpen:
      "Kho đang đếm một phiếu nhập hàng hoàn của yêu cầu này. Chờ kho xác nhận hoặc huỷ phiếu đó rồi mới chốt “Đã nhận đủ hàng”, đề xuất hoặc duyệt hoàn tiền.",
    // WF-05 Q-4 (audit r2 returns H1): lựa chọn của khách cho hàng giữ hộ, Sale ghi; Quản lý kho thực hiện
    custodyChoice: {
      title: "Hàng của khách giữ hộ",
      // Audit r3 RAD-1: tính theo từng SKU — thùng mà khoản hoàn không lấy lại (SKU không hoàn, thùng nguyên vượt số hoàn)
      hint: "Thùng nguyên mà khoản hoàn tiền không lấy lại (SKU không được hoàn, hoặc thùng nguyên vượt số đơn vị được hoàn) vẫn là của khách: không nhập kho, giữ ở khu cách ly. Sale hỏi khách rồi ghi một trong hai lựa chọn; Quản lý kho thực hiện đúng lựa chọn đó.",
      choice: "Khách chọn",
      none: "Chưa ghi lựa chọn của khách — kho giữ nguyên hàng chờ.",
      note: "Biên bản / ghi chú",
      noteRequired: "Huỷ hộ phải nêu biên bản khách đồng ý.",
      recordedAt: "Ghi lúc",
      record: "Ghi lựa chọn của khách",
      change: "Đổi lựa chọn",
      submit: "Ghi lựa chọn",
      cartons: "Thùng giữ hộ",
      noCartons: "Không có thùng nào đang giữ hộ cho yêu cầu này.",
      cartonsError: "Không tải được danh sách thùng giữ hộ.",
      end: "Đã thực hiện",
      endTitle: "Ghi đã thực hiện lựa chọn của khách",
      endDescription: (lpn: string, choice: string) =>
        `Thùng ${lpn}: ${choice}. Không có bút toán kho — thùng đã ngoài sổ. Ghi số biên bản giao trả / biên bản huỷ.`,
      endNote: "Biên bản",
      waitChoice: "Chờ Sale ghi lựa chọn của khách",
      ended: (when: string) => `Xong lúc ${when}`,
    },
    cancelled: "Đã rút",
    cancellationReason: "Lý do rút",
    history: "Lịch sử",
    noHistory: "Chưa có thay đổi.",
  },
  actions: {
    approve: "Duyệt",
    reject: "Từ chối",
    cancel: "Rút thay khách",
    propose: "Đề xuất hoàn tiền",
    approveSettlement: "Duyệt hoàn tiền",
    rejectSettlement: "Trả lại đề xuất",
    createReceipt: "Lập phiếu nhập hàng hoàn",
    openForCustomer: "Mở yêu cầu trả hàng",
    goodsComplete: "Đã nhận đủ hàng",
    closeWithoutRefund: "Kết thúc không hoàn tiền",
  },
  approveDialog: {
    title: "Duyệt yêu cầu trả hàng",
    description:
      "Khách gửi hàng đã duyệt về kho xuất của đơn trong 14 ngày, ghi số RMA trên kiện. Để 0 nếu không duyệt dòng đó.",
    quantity: "SL duyệt",
    note: "Ghi chú (nội bộ)",
    submit: "Duyệt",
    noneApproved: "Duyệt ít nhất một đơn vị — không duyệt gì thì chọn Từ chối.",
  },
  rejectDialog: {
    title: "Từ chối yêu cầu trả hàng",
    description: "Khách đọc được lý do. Đơn quay lại chờ hết hạn đổi / trả.",
    reason: "Lý do từ chối",
    submit: "Từ chối",
  },
  cancelDialog: {
    title: "Rút yêu cầu trả hàng thay khách",
    description: "Chỉ khi hàng chưa về kho. Yêu cầu chuyển sang Đã rút.",
    reason: "Lý do",
    submit: "Rút yêu cầu",
  },
  proposeDialog: {
    title: "Đề xuất hoàn tiền",
    description:
      "Hoàn theo đơn giá của dòng đơn (gồm VAT), tối đa số đã duyệt và đã về. Để 0 mọi dòng nếu không hoàn theo chính sách — khi đó chọn lý do (khách đọc được). Một người khác (Kế toán) duyệt đề xuất.",
    quantity: "SL hoàn",
    max: (n: number) => `tối đa ${n}`,
    note: "Ghi chú (nội bộ)",
    submit: "Gửi đề xuất",
    // WF-05 Q-4: hoàn 0 đồng — lý do cố định bắt buộc; giữ lại một phần — lý do tuỳ chọn. "Khác" phải ghi rõ cho khách
    refusalReason: "Lý do không hoàn",
    refusalReasonPlaceholder: "Chọn lý do",
    refusalHint:
      "Đề xuất không hoàn tiền: Kế toán duyệt như đề xuất hoàn tiền. Không lập hoá đơn điều chỉnh; hàng đã về vẫn là của khách.",
    withholdHint:
      "Hoàn ít hơn số đã duyệt và đã về: có thể nêu lý do không hoàn phần còn lại (khách đọc được).",
    refusalNote: "Ghi chú gửi khách (không bắt buộc)",
    refusalNoteRequired: "Ghi chú gửi khách",
    estimate: "Ước tính trước thuế:",
    estimateNote: "(hệ thống tính lại theo đơn giá và VAT của dòng đơn)",
  },
  approveSettlementDialog: {
    title: "Duyệt hoàn tiền",
    description:
      "Giá trị hoàn được cấn trừ vào các đợt còn nợ của đơn; phần khách đã trả sẽ chờ Kế toán ghi nhận chuyển khoản ở màn Hoàn tiền.",
    submit: "Duyệt hoàn tiền",
    // WF-05 Q-4: cùng nút, đề xuất 0 đồng — duyệt là kết thúc yêu cầu không hoàn tiền
    refusalTitle: "Duyệt kết quả: không hoàn tiền",
    refusalDescription: (reason: string) =>
      `Sale đề xuất không hoàn tiền, lý do “${reason}”. Duyệt thì yêu cầu kết thúc: không hoàn tiền, không lập hoá đơn điều chỉnh; khách đọc được lý do.`,
  },
  goodsCompleteDialog: {
    title: "Xác nhận đã nhận đủ hàng",
    description:
      "Khách không gửi thêm hàng của yêu cầu này. Yêu cầu chuyển sang Hàng đã về và chốt theo số đã về; phần thiếu so với số đã duyệt được ghi chênh lệch. Sau đó đề xuất hoàn tiền (hoặc kết thúc không hoàn tiền) theo số đã về.",
    note: "Ghi chú (không bắt buộc)",
    submit: "Đã nhận đủ hàng",
  },
  closeWithoutRefundDialog: {
    title: "Kết thúc không hoàn tiền",
    description:
      "Không có đơn vị nào vừa được duyệt vừa về kho dùng được (thùng đếm rỗng, hoặc chỉ về hàng không thuộc yêu cầu). Yêu cầu chuyển sang Đã xử lý xong: không hoàn tiền, không lập hoá đơn điều chỉnh. Hàng đã về do kho ghi giảm.",
    note: "Ghi chú (không bắt buộc)",
    submit: "Kết thúc",
  },
  rejectSettlementDialog: {
    title: "Trả lại đề xuất hoàn tiền",
    description: "Đề xuất quay về Sale (Hàng đã về) để lập lại.",
    reason: "Lý do",
    submit: "Trả lại",
  },
  openDialog: {
    title: "Mở yêu cầu trả hàng thay khách",
    description: (days: number) =>
      `Trong ${days} ngày sau khi lô hàng được giao. Ngoài hạn phải ghi lý do nhận và cần một người khác duyệt. Hàng in theo thiết kế chỉ nhận lỗi có tên.`,
    reason: "Lý do",
    descriptionField: "Mô tả vấn đề",
    descriptionRequired: "Mô tả vấn đề khi chọn lý do Khác",
    lateClaim: (days: number) => `Lý do nhận ngoài hạn (nếu đã quá ${days} ngày sau giao)`,
    lateClaimRequired: "Đã quá hạn đổi / trả — ghi lý do nhận ngoài hạn",
    // WF-05 TH-1: mỗi yêu cầu trả hàng thuộc một lô đã giao
    shipment: "Lô giao chứa hàng trả",
    shipmentPlaceholder: "Chọn lô đã giao",
    shipmentRequired: "Đơn giao nhiều lô — chọn lô chứa hàng khách trả",
    shipmentOption: (index: number, deliveredOn: string) => `Lô ${index} — giao ${deliveredOn}`,
    shipmentHint: "Chỉ các lô đã giao tới khách. Số trả tối đa theo số đã giao trên lô.",
    noLines: "Lô này không còn dòng nào trả được.",
    quantity: "SL trả",
    delivered: (n: number) => `đã giao ${n}`,
    submit: "Mở yêu cầu",
    noneClaimed: "Chọn ít nhất một dòng với số lượng ≥ 1.",
  },
  orderCard: {
    title: "Trả hàng",
    loading: "Đang tải yêu cầu trả hàng…",
    failed: "Không tải được yêu cầu trả hàng của đơn.",
    none: "Đơn chưa có yêu cầu trả hàng.",
    viewAll: "Xem tất cả",
  },
  success: {
    approved: "Đã duyệt yêu cầu trả hàng",
    rejected: "Đã từ chối yêu cầu trả hàng",
    cancelled: "Đã rút yêu cầu trả hàng",
    opened: "Đã mở yêu cầu trả hàng",
    proposed: "Đã gửi đề xuất hoàn tiền",
    settlementApproved: "Đã duyệt hoàn tiền",
    settlementRejected: "Đã trả lại đề xuất hoàn tiền",
    goodsComplete: "Đã ghi nhận đủ hàng",
    closedWithoutRefund: "Đã kết thúc yêu cầu không hoàn tiền",
    evidenceAdded: "Đã thêm ảnh bằng chứng",
    custodyAdded: "Đã ghi biên nhận giữ hộ",
    custodyChoiceRecorded: "Đã ghi lựa chọn của khách cho hàng giữ hộ",
    custodyEnded: "Đã ghi thực hiện lựa chọn của khách",
    custodyNoteEnded: "Đã ghi hàng giữ hộ rời kho",
  },
} as const;

export const RETURN_RECEIPT_LABELS = {
  navLabel: "Nhập hàng hoàn",
  pageTitle: "Phiếu nhập hàng hoàn",
  create: "Lập phiếu",
  tabs: { draft: "Đang nhận", all: "Tất cả" },
  emptyTitle: "Chưa có phiếu nhập hàng hoàn",
  emptyDescription:
    "Lập phiếu khi hàng của một yêu cầu trả hàng đã duyệt, hoặc một lô giao hãng hoàn về, tới kho.",
  noReadDescription:
    "Bạn được mở trang nhưng chưa có quyền xem phiếu nhận. Liên hệ quản trị để được cấp.",
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem phiếu nhận.",
  notFoundTitle: "Không tìm thấy phiếu nhập hàng hoàn",
  notFoundDescription: "Phiếu không tồn tại hoặc đường dẫn không hợp lệ.",
  columns: {
    number: "Số phiếu",
    source: "Nguồn",
    order: "Đơn hàng",
    cartons: "Số thùng",
    receivedAt: "Lập lúc",
    closedAt: "Xác nhận lúc",
    status: "Trạng thái",
  },
  viewOrder: "Xem đơn",
  source: {
    rmaShort: "RMA",
    rma: (rma: string) => `RMA ${rma}`,
    shipment: (code: string) => `Lô giao hoàn về ${code}`,
  },
  createDialog: {
    title: "Lập phiếu nhập hàng hoàn",
    description:
      "Hàng về nhận theo LPN vào khu cách ly (QUARANTINE) của kho xuất đơn. Quản lý kho gỡ cách ly hoặc ghi giảm sau.",
    sourceType: "Nguồn hàng về",
    sourceRma: "Yêu cầu trả hàng đã duyệt",
    sourceShipment: "Lô giao hãng hoàn về (RTO)",
    rma: "Yêu cầu trả hàng",
    rmaPlaceholder: "Chọn yêu cầu đang chờ hàng về",
    shipment: "Lô giao hoàn về",
    shipmentPlaceholder: "Chọn lô giao đã hoàn về",
    warehouse: "Kho nhận (kho xuất của đơn)",
    warehousePlaceholder: "Chọn kho",
    area: "Khu cách ly",
    areaPlaceholder: "Chọn khu QUARANTINE",
    noArea: "Kho chưa có khu cách ly dùng được.",
    note: "Ghi chú",
    submit: "Lập phiếu",
    noSource: "Chưa có yêu cầu / lô giao nào chờ nhập.",
    openDraft: "Mở phiếu nháp đang đếm",
  },
  detail: {
    general: "Thông tin chung",
    source: "Nguồn",
    order: "Đơn hàng",
    quarantine: "Khu cách ly",
    note: "Ghi chú",
    receivedAt: "Lập lúc",
    confirmedAt: "Xác nhận lúc",
    scan: "Quét LPN",
    scanPlaceholder: "Quét hoặc nhập mã LPN rồi Enter",
    condition: "Tình trạng thùng (nếu có)",
    conditionPlaceholder: "Móp, ướt, bị mở…",
    /** Nút điền nhanh tình trạng thùng (UX audit S21-2) — vẫn gõ thêm được. */
    conditionQuickLabel: "Chọn nhanh",
    conditionQuick: ["Bình thường", "Móp", "Ướt", "Rách"],
    // WF-05 TH-4: thùng về bị mở — đếm số thực có trong thùng (ít hơn nhãn = chỉ ghi giảm)
    opened: "Thùng đã mở",
    counted: "Số đếm thực tế",
    countedRequired: "Thùng đã mở: nhập số đếm thực tế (số nguyên ≥ 0) rồi quét lại.",
    countedAboveLabel: "Số đếm thực tế không được vượt số trên nhãn thùng.",
    countColumn: "Kiểm đếm",
    sealed: "Nguyên thùng",
    // WF-05 Q-4 (audit r2 returns H1): yêu cầu không hoàn tiền — thùng nguyên vẫn là của khách, giữ hộ, không phải tồn kho
    heldForCustomer: "Giữ hộ khách — không nhập kho",
    openedState: (counted: number, label: number) => `Đã mở · đếm ${counted}/${label}`,
    add: "Thêm",
    scanned: "Thùng đã quét",
    expected: "Thùng của nguồn",
    lpn: "LPN",
    sku: "SKU",
    lot: "Lô",
    quantity: "SL",
    conditionColumn: "Tình trạng",
    scannedState: "Đã quét",
    notScanned: "Chưa quét",
    remove: "Gỡ",
    noCartons: "Chưa quét thùng nào.",
    progress: (scanned: number, expected: number) => `Đã quét ${scanned} / ${expected} thùng`,
    shortNote: "Quét ít hơn số thùng của nguồn vẫn xác nhận được.",
    confirm: "Xác nhận nhập",
    confirmTitle: "Xác nhận phiếu nhập hàng hoàn",
    confirmDescription:
      'Thùng nguyên vào lại tồn ở khu cách ly (không bán được); thùng đã mở và hàng lẻ không nhập tồn, ghi kết quả "huỷ" theo số đếm thật. Yêu cầu trả hàng chuyển sang "Hàng đã về" khi đã về đủ số đã duyệt; nếu mới về một phần, yêu cầu vẫn "Chờ hàng về" và Sale có thể bấm "Đã nhận đủ hàng".',
    // WF-05 Q-18: phiếu có thùng mở / hàng lẻ — Quản lý kho xác nhận, khác người đếm
    managerRequired:
      "Phiếu có thùng đã mở hoặc hàng lẻ: chỉ Quản lý kho xác nhận được (cần quyền duyệt phiếu nhập hàng hoàn).",
    selfConfirmation:
      "Bạn đã quét thùng hoặc ghi hàng lẻ trên phiếu này. Phiếu có thùng mở / hàng lẻ phải do một Quản lý kho khác xác nhận.",
    // WF-05 Q-18 / BE-20: thùng về đã mở không nhập tồn
    notStocked: "Không nhập tồn — huỷ",
    willNotStock: "Sẽ không nhập tồn (thùng đã mở)",
    cancel: "Huỷ phiếu",
    cancelTitle: "Huỷ phiếu nhập hàng hoàn",
    cancelDescription: "Không nhận gì trên phiếu này. Có thể lập phiếu khác sau.",
    // WF-05 TH-4: hàng về không nhãn thùng — ghi nhận cho yêu cầu trả hàng, không nhập tồn
    loose: {
      title: "Hàng lẻ không nhãn",
      hint: "Hàng về không có nhãn thùng: ghi SKU, lô (nếu đọc được), số lượng đếm thật và ảnh (bắt buộc). Không nhập tồn (hàng bị huỷ) nhưng được tính là đã về cho yêu cầu trả hàng, tối đa số đã duyệt còn lại. Hàng vượt số duyệt hoặc không được duyệt không ghi ở đây: giữ hộ khách, ghi biên nhận trên yêu cầu trả hàng. Ghi lại cùng SKU và lô thì thay số cũ.",
      sku: "SKU",
      lot: "Lô (nếu có)",
      quantity: "Số lượng",
      photo: "Ảnh hàng lẻ",
      photoColumn: "Ảnh",
      photoRequired: "Chụp hoặc chọn ảnh hàng lẻ (JPEG hoặc PNG, tối đa 20 MB).",
      photoWrongType: "Chỉ nhận ảnh JPEG hoặc PNG.",
      photoTooLarge: "Ảnh vượt 20 MB.",
      // BE `GoodsReceiptPhotoService.MAX_PHOTOS_PER_SUBJECT` = 10 ảnh hàng lẻ mỗi phiếu
      photoLimit:
        "Phiếu đã đủ 10 ảnh hàng lẻ — mức tối đa của một phiếu nhập, không thêm ảnh hàng lẻ được nữa.",
      photoUploading: "Đang tải ảnh…",
      hasPhoto: "Có ảnh",
      noPhoto: "Chưa có ảnh",
      add: "Ghi nhận",
      remove: "Gỡ",
      none: "Chưa ghi hàng lẻ nào.",
      invalid: "SKU phải là một SKU của đơn, số lượng ≥ 1.",
    },
  },
  success: {
    created: "Đã lập phiếu nhập hàng hoàn",
    scanned: "Đã thêm thùng",
    removed: "Đã gỡ thùng",
    confirmed: "Đã xác nhận nhập hàng hoàn",
    cancelled: "Đã huỷ phiếu",
    looseRecorded: "Đã ghi nhận hàng lẻ",
    looseRemoved: "Đã gỡ hàng lẻ",
  },
} as const;
