/**
 * Phiếu nhập kho 01-VT của phiếu hàng hoàn (BE `feat/business-documents` #3) và 409 RETURN_RECEIPT_ALREADY_OPEN khi lập
 * phiếu. Owner 2026-11-23: Kế toán xem và in phiếu (quyền đọc), không có thao tác sửa nào.
 */
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GOODS_RECEIPT_PERMISSIONS } from "@/constants/permissions";
import { apiError } from "@/test/api-screen";

import { ReturnDetail, ReturnReceiptDetail } from "..";
import {
  ACCOUNTANT_GRANTS,
  SALES_GRANTS,
  WAREHOUSE_GRANTS,
  mockReturnApi,
  renderReturnScreen,
  returnJson,
} from "../__fixtures__/screen";
import { openDraftReceiptOf } from "../errors";
import { returnReceiptVoucherReady } from "../lifecycle";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

/** Kế toán sau quyết định 23/11: thêm VIEW_PAGE + READ phiếu nhận hàng, không CREATE / UPDATE. */
const ACCOUNTANT_WITH_VOUCHER = [
  ...ACCOUNTANT_GRANTS,
  GOODS_RECEIPT_PERMISSIONS.viewPage,
  GOODS_RECEIPT_PERMISSIONS.read,
];

const receiptJson = (over: Record<string, unknown> = {}) => ({
  id: "gr-1",
  number: "GR-RET-0001",
  receiptType: "RETURN",
  status: "CLOSED",
  warehouseId: "wh-1",
  orderId: "ord-1",
  orderNumber: "SO-1",
  returnRequestId: "ret-1",
  rmaNumber: "RMA-20261110-0001",
  quarantineLocationCode: "WH1-QC01",
  receivedAt: "2026-11-15T03:00:00Z",
  confirmedAt: "2026-11-15T05:00:00Z",
  cartons: [
    {
      lpn: "LPN-0001",
      sku: "SKU-CUP-01",
      quantity: 10,
      scannedBy: "u-1",
      scannedAt: "2026-11-15T03:10:00Z",
      countedQuantity: 10,
      opened: false,
      stockEntered: true,
      countedBy: "u-1",
    },
  ],
  expectedCartons: [],
  looseLines: [],
  version: 2,
  ...over,
});

describe("returnReceiptVoucherReady — 01-VT only once confirmed (BE 409 INVALID_RECEIPT_TRANSITION before)", () => {
  it.each([
    ["DRAFT", false],
    ["CANCELLED", false],
    ["CONFIRMED", true],
    ["CLOSED", true],
    ["UNKNOWN", false],
  ] as const)("%s → %s", (status, ready) => {
    expect(returnReceiptVoucherReady({ status })).toBe(ready);
  });
});

describe("ReturnReceiptDetail — 01-VT voucher", () => {
  it("the accountant prints the confirmed receipt and sees no edit action", async () => {
    mockReturnApi(ACCOUNTANT_WITH_VOUCHER, {
      get: { "/goods-receipts/returns/gr-1": () => receiptJson() },
    });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    expect(
      await screen.findByRole("button", { name: /Tải phiếu nhập kho \(01-VT\)/ }),
    ).toBeInTheDocument();
    for (const name of [/Xác nhận/, /Huỷ phiếu/])
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("the accountant on a draft: nothing to print and still no edit action", async () => {
    mockReturnApi(ACCOUNTANT_WITH_VOUCHER, {
      get: { "/goods-receipts/returns/gr-1": () => receiptJson({ status: "DRAFT" }) },
    });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    expect(await screen.findByText("GR-RET-0001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /01-VT/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Huỷ phiếu/ })).not.toBeInTheDocument();
  });

  it("the warehouse prints the confirmed receipt too", async () => {
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: { "/goods-receipts/returns/gr-1": () => receiptJson() },
    });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    expect(await screen.findByRole("button", { name: /01-VT/ })).toBeInTheDocument();
  });
});

describe("ReturnDetail — each parcel prints its 01-VT for roles holding the receipt read grant", () => {
  const withParcel = () =>
    returnJson({
      status: "RECEIVED",
      receipt: {
        goodsReceiptId: "gr-1",
        parcels: [{ parcel: 1, goodsReceiptId: "gr-1", receiptNumber: "GR-RET-0001" }],
      },
    });

  it("accountant with the read grant: button on the parcel", async () => {
    mockReturnApi(ACCOUNTANT_WITH_VOUCHER, { get: { "/returns/ret-1": withParcel } });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const parcels = await screen.findByRole("list", { name: "Các lần hàng về" });
    expect(
      within(parcels).getByRole("button", { name: /Phiếu nhập kho 01-VT/ }),
    ).toBeInTheDocument();
  });

  it("sales (no receipt grant): no button", async () => {
    mockReturnApi(SALES_GRANTS, { get: { "/returns/ret-1": withParcel } });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const parcels = await screen.findByRole("list", { name: "Các lần hàng về" });
    expect(within(parcels).queryByRole("button", { name: /01-VT/ })).not.toBeInTheDocument();
  });
});

describe("openDraftReceiptOf — 409 RETURN_RECEIPT_ALREADY_OPEN names the open draft", () => {
  it("reads details.receiptId of that code only", () => {
    expect(
      openDraftReceiptOf(
        apiError(409, "RETURN_RECEIPT_ALREADY_OPEN", undefined, "x", { receiptId: "gr-9" }),
      ),
    ).toBe("gr-9");
    expect(openDraftReceiptOf(apiError(409, "RETURN_RECEIPT_ALREADY_OPEN"))).toBeNull();
    expect(
      openDraftReceiptOf(
        apiError(409, "RETURN_NOT_AWAITING_GOODS", undefined, "x", { receiptId: "gr-9" }),
      ),
    ).toBeNull();
  });
});
