import type {
  CreatePoInput,
  PoCreateFormLine,
  PoCreateFormValues,
  UpdatePoInput,
} from "@/features/purchase-order";

/** Dòng form → dòng gửi BE; dùng chung cho tạo và sửa nháp. */
function toLineInput(l: PoCreateFormLine) {
  return {
    sku: l.skuId,
    description: l.description.trim(),
    quantityOrdered: Number(l.orderedQty),
    // BE #118: bỏ trống ⇒ BE lấy giá danh mục; có giá ⇒ gửi đúng giá đang hiện.
    unitPrice: l.unitPrice.trim() === "" ? undefined : Number(l.unitPrice),
    taxRate: l.taxRate.trim() === "" ? undefined : Number(l.taxRate),
  };
}

/**
 * Payload tạo PO trước khi `createPoSchema` parse: `currency` còn là chuỗi của form — schema mới chặn
 * mã ngoài `PO_INPUT_CURRENCIES` (chốt chặn cuối, useCreateForm).
 */
export type CreatePoDraft = Omit<CreatePoInput, "currency"> & { currency: string };

export function toCreateInput(v: PoCreateFormValues): CreatePoDraft {
  return {
    supplierId: v.supplierId,
    warehouseId: v.warehouseId,
    currency: v.currency,
    expectedAt: v.expectedDate || null,
    note: v.note.trim() || undefined,
    lines: v.lines.map(toLineInput),
  };
}

/**
 * Body `PUT /purchase-orders/{id}` (BE SCRUM-462). Không gửi NCC / tiền tệ (BR-07, docs 02 §6).
 * Dòng đã lưu (`lineId` ≠ "") gửi kèm `lineId`. Hàm này chỉ ánh xạ: bảo đảm dòng đã lưu có
 * `unitPrice` nằm ở `updatePoSchema` (refine, issue #30 §2) — gọi `safeParse` trước khi gửi.
 * Dòng mới để trống giá thì BE lấy giá danh mục.
 */
export function toUpdateInput(v: PoCreateFormValues, version: number): UpdatePoInput {
  return {
    version,
    warehouseId: v.warehouseId,
    expectedAt: v.expectedDate,
    note: v.note.trim() || undefined,
    lines: v.lines.map((l) => {
      const line = toLineInput(l);
      return l.lineId === "" ? line : { ...line, lineId: l.lineId };
    }),
  };
}
