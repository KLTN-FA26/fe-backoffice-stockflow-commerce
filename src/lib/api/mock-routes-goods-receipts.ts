/**
 * Mock routes — Goods receipt (module 03), khớp `GoodsReceiptController` của BE sau 4A-8 / 4A-9. Chỉ dùng khi
 * USE_MOCK=true.
 *
 * BE đã bỏ mua hàng: không còn tạo phiếu theo PO / không chứng từ, không duyệt vượt dung sai, không QC ở kho.
 * Dữ liệu seed ở đây đều là phiếu mua hàng cũ (`receiptType = PURCHASE`) — BE chỉ cho đọc và huỷ phiếu chưa ghi
 * nhận; xác nhận trả `INVALID_RECEIPT_TRANSITION`. Phiếu theo Đơn sản xuất (`POST /goods-receipts/production`)
 * thêm cùng màn nhập ở SCRUM-566.
 *
 * Trả đúng hợp đồng: PageResponse trang từ 0, lỗi `{ errorCode, message, fieldErrors[] }`, cùng mã lỗi và HTTP
 * status như BE. Message lỗi giữ tiếng Anh như BE — FE tự dịch theo `errorCode`.
 */

import { registerMockRoute } from "./mock-adapter";
import { cartonsVoided } from "./mock-receipt-cartons";
import {
  MOCK_WAREHOUSE_OPTION,
  getReceiptStore,
  invalidReceiptTransition,
  loadReceipt,
  receiptNotFound,
  saveReceipt,
  toReceiptView,
} from "./mock-routes-goods-receipts-store";
import { registerStockPackageMockRoutes } from "./mock-routes-stock-packages";
import {
  BE_DEFAULT_PAGE_SIZE,
  BE_MAX_PAGE_SIZE,
  beError,
  beOk,
  bePage,
  readInt,
  readParams,
  readString,
} from "./mock-routes-purchase-orders-store";

import type { MockReceipt } from "./mock-routes-goods-receipts-store";

const PATH = "/goods-receipts";
const SORTABLE: Record<string, (r: MockReceipt) => string> = {
  receivedAt: (r) => r.receivedAt,
  receiptNumber: (r) => r.number,
  status: (r) => r.status,
};

/** `GoodsReceiptRowResponse`: một dòng danh sách, không kèm dòng nhận. */
function toRow(receipt: MockReceipt) {
  const { lines: _lines, note: _note, warnings: _warnings, ...row } = toReceiptView(receipt);
  return row;
}

export function registerGoodsReceiptMockRoutes(): void {
  registerMockRoute("GET", PATH, async (config) => {
    const params = readParams(config);
    const page = readInt(params.page, 0);
    const size = readInt(params.size, BE_DEFAULT_PAGE_SIZE);
    if (size > BE_MAX_PAGE_SIZE)
      return beError(
        400,
        "VALIDATION_FAILED",
        `Page size must not exceed ${BE_MAX_PAGE_SIZE}, got ${size}`,
      );
    const statuses = ([] as unknown[])
      .concat(params.status ?? [])
      .map(readString)
      .filter(Boolean);
    const search = readString(params.search).toLowerCase();
    const from = readString(params.receivedFrom);
    const to = readString(params.receivedTo);
    const receiptType = readString(params.receiptType);
    const [sortField = "receivedAt", sortDir = "desc"] = readString(params.sort).split(",");
    const key = SORTABLE[sortField] ?? SORTABLE.receivedAt;

    const rows = [...(await getReceiptStore()).values()]
      .filter((r) => !statuses.length || statuses.includes(r.status))
      .filter(
        (r) => !readString(params.warehouseId) || r.warehouseId === readString(params.warehouseId),
      )
      // Phiếu seed đều là phiếu mua hàng cũ: lọc PRODUCTION / theo Đơn sản xuất không ra dòng nào
      .filter((r) => !receiptType || receiptType === toReceiptView(r).receiptType)
      .filter(() => !readString(params.productionOrderId))
      .filter((r) => !search || r.number.toLowerCase().includes(search))
      // BE receivedBetween: from ≤ receivedAt < to
      .filter(
        (r) =>
          (!from || r.receivedAt >= new Date(from).toISOString()) &&
          (!to || r.receivedAt < new Date(to).toISOString()),
      )
      .sort((a, b) => (sortDir === "asc" ? 1 : -1) * key(a).localeCompare(key(b)))
      .map(toRow);
    return beOk(bePage(rows, page, size));
  });

  registerMockRoute("GET", `${PATH}/:id`, async (config) => {
    const { id, receipt } = await loadReceipt(config);
    return receipt ? beOk(toReceiptView(receipt)) : receiptNotFound(id);
  });

  registerMockRoute("GET", "/warehouses", async () =>
    beOk(bePage([MOCK_WAREHOUSE_OPTION], 0, BE_DEFAULT_PAGE_SIZE)),
  );

  // BE 4A-9: phiếu mua hàng cũ không xác nhận được nữa — chỉ còn huỷ
  registerMockRoute("POST", `${PATH}/:id/confirmation`, async (config) => {
    const { id, receipt } = await loadReceipt(config);
    if (!receipt) return receiptNotFound(id);
    return invalidReceiptTransition(
      `Receipt ${receipt.number} is a purchase receipt: it is only read and cancelled`,
    );
  });

  registerMockRoute("POST", `${PATH}/:id/cancellation`, async (config) => {
    const { id, receipt } = await loadReceipt(config);
    if (!receipt) return receiptNotFound(id);
    // BE `GoodsReceipt#cancel`: chỉ phiếu chưa ghi nhận gì (DRAFT)
    if (receipt.status !== "DRAFT")
      return invalidReceiptTransition(
        `Cannot cancel receipt ${receipt.number}: it is ${receipt.status}, not DRAFT`,
      );
    return saveReceipt({
      ...receipt,
      lines: receipt.lines.map(cartonsVoided),
      status: "CANCELLED",
    });
  });

  registerStockPackageMockRoutes();
}
