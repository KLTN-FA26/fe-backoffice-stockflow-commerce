"use client";

import { cn } from "cn";

import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { formatMoney, openQuantity } from "@/features/purchase-order";

import type { PoLine } from "@/features/purchase-order";
import type { Sku } from "@/features/product";

export function PoLinesTable({ lines, skus }: { lines: PoLine[]; skus: readonly Sku[] }) {
  const cols: ColumnDef<PoLine>[] = [
    {
      key: "skuId",
      header: "Mã SKU",
      sortable: true,
      compare: (a, b) => a.skuId.localeCompare(b.skuId),
      cell: (r) => (
        <span className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium">
          {r.skuId}
        </span>
      ),
    },
    {
      key: "skuName",
      header: "Tên SKU",
      cell: (r) => (
        <span className="text-ink-primary text-[0.8125rem]">
          {skus.find((s) => s.skuId === r.skuId)?.variantLabel ?? r.skuId}
        </span>
      ),
    },
    {
      key: "orderedQty",
      header: "SL đặt",
      align: "right",
      sortable: true,
      compare: (a, b) => a.orderedQty - b.orderedQty,
      cell: (r) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {r.orderedQty.toLocaleString("vi-VN")}
        </span>
      ),
    },
    {
      key: "unitPrice",
      header: "Đơn giá",
      align: "right",
      sortable: true,
      compare: (a, b) => a.unitPrice - b.unitPrice,
      cell: (r) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {formatMoney(r.unitPrice, r.currency)}
        </span>
      ),
    },
    {
      key: "receivedQty",
      header: "SL đã nhận",
      align: "right",
      sortable: true,
      compare: (a, b) => a.receivedQty - b.receivedQty,
      cell: (r) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {r.receivedQty.toLocaleString("vi-VN")}
        </span>
      ),
    },
    {
      key: "openQty",
      header: "Open qty",
      align: "right",
      sortable: true,
      compare: (a, b) => openQuantity(a) - openQuantity(b),
      cell: (r) => {
        const o = openQuantity(r);
        return (
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums",
              o > 0 ? "text-warning" : "text-ink-primary",
            )}
          >
            {o.toLocaleString("vi-VN")}
          </span>
        );
      },
    },
    {
      key: "lineTotal",
      header: "Thành tiền",
      align: "right",
      sortable: true,
      compare: (a, b) => a.lineTotal - b.lineTotal,
      cell: (r) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {formatMoney(r.lineTotal, r.currency)}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      data={lines}
      columns={cols}
      rowKey={(r) => r.lineId}
      caption={`${lines.length} dòng hàng`}
      pageSize={50}
    />
  );
}
