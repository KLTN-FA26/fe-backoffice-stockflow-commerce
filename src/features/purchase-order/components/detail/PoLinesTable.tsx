"use client";

import { cn } from "cn";

import { PAGE_SIZE, UI_LABELS } from "@/constants";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";

import { PAGE_SIZE_OPTIONS } from "../list/config";
import { formatMoney, openQuantity } from "@/features/purchase-order";

import type { PoLine } from "@/features/purchase-order";

export function PoLinesTable({ lines }: { lines: PoLine[] }) {
  const cols: ColumnDef<PoLine>[] = [
    {
      key: "skuId",
      header: UI_LABELS.purchaseOrder.sku,
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
      header: "Mô tả",
      cell: (r) => (
        <span className="text-ink-primary text-[0.8125rem]">{r.description ?? "—"}</span>
      ),
    },
    {
      key: "orderedQty",
      header: UI_LABELS.purchaseOrder.orderedQty,
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
      header: UI_LABELS.purchaseOrder.unitPrice,
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
      header: UI_LABELS.purchaseOrder.openQty,
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
      // Cùng định dạng range với 2 bảng lịch sử gửi (phân trang server) trong PO detail.
      // DataTable chỉ dùng caption khi vừa 1 trang, nên range luôn là 1–n / n.
      caption={
        lines.length === 0 ? "Hiển thị 0 / 0" : `Hiển thị 1–${lines.length} / ${lines.length}`
      }
      pageSize={PAGE_SIZE.md}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
    />
  );
}
