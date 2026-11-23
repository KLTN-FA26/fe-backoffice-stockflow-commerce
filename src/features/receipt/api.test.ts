import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  HCM_ID,
  PRODUCTION_ORDER_ID,
  RECEIPT_ID,
  apiLine,
  apiPurchaseReceipt,
  apiReceipt,
  apiReceiptPage,
  cartonLine,
} from "./__fixtures__/receipt";
import {
  cancelGoodsReceipt,
  confirmGoodsReceipt,
  dayAfterStartInstant,
  dayStartInstant,
  getGoodsReceipt,
  listGoodsReceipts,
} from "./api";

afterEach(() => vi.restoreAllMocks());

describe("goods receipt API — hợp đồng BE sau 4A-9", () => {
  it("list gửi page 0-based, status đổi sang mã BE, ngày lọc theo giờ VN", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: apiReceiptPage() });

    const result = await listGoodsReceipts({
      page: 1,
      size: 20,
      status: ["Draft", "In Putaway"],
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
      status: ["DRAFT", "IN_PUTAWAY"],
      search: "GR-2026",
      receivedFrom: "2026-09-30T17:00:00.000Z",
      receivedTo: "2026-10-09T17:00:00.000Z",
      sort: "receivedAt,desc",
    });
    expect(result.items[0]).toMatchObject({
      status: "Draft",
      receiptType: "PRODUCTION",
      productionOrderCode: "PO-HCM-0007",
      producerName: "Xưởng in Ánh Dương",
    });
  });

  it("list lọc theo Đơn sản xuất và loại phiếu; không gửi tham số mua hàng cũ", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: apiReceiptPage() });

    await listGoodsReceipts({ productionOrderId: PRODUCTION_ORDER_ID, receiptType: "PRODUCTION" });

    const params = get.mock.calls[0]?.[1]?.params as Record<string, unknown>;
    expect(params).toMatchObject({
      productionOrderId: PRODUCTION_ORDER_ID,
      receiptType: "PRODUCTION",
    });
    expect(params).not.toHaveProperty("purchaseOrderId");
    expect(params).not.toHaveProperty("withoutPo");
  });

  it("lọc theo kho: gửi warehouseId khi có, bỏ hẳn khi rỗng", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: apiReceiptPage() });

    await listGoodsReceipts({ warehouseId: "wh-hni" });
    await listGoodsReceipts({ warehouseId: "" });

    expect(get.mock.calls[0]?.[1]?.params).toMatchObject({ warehouseId: "wh-hni" });
    expect(get.mock.calls[1]?.[1]?.params).toMatchObject({ warehouseId: undefined });
  });

  it("đầu ngày VN → Instant UTC; receivedTo loại trừ nên lấy 00:00 hôm sau", () => {
    expect(dayStartInstant("2026-10-09")).toBe("2026-10-08T17:00:00.000Z");
    expect(dayAfterStartInstant("2026-10-09")).toBe("2026-10-09T17:00:00.000Z");
  });

  it("detail parse dòng + tiến độ Đơn sản xuất + thùng và map status", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: apiReceipt({ status: "IN_PUTAWAY", lines: [cartonLine()] }),
    });

    const receipt = await getGoodsReceipt(RECEIPT_ID);

    expect(receipt.status).toBe("In Putaway");
    expect(receipt.warehouseId).toBe(HCM_ID);
    expect(receipt.lines[0]?.production).toMatchObject({ orderedCartons: 10, remainingCartons: 4 });
    expect(receipt.lines[0]?.packages).toHaveLength(2);
  });

  it("phiếu mua hàng cũ parse được: không có Đơn sản xuất, dòng không có tiến độ", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: apiPurchaseReceipt() });

    const receipt = await getGoodsReceipt(RECEIPT_ID);

    expect(receipt.receiptType).toBe("PURCHASE");
    expect(receipt.productionOrderId).toBeNull();
    expect(receipt.lines[0]?.production).toBeNull();
  });

  it("response sai hợp đồng → ném lỗi parse, không lọt vào React Query", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: apiReceipt({ status: "IN_QC" as never }) });
    await expect(getGoodsReceipt(RECEIPT_ID)).rejects.toThrow();
  });

  it("thiếu receiptType → ném lỗi parse (BE luôn trả loại phiếu)", async () => {
    const { receiptType: _type, ...withoutType } = apiReceipt();
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: withoutType });
    await expect(getGoodsReceipt(RECEIPT_ID)).rejects.toThrow();
  });

  it("xác nhận gọi /confirmation, huỷ gọi /cancellation, không body", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValueOnce({ data: apiReceipt({ status: "IN_PUTAWAY", lines: [apiLine()] }) })
      .mockResolvedValueOnce({ data: apiReceipt({ status: "CANCELLED" }) });

    const confirmed = await confirmGoodsReceipt(RECEIPT_ID);
    const cancelled = await cancelGoodsReceipt(RECEIPT_ID);

    expect(post.mock.calls[0]).toEqual([`/goods-receipts/${RECEIPT_ID}/confirmation`, undefined]);
    expect(post.mock.calls[1]).toEqual([`/goods-receipts/${RECEIPT_ID}/cancellation`, undefined]);
    expect(confirmed.status).toBe("In Putaway");
    expect(cancelled.status).toBe("Cancelled");
  });
});
