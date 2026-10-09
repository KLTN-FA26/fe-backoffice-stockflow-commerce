import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  PO_ID,
  RECEIPT_ID,
  TABLE_PO_LINE_ID,
  apiLine,
  apiReceipt,
  apiReceiptPage,
  receivablePo,
} from "./__fixtures__/receipt";
import {
  confirmGoodsReceipt,
  createGoodsReceipt,
  dayAfterStartInstant,
  dayStartInstant,
  getGoodsReceipt,
  inspectLine,
  listGoodsReceipts,
  replaceReceiptLines,
} from "./api";
import { getReceivablePurchaseOrder, listReceivablePurchaseOrders } from "./receivable-po-api";

afterEach(() => vi.restoreAllMocks());

describe("goods receipt API — hợp đồng BE PR #62", () => {
  it("list gửi page 0-based, status đổi sang mã BE, ngày lọc theo giờ VN", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: apiReceiptPage() });

    const result = await listGoodsReceipts({
      page: 1,
      size: 20,
      status: ["Draft", "In QC"],
      search: "  GR-2026  ",
      receivedFrom: "2026-10-01",
      receivedTo: "2026-10-09",
      sort: "receivedAt,desc",
    });

    const [path, config] = get.mock.calls[0] ?? [];
    expect(path).toBe("/goods-receipts");
    expect(config?.params).toMatchObject({
      page: 1,
      size: 20,
      status: ["DRAFT", "IN_QC"],
      search: "GR-2026",
      receivedFrom: "2026-09-30T17:00:00.000Z",
      receivedTo: "2026-10-09T17:00:00.000Z",
      sort: "receivedAt,desc",
    });
    expect(result.items[0]?.status).toBe("Draft");
  });

  it("đầu ngày VN → Instant UTC; receivedTo loại trừ nên lấy 00:00 hôm sau", () => {
    expect(dayStartInstant("2026-10-09")).toBe("2026-10-08T17:00:00.000Z");
    expect(dayAfterStartInstant("2026-10-09")).toBe("2026-10-09T17:00:00.000Z");
  });

  it("detail parse dòng + kết quả QC và map status", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: apiReceipt({ status: "IN_QC", lines: [apiLine()] }),
    });
    const receipt = await getGoodsReceipt(RECEIPT_ID);
    expect(receipt.status).toBe("In QC");
    expect(receipt.lines[0]?.qcProgress).toBe("AWAITING_MOVE_TO_QC");
  });

  it("response sai hợp đồng → ném lỗi parse, không lọt vào React Query", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: apiReceipt({ status: "POSTED" as never }) });
    await expect(getGoodsReceipt(RECEIPT_ID)).rejects.toThrow();
  });

  it("tạo phiếu bỏ field rỗng; lưu kiểm đếm gửi đủ dòng, ô trống thành undefined", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: apiReceipt() });
    await createGoodsReceipt({ purchaseOrderId: PO_ID, deliveryNote: "", note: "" });
    expect(post).toHaveBeenCalledWith("/goods-receipts", {
      purchaseOrderId: PO_ID,
      deliveryNote: undefined,
      note: undefined,
    });

    const put = vi.spyOn(api, "put").mockResolvedValueOnce({ data: apiReceipt() });
    await replaceReceiptLines({
      receiptId: RECEIPT_ID,
      lines: [
        {
          purchaseOrderLineId: TABLE_PO_LINE_ID,
          quantity: 6,
          lotNumber: "",
          expiryDate: "",
          locationCode: "HCM-RCV01",
          note: "",
        },
      ],
    });
    expect(put).toHaveBeenCalledWith(`/goods-receipts/${RECEIPT_ID}/lines`, {
      lines: [
        {
          purchaseOrderLineId: TABLE_PO_LINE_ID,
          quantity: 6,
          lotNumber: undefined,
          expiryDate: undefined,
          locationCode: "HCM-RCV01",
          note: undefined,
        },
      ],
    });
  });

  it("xác nhận gọi /confirmation; kết luận QC gửi null cho phần SL 0", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiReceipt() });
    await confirmGoodsReceipt(RECEIPT_ID);
    expect(post).toHaveBeenCalledWith(`/goods-receipts/${RECEIPT_ID}/confirmation`, undefined);

    await inspectLine({
      receiptId: RECEIPT_ID,
      lineId: "line-1",
      decision: {
        accepted: 4,
        quarantined: { quantity: 0, locationCode: "", reason: "" },
        rejected: { quantity: 2, locationCode: "hcm-rtv01", reason: "Nứt mặt bàn" },
      },
    });
    expect(post).toHaveBeenLastCalledWith(`/goods-receipts/${RECEIPT_ID}/lines/line-1/inspection`, {
      accepted: 4,
      quarantined: null,
      rejected: { quantity: 2, locationCode: "HCM-RTV01", reason: "Nứt mặt bàn" },
    });
  });
});

describe("PO chờ nhận — dùng lại API /purchase-orders", () => {
  it("chỉ hỏi PO SENT / PARTIALLY_RECEIVED (BR-01)", async () => {
    const page = {
      items: [receivablePo],
      page: 0,
      size: 50,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    };
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: page });
    await listReceivablePurchaseOrders({});
    expect(get.mock.calls[0]?.[0]).toBe("/purchase-orders");
    expect(get.mock.calls[0]?.[1]?.params).toMatchObject({
      status: ["SENT", "PARTIALLY_RECEIVED"],
    });
  });

  it("detail giữ lineId để làm purchaseOrderLineId", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: { ...receivablePo, unitPrice: 1, extra: "x" },
    });
    const po = await getReceivablePurchaseOrder(PO_ID);
    expect(po.lines.map((line) => line.lineId)).toContain(TABLE_PO_LINE_ID);
    expect(po).not.toHaveProperty("extra");
  });
});
