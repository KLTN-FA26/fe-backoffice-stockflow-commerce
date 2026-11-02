"use client";

import { UI_LABELS } from "@/constants";
import { Badge } from "@/components/ui/badge";

import { MONO, NUM, Section } from "../primitives";

import type { TaskLine } from "@/features/fulfillment/types";

const { fulfillment } = UI_LABELS;
const TH = "text-ink-secondary px-3 py-2 text-left text-xs font-medium";
const TD = "px-3 py-2 text-[0.8125rem]";

/**
 * Dòng hàng của task — BE trả kèm `GET /fulfillment/tasks/{id}` (`lines`, SCRUM-466), không cần quyền đọc
 * đơn hàng. Chỉ để xem: SKU + SL đặt. BR-06 (docs 07 §6): dòng tuỳ chỉnh không lấy thành phẩm từ kệ.
 */
export function OrderLinesSection({ lines }: { lines: readonly TaskLine[] | undefined }) {
  return (
    <Section
      title="Dòng đơn hàng"
      description="SKU và số lượng theo đơn. Lấy hàng ghi nhận theo từng dòng ở danh sách lấy hàng phía trên."
    >
      {!lines || lines.length === 0 ? (
        <p className="text-ink-secondary text-[0.8125rem]">{fulfillment.noTaskLines}</p>
      ) : (
        <div className="border-border-default overflow-hidden rounded-[var(--r-sm)] border">
          <table className="w-full">
            <caption className="sr-only">Dòng hàng của task</caption>
            <thead className="bg-bg-subtle border-border-default border-b">
              <tr>
                <th scope="col" className={TH}>
                  #
                </th>
                <th scope="col" className={TH}>
                  SKU
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  SL đặt
                </th>
                <th scope="col" className={TH}>
                  Loại dòng
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.lineId} className="border-border-default border-b last:border-b-0">
                  <td className={`${TD} text-ink-tertiary tabular-nums`}>{index + 1}</td>
                  <td className={`${TD} text-ink-primary ${MONO}`}>{line.sku}</td>
                  <td className={`${TD} text-ink-primary ${NUM}`}>{line.quantity}</td>
                  <td className={TD}>
                    {line.printLine ? (
                      <Badge variant="outline" className="rounded-[var(--r-sm)] font-normal">
                        Tuỳ chỉnh · có thiết kế đã khoá
                      </Badge>
                    ) : (
                      <span className="text-ink-secondary">Hàng thường</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
