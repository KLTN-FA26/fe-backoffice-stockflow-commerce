import { NUM } from "../primitives";

import type { ReceivablePoLine } from "@/features/receipt/types";

/** Dòng PO còn mở sẽ nạp làm dòng kiểm đếm dự kiến (docs 03 bước 1). */
export function PoLinesPreview({ lines }: { lines: readonly ReceivablePoLine[] }) {
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">Dòng đơn đặt hàng và số lượng còn mở</caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              SKU
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Mô tả
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              SL đặt
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Đã nhận
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Còn mở
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.lineId} className="border-border-default border-t">
              <td className="px-3 py-2 font-[family-name:var(--font-mono)]">{line.sku}</td>
              <td className="text-ink-secondary px-3 py-2">{line.description ?? "—"}</td>
              <td className={`px-3 py-2 ${NUM}`}>{line.quantityOrdered}</td>
              <td className={`px-3 py-2 ${NUM}`}>{line.quantityReceived}</td>
              <td className={`text-ink-primary px-3 py-2 font-semibold ${NUM}`}>
                {line.openQuantity}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
