"use client";

import Link from "next/link";
import { Undo2 } from "lucide-react";

import { ADMIN_ROUTES, PUT_BACK_LABELS } from "@/constants";
import { CELL, dateCell, numberCell, refCell, textCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";

import type { PutBackRow } from "@/features/fulfillment/types";
import type { ColumnDef } from "@/components/shared/DataTable";

const P = PUT_BACK_LABELS;
const COL = P.column;

/**
 * Cột hàng đợi trả về kệ (data-table-mode-a: mã mono, số căn phải tabular, ngày giờ theo lib/format); số đơn
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
    refCell<PutBackRow>("sku", COL.sku, (row) => row.sku),
    textCell<PutBackRow>("lot", COL.lot, (row) => row.lotNumber ?? ""),
    numberCell<PutBackRow>("pickedQty", COL.pickedQty, (row) => row.pickedQty),
    refCell<PutBackRow>("fromLocation", COL.fromLocation, (row) => row.fromLocationCode),
    dateCell<PutBackRow>("pickedAt", COL.pickedAt, (row) => row.pickedAt, { withTime: true }),
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
