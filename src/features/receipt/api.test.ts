import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  HCM_ID,
  PO_ID,
  RECEIPT_ID,
  SUPPLIER_ID,
  apiBlindReceipt,
  TABLE_PO_LINE_ID,
  apiLine,
  apiReceipt,
  apiReceiptPage,
  receivablePo,
} from "./__fixtures__/receipt";
import {
  approveGoodsReceipt,
  cancelGoodsReceipt,
  confirmGoodsReceipt,
  createGoodsReceipt,
  createGoodsReceiptWithoutPo,
  dayAfterStartInstant,
  dayStartInstant,
  getGoodsReceipt,
  inspectLine,
  listGoodsReceipts,
  referencePurchaseOrder,
  rejectBlindReceipt,
  rejectReceiptExcess,
  replaceBlindReceiptLines,
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

describe("goods receipt API — nhận vượt dung sai chờ Quản lý kho duyệt (BR-RCP-001, SCRUM-477)", () => {
  const approval = {
    requestedAt: "2026-10-09T03:00:00Z",
    requestedBy: "u-1",
    requestedByName: "Lan",
    decision: null,
  };

  it("detail map PENDING_APPROVAL → 'Pending Approval', parse cảnh báo OVER_TOLERANCE và khối approval", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: apiReceipt({
        status: "PENDING_APPROVAL",
        lines: [apiLine({ quantity: 110, warnings: ["OVER_TOLERANCE"] })],
        warnings: ["OVER_TOLERANCE"],
        approval,
      }),
    });
    const receipt = await getGoodsReceipt(RECEIPT_ID);
    expect(receipt.status).toBe("Pending Approval");
    expect(receipt.warnings).toEqual(["OVER_TOLERANCE"]);
    expect(receipt.lines[0]?.warnings).toEqual(["OVER_TOLERANCE"]);
    expect(receipt.approval).toMatchObject({ requestedByName: "Lan", decision: null });
  });

  it("BE cũ không trả warnings / approval → mặc định rỗng / null, không ném lỗi parse", async () => {
    const legacy: Record<string, unknown> = { ...apiReceipt({ lines: [apiLine()] }) };
    delete legacy.warnings;
    delete legacy.approval;
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: legacy });
    const receipt = await getGoodsReceipt(RECEIPT_ID);
    expect(receipt.warnings).toEqual([]);
    expect(receipt.approval).toBeUndefined();
  });

  it("quyết định lạ → ném lỗi parse (hợp đồng BE chỉ APPROVED / EXCESS_REJECTED)", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: apiReceipt({ approval: { ...approval, decision: "MAYBE" as never } }),
    });
    await expect(getGoodsReceipt(RECEIPT_ID)).rejects.toThrow();
  });

  it("duyệt gọi POST /approval { reason }, từ chối phần vượt gọi /excess-rejection { reason }", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiReceipt({ status: "IN_QC" }) });
    const approved = await approveGoodsReceipt({ receiptId: RECEIPT_ID, reason: "hàng tặng" });
    expect(post).toHaveBeenLastCalledWith(`/goods-receipts/${RECEIPT_ID}/approval`, {
      reason: "hàng tặng",
    });
    expect(approved.status).toBe("In QC");

    await rejectReceiptExcess({ receiptId: RECEIPT_ID, reason: "trả NCC" });
    expect(post).toHaveBeenLastCalledWith(`/goods-receipts/${RECEIPT_ID}/excess-rejection`, {
      reason: "trả NCC",
    });
  });

  it("huỷ phiếu chờ duyệt dùng cùng /cancellation", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: apiReceipt({ status: "CANCELLED" }) });
    expect((await cancelGoodsReceipt(RECEIPT_ID)).status).toBe("Cancelled");
    expect(post).toHaveBeenCalledWith(`/goods-receipts/${RECEIPT_ID}/cancellation`, undefined);
  });

  it("danh sách lọc 'Pending Approval' gửi mã BE PENDING_APPROVAL", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: apiReceiptPage() });
    await listGoodsReceipts({ status: ["Pending Approval"] });
    expect(get.mock.calls[0]?.[1]?.params).toMatchObject({ status: ["PENDING_APPROVAL"] });
  });
});

