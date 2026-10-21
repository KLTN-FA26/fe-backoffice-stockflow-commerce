"use client";

import { MinusCircle } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import { MONO } from "../primitives";

import type { PackContent } from "@/features/fulfillment/packing-types";

const P = UI_LABELS.packing;
const TH = "text-ink-secondary px-2 py-1.5 text-xs font-medium";
const TD = "px-2 py-1.5 text-[0.8125rem]";

/** Nội dung một kiện: SKU, lô, serial, số lượng; kiện đang mở có nút bớt hàng. */
export function PackageContents({
  contents,
  onRemove,
}: {
  contents: readonly PackContent[];
  /** Có = kiện đang mở và người dùng được thao tác. */
  onRemove?: (content: PackContent) => void;
}) {
  if (contents.length === 0) {
    return <p className="text-ink-tertiary text-[0.8125rem]">{P.packages.noContents}</p>;
  }
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full">
        <thead className="bg-bg-subtle border-border-default border-b">
          <tr>
            <th scope="col" className={`${TH} text-left`}>
              {P.packages.colSku}
            </th>
            <th scope="col" className={`${TH} text-left`}>
              {P.packages.colLot}
            </th>
            <th scope="col" className={`${TH} text-left`}>
              {P.packages.colSerial}
            </th>
            <th scope="col" className={`${TH} text-right`}>
              {P.packages.colQty}
            </th>
            {onRemove && <th scope="col" className={TH} />}
          </tr>
        </thead>
        <tbody>
          {contents.map((content) => (
            <tr
              key={`${content.orderLineId}|${content.lotNumber ?? ""}|${content.serialNumber ?? ""}`}
              className="border-border-default border-b last:border-b-0"
            >
              <td className={`${TD} text-ink-primary ${MONO}`}>{content.sku}</td>
              <td className={`${TD} text-ink-secondary ${MONO}`}>{content.lotNumber ?? "—"}</td>
              <td className={`${TD} text-ink-secondary ${MONO}`}>{content.serialNumber ?? "—"}</td>
              <td className={`${TD} text-right ${MONO}`}>{content.quantity}</td>
              {onRemove && (
                <td className={`${TD} text-right`}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onRemove(content)}
                    aria-label={`${P.action.removeUnits} ${content.sku}`}
                    className="text-ink-tertiary hover:text-danger"
                  >
                    <MinusCircle className="size-3.5" /> {P.action.removeUnits}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
