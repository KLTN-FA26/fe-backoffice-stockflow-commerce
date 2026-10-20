/**
 * Purchase Order — API sửa PO nháp (BE SCRUM-462 `PUT /purchase-orders/{id}`). Tách khỏi `api.ts`
 * để mỗi file feature ≤ 200 dòng; public API qua `index.ts` / `mutations.ts`.
 */

import { api } from "@/lib/api/client";

import { mapBePoToFe } from "./mappers";
import { bePurchaseOrderSchema } from "./schemas";

import type { CreatePoResult } from "./api";
import type { UpdatePoInput } from "./schemas";

const PO_PATH = "/purchase-orders";

/**
 * Sửa PO nháp (BE SCRUM-462): gửi cả nháp kèm `version` đã đọc; dòng không gửi bị xoá.
 * 409 `OPTIMISTIC_LOCK` khi nháp đã đổi, 409 `PURCHASE_ORDER_NOT_EDITABLE` khi đã rời DRAFT.
 */
export async function updatePurchaseOrder(args: {
  id: string;
  body: UpdatePoInput;
}): Promise<CreatePoResult> {
  const { data } = await api.put<unknown>(`${PO_PATH}/${args.id}`, {
    ...args.body,
    note: args.body.note || undefined,
    lines: args.body.lines.map((line) => ({
      ...line,
      description: line.description || undefined,
      taxRate: line.taxRate ?? undefined,
    })),
  });
  // BR-PO-003: BE tính lại cờ trùng sau khi sửa (cùng NCC + ngày giao + SKU với đơn mở khác).
  const be = bePurchaseOrderSchema.parse(data);
  return { ...mapBePoToFe(be), possibleDuplicate: be.possibleDuplicate };
}
