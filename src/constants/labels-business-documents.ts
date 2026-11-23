/**
 * Giấy tờ nghiệp vụ tải PDF ở back office (BE `feat/business-documents`, rescope-handoff `documents/endpoints.md`):
 * nhãn nút, quyền của endpoint (nút chỉ hiện cho vai có quyền đó — BE vẫn kiểm lại), tên file dự phòng khi thiếu
 * `Content-Disposition`, và câu tiếng Việt cho mã lỗi mỗi endpoint trả.
 *
 * Quyền là mã seed của BE (`identity.role_permission`); ghi chú "vai" là seed đọc ngày 2026-11-23.
 */

export type BusinessDocumentKind =
  | "contractAppendix"
  | "contractLiquidation"
  | "returnReceiptVoucher"
  | "refundConfirmation"
  | "paymentConfirmation"
  | "debtReconciliation"
  | "einvoiceAgreementDraft";

export interface BusinessDocumentSpec {
  /** Nhãn nút "Tải …". */
  label: string;
  /** Tên giấy tờ trong câu lỗi. */
  noun: string;
  /** `resource:ACTION` của endpoint. */
  permission: `${string}:READ`;
  /** Khi BE không gửi `Content-Disposition` (không xảy ra với BE hiện tại). */
  fallbackName: string;
  /** Câu theo `errorCode` của endpoint — ưu tiên trước câu chung 403/404. */
  errors: Readonly<Record<string, string>>;
}

export const BUSINESS_DOCUMENTS: Readonly<Record<BusinessDocumentKind, BusinessDocumentSpec>> = {
  // #1 — SALES_STAFF, SALES_MANAGER, ACCOUNTANT, PRODUCTION_COORDINATOR
  contractAppendix: {
    label: "Tải phụ lục hợp đồng",
    noun: "phụ lục hợp đồng",
    permission: "sales-contracts:READ",
    fallbackName: "Phụ lục hợp đồng.pdf",
    errors: {
      NOT_FOUND:
        "Chưa có phụ lục: từ khi ký hợp đồng chưa có lịch giao nào được dời, nên không có điều khoản nào thay đổi.",
      SALES_CONTRACT_STATUS_INVALID: "Hợp đồng chưa được hai bên ký nên chưa lập phụ lục.",
      SALES_CONTRACT_NOT_FOUND: "Đơn hàng này chưa có hợp đồng.",
    },
  },
  // #2 — như #1. Owner 2026-11-23: biên bản giữ giá trị hợp đồng ban đầu; "Còn lại" phải bằng 0, BE từ chối khi khác 0
  contractLiquidation: {
    label: "Tải biên bản thanh lý",
    noun: "biên bản thanh lý hợp đồng",
    permission: "sales-contracts:READ",
    fallbackName: "Biên bản thanh lý hợp đồng.pdf",
    errors: {
      SALES_CONTRACT_STATUS_INVALID:
        "Chưa thanh lý được hợp đồng: hợp đồng chưa ký, đơn còn đang thực hiện (chưa hoàn tất, huỷ, hoàn tiền hoặc đóng), hoặc số “Còn lại” chưa về 0 — còn tiền khách phải trả hay tiền phải hoàn cho khách.",
      SALES_CONTRACT_NOT_FOUND: "Đơn hàng này chưa có hợp đồng.",
    },
  },
  // #3 — WAREHOUSE_STAFF, WAREHOUSE_MANAGER; owner 2026-11-23: ACCOUNTANT xem và in (không sửa)
  returnReceiptVoucher: {
    label: "Tải phiếu nhập kho (01-VT)",
    noun: "phiếu nhập kho",
    permission: "procurement-goods-receipts:READ",
    fallbackName: "Phiếu nhập kho.pdf",
    errors: {
      GOODS_RECEIPT_NOT_FOUND: "Không tìm thấy phiếu nhập hàng hoàn.",
      INVALID_RECEIPT_TRANSITION:
        "Phiếu chưa được xác nhận nhập kho nên chưa in phiếu nhập kho 01-VT.",
      FORBIDDEN:
        "Phiếu này thuộc kho bạn không được phân công, nên bạn không tải được phiếu nhập kho.",
    },
  },
  // #4 — ACCOUNTANT, SALES_STAFF, SALES_MANAGER
  refundConfirmation: {
    label: "Tải phiếu hoàn tiền",
    noun: "phiếu hoàn tiền",
    permission: "payment-refunds:READ",
    fallbackName: "Phiếu hoàn tiền.pdf",
    errors: {
      REFUND_RECORD_NOT_FOUND: "Không tìm thấy ghi nhận hoàn tiền này.",
      REFUND_RECORD_ALREADY_VOIDED:
        "Ghi nhận hoàn tiền này đã bị huỷ nên không in phiếu hoàn tiền.",
    },
  },
  // #5 — ACCOUNTANT, SALES_STAFF, SALES_MANAGER
  paymentConfirmation: {
    label: "Tải phiếu xác nhận thanh toán",
    noun: "phiếu xác nhận thanh toán",
    permission: "payment-installments:READ",
    fallbackName: "Phiếu xác nhận thanh toán.pdf",
    errors: {
      INSTALLMENT_NOT_FOUND: "Không tìm thấy đợt thanh toán.",
      PAYMENT_RECEIPT_NOT_FOUND:
        "Phiếu thu này không trả cho đợt này hoặc đã bị huỷ, nên không có phiếu xác nhận thanh toán.",
    },
  },
  // #6 — ACCOUNTANT, SALES_STAFF, SALES_MANAGER
  debtReconciliation: {
    label: "Đối chiếu công nợ",
    noun: "biên bản đối chiếu công nợ",
    permission: "payment-installments:READ",
    fallbackName: "Biên bản đối chiếu công nợ.pdf",
    errors: {
      VALIDATION_FAILED:
        "Kỳ đối chiếu không hợp lệ: ngày đến phải từ ngày bắt đầu trở đi và không sau hôm nay.",
      CUSTOMER_NOT_FOUND: "Không tìm thấy khách hàng.",
    },
  },
  // #7 — ACCOUNTANT, SALES_MANAGER; `{id}` là bản điều chỉnh / thay thế, không phải hoá đơn gốc
  einvoiceAgreementDraft: {
    label: "Tải biên bản thoả thuận (bản nháp)",
    noun: "biên bản thoả thuận",
    permission: "einvoices:READ",
    fallbackName: "Biên bản thỏa thuận.pdf",
    errors: {
      EINVOICE_NOT_FOUND: "Không tìm thấy hoá đơn.",
      EINVOICE_CORRECTION_NOT_APPLICABLE:
        "Hoá đơn này không cần biên bản thoả thuận (hoá đơn gốc, bản nháp đã huỷ, hoặc hoá đơn gốc chưa có số).",
    },
  },
};

