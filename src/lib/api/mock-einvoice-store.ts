/**
 * Kho mock hoá đơn điện tử (BE module `invoicing`, docs 21) — trạng thái giữ trong bộ nhớ, reset được
 * cho test. Seed phủ đủ trạng thái (`DRAFT`, `SUBMITTING`, `ISSUED`, `REJECTED`, `VOIDED_DRAFT`,
 * `REPLACED`), cảnh báo và một hoá đơn điều chỉnh, theo các đơn mock của module thanh toán.
 */

import { mockCustomerUuid } from "./mock-routes-orders-store";

import type { EInvoiceStatus, EInvoiceType } from "@/constants/einvoice";

export interface MockEInvoiceLine {
  id: string;
  lineNo: number;
  kind: "GOODS" | "FEE";
  feeKind?: "PLATE_FEE" | "SHIPPING_FEE";
  sku?: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitsPerCarton?: number;
  unitPrice: number;
  taxRate: number;
}

export interface MockEInvoice {
  id: string;
  code: string;
  type: EInvoiceType;
  status: EInvoiceStatus;
  adjusted: boolean;
  orderId: string;
  orderNumber: string;
  contractNumber: string;
  shipmentId: string | null;
  shipmentCode: string | null;
  customerId: string;
  originalEInvoiceId: string | null;
  buyer: {
    name: string | null;
    taxCode: string | null;
    address: string | null;
    email: string | null;
  };
  issueDate: string;
  issueDueAt: string;
  lines: MockEInvoiceLine[];
  warnings: string[];
  invoiceNumber: number | null;
  symbol: string | null;
  rejectionCode: string | null;
  rejectionMessage: string | null;
  submittedAt: string | null;
  issuedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  version: number;
  correctionBasis: "ERROR" | "RETURN" | "TRADE_DISCOUNT" | "DELIVERY_FAILED" | null;
  correctionReason: string | null;
  agreement: { number: string; date: string } | null;
  returnRequestId: string | null;
  /** WF-05 HĐ-3: lần giao của hoá đơn bị sửa thành thất bại lúc nào (BE `deliveryFailedAt`); null khi chưa bị đánh dấu. */
  deliveryFailedAt: string | null;
  /** WF-05 F-11: hoá đơn gốc đã bị giảm toàn bộ (BE `reversedAt`). */
  reversedAt?: string | null;
  /** WF-05 F-13: `PORTAL_RECORD` khi Kế toán ghi lại từ cổng NCC. */
  issuedVia?: string | null;
  /** Ngày giao (hợp đồng giả định `deliveredOn`, WF-05 Q-10). */
  deliveredOn?: string | null;
  /** WF-05 F-14: mã lý do huỷ (`UNSENDABLE_REVERSAL`). */
  voidReasonCode?: string | null;
  /**
   * Audit r2 M-10: các yêu cầu trả hàng có hàng đã hoàn tiền đang chờ giảm trên hoá đơn thay thế này (BE
   * `findPendingReturnsOfShipment`, chưa có điều chỉnh cho yêu cầu đó) — nguồn `externalReductionReturns`.
   */
  pendingReturns?: { returnRequestId: string; rmaNumber: string }[];
  /**
   * Audit r3 EINV-2 (mock thay cho BE `EInvoiceDrafts.correctionSendable` = false): NCC đã phát hành hoá đơn gốc này không
   * còn dùng được / không điều chỉnh được — điều chỉnh của nó chỉ làm được trên cổng.
   */
  providerCannotCorrect?: boolean;
  /** Audit r3 EINV-2: hoá đơn giảm ghi từ cổng thay cho bản điều chỉnh sai sót đã huỷ này (BE `einvoice_portal_record`). */
  voidedAdjustmentId?: string | null;
  /** Audit r2 H-2: NCC đã từng nói đang giữ giao dịch (BE `providerHeld`) — không bao giờ rút. */
  providerHeld?: boolean;
  /** Audit r3 EINV-3: tra lại giao dịch cũ tới mốc này sau khi rút / cơ quan thuế từ chối (BE `watchUntil`). */
  watchUntil?: string | null;
  /** Audit r3 EINV-3: lúc thấy NCC vẫn phát hành giao dịch cũ (BE `watchFoundAt`). */
  watchFoundAt?: string | null;
}

export interface MockErrorNotice {
  id: string;
  einvoiceId: string;
  reason: string;
  correctBuyerName: string | null;
  correctBuyerAddress: string | null;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";
  recordedAt: string;
  sentAt: string | null;
}

export interface MockEInvoiceSettings {
  provider: string;
  environment: "SANDBOX" | "PRODUCTION";
  username: string | null;
  secretSet: boolean;
  autoIssue: boolean;
  series: { templateCode: string; symbol: string; year: number }[];
  version: number;
}

export const MOCK_SELLER = {
  name: "CÔNG TY TNHH STOCKFLOW",
  taxCode: "0312345678",
  address: "12 Nguyễn Huệ, Phường Sài Gòn, TP. Hồ Chí Minh",
  email: "ketoan@stockflow.vn",
};
export const MOCK_SYMBOL = "C26TAA";
export const MOCK_TEMPLATE = "1";

