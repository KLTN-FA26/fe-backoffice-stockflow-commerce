/**
 * Test-only: đặt thùng LPN vào sổ thùng của mock (thùng của phiếu nhận mock, xem `mock-inventory-cartons.ts`).
 * Không dùng ngoài test; production không import file này.
 */

import { getReceiptStore } from "@/lib/api/mock-routes-goods-receipts-store";

import type { MockStockPackageStatus } from "@/lib/api/mock-receipt-cartons";

export interface SeedCarton {
  lpn: string;
  location: string;
  status?: MockStockPackageStatus;
  nominalQty?: number;
}

/**
 * Thêm thùng vào dòng phiếu nhận đầu tiên của mock (bỏ qua phiếu không có dòng). Thùng mang SKU và lô của dòng đó;
 * trả về id từng thùng theo LPN cùng SKU / lô để test so sánh, không gõ tay lại.
 */
export async function seedMockCartons(specs: readonly SeedCarton[]) {
  const line = [...(await getReceiptStore()).values()].flatMap((receipt) => receipt.lines)[0];
  if (!line) throw new Error("The mock receipt store has no line to hold cartons");
  const ids = new Map<string, string>();
  line.lotNumber ??= "PO-LOT-1";
  for (const spec of specs) {
    const id = crypto.randomUUID();
    ids.set(spec.lpn, id);
    const nominalQty = spec.nominalQty ?? 120;
    line.packages = [
      ...(line.packages ?? []),
      {
        id,
        lpn: spec.lpn,
        quantity: nominalQty,
        receivedQty: nominalQty,
        nominalQty,
        status: spec.status ?? "IN_STOCK",
        locationCode: spec.location,
      },
    ];
  }
  return { ids, sku: line.sku ?? "", lot: line.lotNumber };
}