export const BUSINESS_DOCUMENT_LABELS = {
  busy: "Đang tạo PDF…",
  failedTitle: (noun: string) => `Không tải được ${noun}`,
  forbidden: (noun: string) => `Bạn không có quyền tải ${noun}.`,
  notFound: (noun: string) => `Không tìm thấy ${noun}.`,
  generic: (noun: string) => `Chưa tạo được ${noun}. Vui lòng thử lại sau.`,
  /**
   * 409 `SALES_CONTRACT_STATUS_INVALID` của biên bản thanh lý theo `details.reason` (BE 15cd13cf,
   * `ContractPaperService.liquidation`); số tiền đã định dạng VND. Không có `reason` (hợp đồng chưa ký) → câu chung ở
   * `BUSINESS_DOCUMENTS.contractLiquidation.errors`.
   */
  liquidationRefusal: {
    stillPerformed:
      "Hợp đồng còn đang thực hiện: chỉ lập biên bản thanh lý khi đơn đã hoàn tất, đã huỷ, đã hoàn tiền hoặc đã đóng.",
    notSettled: (owed: string | null, toRefund: string | null) =>
      `Chưa thanh lý được hợp đồng: ${
        [
          owed ? `khách còn phải thanh toán ${owed}` : null,
          toRefund ? `bên bán còn phải hoàn cho khách ${toRefund}` : null,
        ]
          .filter(Boolean)
          .join(" và ") || "số tiền hai bên chưa khớp"
      }. Biên bản thanh lý chỉ lập khi số “Còn lại” bằng 0.`,
  },
  reconciliation: {
    dialogTitle: "Biên bản đối chiếu công nợ",
    description: (customer: string) =>
      `Chọn kỳ đối chiếu công nợ với ${customer}. Ngày kết thúc không được sau hôm nay.`,
    from: "Từ ngày",
    to: "Đến ngày",
    submit: "Tải biên bản",
    rangeInvalid: "Ngày đến phải từ ngày bắt đầu trở đi và không sau hôm nay.",
    required: "Chọn đủ ngày bắt đầu và ngày kết thúc.",
  },
} as const;
