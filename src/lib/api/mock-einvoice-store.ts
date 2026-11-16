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
  correctionBasis: "ERROR" | "RETURN" | "TRADE_DISCOUNT" | null;
  correctionReason: string | null;
  agreement: { number: string; date: string } | null;
  returnRequestId: string | null;
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
export const lineTax = (line: MockEInvoiceLine) => Math.round(lineAmount(line) * line.taxRate);

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
  taxRate: 0.08,
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
    issueDueAt: "2026-11-11T16:59:59Z",
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
      issueDueAt: "2026-11-11T16:59:59Z",
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
      issueDueAt: "2099-11-14T16:59:59Z",
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