let invoices: MockEInvoice[] = [];
let notices: MockErrorNotice[] = [];
let settings: MockEInvoiceSettings;
let sequence = 0;
let invoiceNumber = 0;

export const mockEInvoices = () => invoices;
export const mockErrorNotices = () => notices;
export const mockEInvoiceSettings = () => settings;
export const setMockEInvoiceSettings = (next: MockEInvoiceSettings) => {
  settings = next;
};
export const nextEInvoiceId = () => `EINV-${String(++sequence).padStart(4, "0")}`;
export const nextInvoiceNumber = () => ++invoiceNumber;
export const nextNoticeId = () => `NOTICE-${String(++sequence).padStart(4, "0")}`;

/** Thành tiền dòng = số lượng × đơn giá; thuế làm tròn tới đồng (docs 21 §4.1 bước 2). */
export const lineAmount = (line: MockEInvoiceLine) => line.quantity * line.unitPrice;
/** Thuế suất dạng phần trăm như BE (8 = 8%, `EInvoiceLine.vat`). */
export const lineTax = (line: MockEInvoiceLine) =>
  Math.round((lineAmount(line) * line.taxRate) / 100);

const goods = (
  no: number,
  sku: string,
  name: string,
  cartons: number,
  perCarton: number,
  price: number,
) => ({
  id: `LINE-${sku}-${no}`,
  lineNo: no,
  kind: "GOODS" as const,
  sku,
  itemName: name,
  unit: "cái",
  quantity: cartons * perCarton,
  unitsPerCarton: perCarton,
  unitPrice: price,
  taxRate: 8,
});

const BUYER_9 = {
  name: "CÔNG TY TNHH CÀ PHÊ SÀI GÒN XƯA",
  taxCode: "0315987654",
  address: "45 Lê Lợi, Phường Bến Thành, TP. Hồ Chí Minh",
  email: "hoadon@saigonxua.vn",
};
const BUYER_12 = {
  name: "CÔNG TY CP TRÀ SỮA MÂY",
  taxCode: "0109876543",
  address: "8 Tràng Tiền, Phường Hoàn Kiếm, Hà Nội",
  email: null,
};

function invoice(
  over: Partial<MockEInvoice> & Pick<MockEInvoice, "id" | "orderId" | "status">,
): MockEInvoice {
  return {
    code: `HDDT-${over.id.replace("EINV-", "")}`,
    type: "ORIGINAL",
    adjusted: false,
    orderNumber: over.orderId,
    contractNumber: `HD-20261108-${over.orderId.slice(-6)}-1`,
    shipmentId: `SHP-${over.orderId}-1`,
    shipmentCode: `${over.orderId}-S1`,
    customerId: mockCustomerUuid("CUS-0009"),
    originalEInvoiceId: null,
    buyer: BUYER_9,
    issueDate: "2026-11-10",
    // NĐ 254 / WF-05 G3: hạn phát hành = hết chính ngày lập (23:59:59 giờ VN), không còn "ngày làm việc kế tiếp"
    issueDueAt: "2026-11-10T16:59:59Z",
    lines: [goods(1, "CUP-PAPER-8OZ-WHT", "Ly giấy 8oz in logo", 20, 1000, 780)],
    warnings: [],
    invoiceNumber: null,
    symbol: null,
    rejectionCode: null,
    rejectionMessage: null,
    submittedAt: null,
    issuedAt: null,
    voidedAt: null,
    voidReason: null,
    version: 0,
    correctionBasis: null,
    correctionReason: null,
    agreement: null,
    returnRequestId: null,
    deliveryFailedAt: null,
    ...over,
  };
}

