/** Selector thuần của Đơn sản xuất — không side effect, test được không cần React. */

import type { EditInput, ProductionOrder, ProductionOrderEditValues } from "./types";

export interface ProductionOrderTotals {
  cartons: number;
  receivedCartons: number;
  totalUnits: number;
}

/** Σ số thùng / đã nhập / tổng cái của các dòng (docs 17 §4.3 bước 11: nhập theo số thùng). */
export function productionOrderTotals(
  order: Pick<ProductionOrder, "lines">,
): ProductionOrderTotals {
  return order.lines.reduce(
    (sum, line) => ({
      cartons: sum.cartons + line.cartons,
      receivedCartons: sum.receivedCartons + line.receivedCartons,
      totalUnits: sum.totalUnits + line.totalUnits,
    }),
    { cartons: 0, receivedCartons: 0, totalUnits: 0 },
  );
}

/** BR-25 (docs 17 §6): có cảnh báo sức chứa kho nhận không — vượt dự kiến hoặc vượt nếu gửi hết đơn nháp. Không chặn. */
export function hasCapacityWarning(order: Pick<ProductionOrder, "capacity">): boolean {
  const capacity = order.capacity;
  return Boolean(capacity && (capacity.exceedsProjected || capacity.exceedsIfAllApproved));
}

/** Mã kho nhận để hiện — bảng sức chứa kèm trong response (Điều phối sản xuất không có quyền đọc danh mục kho). */
export const receivingWarehouseCode = (order: Pick<ProductionOrder, "capacity">): string | null =>
  order.capacity?.board.warehouseCode ?? null;

/** Bản ghi → giá trị form sửa nháp. */
export function editValuesOf(order: ProductionOrder): ProductionOrderEditValues {
  return {
    producerId: order.producerId,
    needByDate: order.needByDate,
    note: order.note ?? "",
    sampleApprovalRequired: order.sampleApprovalRequired,
    sampleRequiredByDefault: order.sampleRequiredByDefault,
    sampleWaiverReason: order.sampleWaiverReason ?? "",
    lines: order.lines.map((line) => ({
      orderLineId: line.orderLineId,
      sku: line.sku,
      cartons: String(line.cartons),
      packingRequirements: line.packingRequirements ?? "",
    })),
  };
}

/**
 * Giá trị form đã kiểm → body `PUT` (BE `EditProductionOrderRequest`). `lines` chỉ gồm dòng đổi số thùng hoặc yêu cầu
 * đóng gói — BE: "only the lines to change". Lý do tắt duyệt mẫu chỉ gửi khi đang tắt.
 */
export function editBodyOf(
  order: ProductionOrder,
  values: ProductionOrderEditValues,
): EditInput["body"] {
  const original = new Map(order.lines.map((line) => [line.orderLineId, line]));
  const lines = values.lines
    .filter((line) => {
      const before = original.get(line.orderLineId);
      return (
        !before ||
        before.cartons !== Number(line.cartons) ||
        (before.packingRequirements ?? "") !== line.packingRequirements
      );
    })
    .map((line) => ({
      orderLineId: line.orderLineId,
      cartons: Number(line.cartons),
      packingRequirements: line.packingRequirements || undefined,
    }));
  return {
    producerId: values.producerId,
    needByDate: values.needByDate,
    note: values.note || undefined,
    sampleApprovalRequired: values.sampleApprovalRequired,
    sampleWaiverReason: values.sampleApprovalRequired
      ? undefined
      : values.sampleWaiverReason || undefined,
    lines,
  };
}

/** Lọc trong trang theo mã Đơn sản xuất hoặc SKU (BE danh sách không có tham số tìm kiếm). */
export function matchesProductionOrder(order: ProductionOrder, query: string): boolean {
  const q = query.trim().toUpperCase();
  if (!q) return true;
  return (
    order.code.toUpperCase().includes(q) ||
    order.lines.some((line) => line.sku.toUpperCase().includes(q))
  );
}

/**
 * BE trả 409 PRODUCTION_ORDER_EXCEEDS_SHORTAGE với message "…lacks N carton(s)…" (brief BE §3.5) — lấy N để báo tại
 * dòng. Không đọc được thì `null` (vẫn báo chung).
 */
export function shortageFromMessage(message: string | undefined): number | null {
  const match = message?.match(/lacks (\d+) carton/);
  return match ? Number(match[1]) : null;
}
