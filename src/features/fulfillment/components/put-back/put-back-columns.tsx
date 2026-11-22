"use client";

import Link from "next/link";
import { Undo2 } from "lucide-react";

import { ADMIN_ROUTES, PICK_LINE_LABELS, PUT_BACK_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { CELL, numberCell } from "@/components/shared/column-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { PutBackRow } from "@/features/fulfillment/types";
import type { ColumnDef } from "@/components/shared/DataTable";

const P = PUT_BACK_LABELS;
const COL = P.column;

/**
 * Cột hàng đợi trả về kệ (data-table-mode-a: mã mono, số căn phải tabular, ngày giờ theo lib/format); mỗi dòng một
 * thùng — cột LPN là mã phải quét để cất lại, thùng hư hỏng loại ở trạm kiểm có nhãn "Cách ly"; số đơn
 * dẫn tới chi tiết lấy hàng khi người xem mở được task người khác (`canOpenTask`, không thì BE 404), không thì
 * chỉ là chữ; nút trả chỉ khi có `fulfillment-picking:UPDATE`.
 */
export function putBackColumns({
  canAct,
  canOpenTask,
  onPutBack,
}: {
  canAct: boolean;
  canOpenTask: boolean;
  onPutBack: (row: PutBackRow) => void;
}): ColumnDef<PutBackRow>[] {
  const base: ColumnDef<PutBackRow>[] = [
    {
      key: "order",
      header: COL.order,
      cell: (row) =>
        canOpenTask ? (
          <Link
            href={ADMIN_ROUTES.picking.detail(row.taskId)}
            className={`${CELL.code} hover:underline`}
          >
            {row.orderNumber}
          </Link>
        ) : (
          <span className={CELL.code}>{row.orderNumber}</span>
        ),
    },
    {
      key: "lpn",
      header: COL.lpn,
      cell: (row) => (
        <span className="flex flex-col items-start gap-0.5">
          <span className={CELL.code}>{row.lpn ?? "—"}</span>
          {row.quarantine && (
            <Badge variant="outline" className="text-[0.6875rem]">
              {P.quarantineBadge}
            </Badge>
          )}
        </span>
      ),
    },
    // Ô hai dòng (SKU, dưới là lô) thay cho hai cột riêng: 8 cột không vừa khung ở 1280 px (cột Thao tác bị đẩy ra ngoài)
    {
      key: "sku",
      header: COL.skuLot,
      cell: (row) => (
        <span className="flex flex-col">
          <span className={CELL.ref}>{row.sku}</span>
          {row.lotNumber && <span className={CELL.sub}>{PICK_LINE_LABELS.lot(row.lotNumber)}</span>}
        </span>
      ),
    },
    numberCell<PutBackRow>("pickedQty", COL.pickedQty, (row) => row.pickedQty),
    {
      key: "fromLocation",
      header: COL.fromLocationAt,
      cell: (row) => (
        <span className="flex flex-col">
          <span className={CELL.ref}>{row.fromLocationCode}</span>
          <span className={`${CELL.sub} tabular-nums`}>
            {row.pickedAt ? formatDateTime(row.pickedAt) : "—"}
          </span>
        </span>
      ),
    },
  ];
  if (!canAct) return base;
  return [
    ...base,
    {
      key: "actions",
      header: COL.actions,
      align: "right",
      cell: (row) => (
        <Button
          type="button"
          variant="outline"
          size="xs"
          aria-label={P.actionFor(row.sku, row.orderNumber)}
          onClick={(event) => {
            event.stopPropagation();
            onPutBack(row);
          }}
          className="border-border-default rounded-[var(--r-sm)]"
        >
          <Undo2 className="text-dot-info size-3" /> {P.action}
        </Button>
      ),
    },
  ];
}