describe("goods receipt API — hàng về không có PO (BR-RCP-002, SCRUM-478)", () => {
  it("tạo phiếu không có PO: POST /without-po với NCC + kho + lý do; ô trống bỏ đi", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: apiBlindReceipt() });
    const receipt = await createGoodsReceiptWithoutPo({
      supplierId: SUPPLIER_ID,
      warehouseId: HCM_ID,
      reason: "NCC tặng kèm hàng mẫu",
      deliveryNote: "DN-9",
      note: "",
    });
    expect(post).toHaveBeenCalledWith("/goods-receipts/without-po", {
      supplierId: SUPPLIER_ID,
      warehouseId: HCM_ID,
      reason: "NCC tặng kèm hàng mẫu",
      deliveryNote: "DN-9",
      note: undefined,
    });
    expect(receipt.withoutPurchaseOrder).toBe(true);
    expect(receipt.purchaseOrderId).toBeNull();
  });

  it("detail phiếu không có PO parse được: không có PO, NCC + lý do của phiếu, dòng không có dòng PO", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: apiBlindReceipt({
        lines: [apiLine({ purchaseOrderLineId: null, purchaseOrderLineNo: null })],
        referencedPurchaseOrderId: PO_ID,
        referencedPurchaseOrderNumber: "PO-9",
      }),
    });
    const receipt = await getGoodsReceipt(RECEIPT_ID);
    expect(receipt).toMatchObject({
      withoutPurchaseOrder: true,
      supplierName: "Xưởng gỗ Việt",
      blindReason: "NCC tặng kèm hàng mẫu",
      referencedPurchaseOrderNumber: "PO-9",
    });
    expect(receipt.lines[0]?.purchaseOrderLineId).toBeNull();
  });

  it("lưu kiểm đếm phiếu không có PO gọi hàng bằng sku (hoa), không có purchaseOrderLineId", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValueOnce({ data: apiBlindReceipt() });
    await replaceBlindReceiptLines({
      receiptId: RECEIPT_ID,
      lines: [
        {
          sku: "SOFA-3S-GREY",
          quantity: 2,
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
          sku: "SOFA-3S-GREY",
          quantity: 2,
          lotNumber: undefined,
          expiryDate: undefined,
          locationCode: "HCM-RCV01",
          note: undefined,
        },
      ],
    });
  });

  it("từ chối phiếu gọi POST /rejection { reason }; gắn PO tham chiếu gọi PUT /referenced-purchase-order", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: apiBlindReceipt({ status: "CANCELLED" }) });
    const rejected = await rejectBlindReceipt({
      receiptId: RECEIPT_ID,
      reason: "không phải hàng của ta",
    });
    expect(post).toHaveBeenCalledWith(`/goods-receipts/${RECEIPT_ID}/rejection`, {
      reason: "không phải hàng của ta",
    });
    expect(rejected.status).toBe("Cancelled");

    const put = vi.spyOn(api, "put").mockResolvedValueOnce({
      data: apiBlindReceipt({
        referencedPurchaseOrderId: PO_ID,
        referencedPurchaseOrderNumber: "PO-9",
      }),
    });
    const referenced = await referencePurchaseOrder({
      receiptId: RECEIPT_ID,
      purchaseOrderId: PO_ID,
    });
    expect(put).toHaveBeenCalledWith(`/goods-receipts/${RECEIPT_ID}/referenced-purchase-order`, {
      purchaseOrderId: PO_ID,
    });
    expect(referenced.referencedPurchaseOrderId).toBe(PO_ID);
  });

  it("quyết định REJECTED của BE parse được (huỷ cả phiếu)", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: apiBlindReceipt({
        status: "CANCELLED",
        approval: {
          requestedAt: "2026-10-09T03:00:00Z",
          requestedBy: "u-1",
          decision: "REJECTED",
          decidedAt: "2026-10-09T04:00:00Z",
          decidedBy: "u-2",
          reason: "không phải hàng của ta",
        },
      }),
    });
    expect((await getGoodsReceipt(RECEIPT_ID)).approval?.decision).toBe("REJECTED");
  });

  it("danh sách lọc phiếu không có PO gửi withoutPo=true; hàng danh sách mang NCC và cờ không có PO", async () => {
    const row = { ...apiReceiptPage([apiBlindReceipt()]).items[0], withoutPurchaseOrder: true };
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: { ...apiReceiptPage(), items: [row] },
    });
    const page = await listGoodsReceipts({ withoutPo: true });
    expect(get.mock.calls[0]?.[1]?.params).toMatchObject({ withoutPo: true });
    expect(page.items[0]?.withoutPurchaseOrder).toBe(true);
  });
});

describe("PO chờ nhận — dùng lại API /purchase-orders", () => {
  it("chỉ hỏi PO CONFIRMED / PARTIALLY_RECEIVED (BR-01, BE PR #71 D4)", async () => {
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
      status: ["CONFIRMED", "PARTIALLY_RECEIVED"],
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