export function resetEInvoiceMockStore(): void {
  sequence = 100;
  invoiceNumber = 41;
  const issued = (n: number) => ({
    invoiceNumber: n,
    symbol: MOCK_SYMBOL,
    issuedAt: "2026-11-08T03:00:00Z",
  });
  invoices = [
    // Nháp chờ phát hành, quá hạn (ngày lập = ngày giao, docs 21 §4.1 bước 3)
    invoice({
      id: "EINV-0001",
      orderId: "ORD-2026-0013",
      status: "DRAFT",
      issueDueAt: "2026-11-10T16:59:59Z",
    }),
    // Nháp thiếu mã số thuế / email → chặn phát hành (BR-06)
    invoice({
      id: "EINV-0002",
      orderId: "ORD-2026-0014",
      status: "DRAFT",
      customerId: mockCustomerUuid("CUS-0012"),
      buyer: { ...BUYER_12, taxCode: null },
      warnings: ["BUYER_PROFILE_INCOMPLETE"],
      issueDate: "2026-11-13",
      issueDueAt: "2099-11-13T16:59:59Z",
    }),
    // Đang gửi NCC, NCC báo không biết giao dịch (BR-05)
    invoice({
      id: "EINV-0003",
      orderId: "ORD-2026-0010",
      customerId: mockCustomerUuid("CUS-0008"),
      status: "SUBMITTING",
      submittedAt: "2026-11-12T02:00:00Z",
      warnings: ["UNKNOWN_TO_PROVIDER"],
    }),
    // Bị từ chối vì sai ký hiệu
    invoice({
      id: "EINV-0004",
      orderId: "ORD-2026-0016",
      status: "REJECTED",
      rejectionCode: "INVALID_SERIES",
      rejectionMessage: "Ký hiệu hoá đơn không hợp lệ",
      submittedAt: "2026-11-09T02:00:00Z",
    }),
    // Đã phát hành, có điều chỉnh giảm vì trả hàng
    invoice({
      id: "EINV-0005",
      orderId: "ORD-2026-0011",
      status: "ISSUED",
      adjusted: true,
      ...issued(38),
    }),
    invoice({
      id: "EINV-0006",
      orderId: "ORD-2026-0011",
      type: "ADJUSTMENT",
      status: "ISSUED",
      originalEInvoiceId: "EINV-0005",
      correctionBasis: "RETURN",
      correctionReason: "Khách trả 2 thùng lỗi in",
      returnRequestId: "RMA-0003",
      lines: [
        { ...goods(1, "CUP-PAPER-8OZ-WHT", "Ly giấy 8oz in logo", 2, 1000, 780), quantity: -2000 },
      ],
      ...issued(39),
    }),
    // Đã phát hành, sạch
    invoice({ id: "EINV-0007", orderId: "ORD-2026-0012", status: "ISSUED", ...issued(40) }),
    // Bị thay thế và hoá đơn thay thế
    invoice({ id: "EINV-0008", orderId: "ORD-2026-0015", status: "REPLACED", ...issued(36) }),
    invoice({
      id: "EINV-0009",
      orderId: "ORD-2026-0015",
      type: "REPLACEMENT",
      status: "ISSUED",
      originalEInvoiceId: "EINV-0008",
      correctionBasis: "ERROR",
      correctionReason: "Sai mã số thuế bên mua",
      agreement: { number: "TT-0015/2026", date: "2026-11-07" },
      ...issued(37),
    }),
    // Nháp huỷ vì kết quả giao bị sửa thành thất bại (docs 21 §4.5)
    invoice({
      id: "EINV-0010",
      orderId: "ORD-2026-0017",
      status: "VOIDED_DRAFT",
      voidedAt: "2026-11-09T05:00:00Z",
      voidReason: "Kết quả giao sửa thành giao không thành công",
    }),
    // Đã phát hành rồi lần giao bị sửa thành thất bại → hệ thống lập điều chỉnh giảm toàn bộ (WF-05 HĐ-3)
    invoice({
      id: "EINV-0011",
      orderId: "ORD-2026-0018",
      status: "ISSUED",
      adjusted: true,
      deliveryFailedAt: "2026-11-09T07:00:00Z",
      ...issued(35),
    }),
    invoice({
      id: "EINV-0012",
      orderId: "ORD-2026-0018",
      type: "ADJUSTMENT",
      status: "DRAFT",
      originalEInvoiceId: "EINV-0011",
      correctionBasis: "DELIVERY_FAILED",
      correctionReason: "Lần giao bị sửa thành giao không thành công",
      issueDate: "2026-11-09",
      issueDueAt: "2099-11-09T16:59:59Z",
      lines: [
        {
          ...goods(1, "CUP-PAPER-8OZ-WHT", "Ly giấy 8oz in logo", 20, 1000, 780),
          quantity: -20000,
        },
      ],
    }),
    // Audit r3 EINV-2: hoá đơn gốc của NCC không còn điều chỉnh được; điều chỉnh sai sót (đã thoả thuận, giảm 2 thùng) không
    // gửi được nên Kế toán đã huỷ để làm trên cổng → "Ghi hoá đơn giảm" căn cứ sai sót
    invoice({
      id: "EINV-0013",
      orderId: "ORD-2026-0019",
      status: "ISSUED",
      providerCannotCorrect: true,
      ...issued(34),
    }),
    invoice({
      id: "EINV-0014",
      orderId: "ORD-2026-0019",
      type: "ADJUSTMENT",
      status: "VOIDED_DRAFT",
      originalEInvoiceId: "EINV-0013",
      correctionBasis: "ERROR",
      correctionReason: "Ghi thừa 2 thùng so với số giao",
      agreement: { number: "TT-0019/2026", date: "2026-11-12" },
      voidedAt: "2026-11-12T04:00:00Z",
      voidReason: "Nhà cung cấp của hoá đơn gốc không còn dùng được — làm trên cổng",
      issueDate: "2026-11-12",
      issueDueAt: "2099-11-12T16:59:59Z",
      lines: [
        { ...goods(1, "CUP-PAPER-8OZ-WHT", "Ly giấy 8oz in logo", 2, 1000, 780), quantity: -2000 },
      ],
    }),
  ];
  notices = [];
  settings = {
    provider: "SANDBOX",
    environment: "SANDBOX",
    username: null,
    secretSet: false,
    autoIssue: false,
    series: [{ templateCode: MOCK_TEMPLATE, symbol: MOCK_SYMBOL, year: 2026 }],
    version: 0,
  };
}

resetEInvoiceMockStore();
