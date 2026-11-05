import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { TRANSFER_ID, apiTransfer } from "./__fixtures__/transfer";
import {
  createTransferOrder,
  dispatchTransferOrder,
  listTransferOrders,
  rejectTransferOrder,
  submitTransferOrder,
  updateTransferOrder,
} from "./api";

afterEach(() => vi.restoreAllMocks());

const PATH = "/inventory/transfer-orders";
const formValues = {
  fromWarehouseId: "wh-a",
  toWarehouseId: "wh-b",
  reason: "" as const,
  expectedDate: "",
  deliveryMode: "FULL_TRUCKLOAD" as const,
  lines: [{ sku: "CUP-PP-500", lotNumber: "", quantity: 5 }],
};

describe("transfer api — khớp TransferOrderController", () => {
  it("list: trang 0-based, status lặp lại, bỏ filter rỗng; parse PageResponse", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        items: [{ ...apiTransfer(), lines: undefined }],
        page: 0,
        size: 15,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    });
    const page = await listTransferOrders({
      page: 0,
      size: 15,
      status: ["DRAFT", "PICKING"],
      search: " TO- ",
      fromWarehouseId: "",
    });
    const [url, config] = get.mock.calls[0] ?? [];
    expect(url).toBe(PATH);
    expect(config?.params).toEqual({
      page: 0,
      size: 15,
      status: ["DRAFT", "PICKING"],
      fromWarehouseId: undefined,
      toWarehouseId: undefined,
      search: "TO-",
    });
    expect(config?.paramsSerializer).toEqual({ indexes: null });
    expect(page.items[0]?.number).toBe("TO-20261012-0001");
  });

  it("create: chuỗi rỗng → bỏ field tuỳ chọn", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiTransfer() });
    await createTransferOrder(formValues);
    expect(post).toHaveBeenCalledWith(PATH, {
      fromWarehouseId: "wh-a",
      toWarehouseId: "wh-b",
      reason: undefined,
      expectedDate: undefined,
      deliveryMode: "FULL_TRUCKLOAD",
      lines: [{ sku: "CUP-PP-500", lotNumber: undefined, quantity: 5 }],
    });
  });

  it("sửa nháp: PUT kèm version đã đọc", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: apiTransfer() });
    await updateTransferOrder({ transferId: TRANSFER_ID, version: 3, values: formValues });
    expect(put.mock.calls[0]?.[0]).toBe(`${PATH}/${TRANSFER_ID}`);
    expect(put.mock.calls[0]?.[1]).toMatchObject({ version: 3, fromWarehouseId: "wh-a" });
  });

  it("chuyển trạng thái gọi đúng sub-resource", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiTransfer() });
    await submitTransferOrder(TRANSFER_ID);
    await rejectTransferOrder({ transferId: TRANSFER_ID, reason: "Sai SL" });
    await dispatchTransferOrder({
      transferId: TRANSFER_ID,
      lines: [{ lineId: "l-1", shippedQuantity: 3 }],
    });
    expect(post.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [`${PATH}/${TRANSFER_ID}/submission`, undefined],
      [`${PATH}/${TRANSFER_ID}/rejection`, { reason: "Sai SL" }],
      [`${PATH}/${TRANSFER_ID}/dispatch`, { lines: [{ lineId: "l-1", shippedQuantity: 3 }] }],
    ]);
  });

  it("response sai hợp đồng (status lạ) → ném lỗi parse", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { ...apiTransfer(), status: "SHIPPED" } });
    await expect(submitTransferOrder(TRANSFER_ID)).rejects.toThrow();
  });
});
