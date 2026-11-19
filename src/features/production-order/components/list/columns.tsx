"use client";

import { PRODUCTION_LABELS, PRODUCTION_ORDER_COLUMNS as C } from "@/constants";
import { formatNumber } from "@/lib/format";

import {
  productionOrderTotals,
  receivingWarehouseCode,
} from "@/features/production-order/selectors";

import { CELL, codeCell, dateCell, textCell, ToneDot } from "@/components/shared/column-helpers";

import { producerLabel, ProductionStatusDot, shortId } from "../parts";

import type { ProducerRef } from "@/lib/references/producer-options";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { ProductionOrder } from "@/features/production-order/types";

const L = PRODUCTION_LABELS.order;

/** Cột danh sách Đơn sản xuất: mã, đơn vị, kho nhận, ngày cần hàng, ngày dự kiến, thùng đã nhập, cờ mẫu, trạng thái. */
export function buildProductionOrderColumns(
  producerOf: (id: string) => ProducerRef | undefined,
): ColumnDef<ProductionOrder>[] {
  const col = L.column;
  return [
    codeCell<ProductionOrder>(C.CODE, col.code, (row) => row.code),
    textCell<ProductionOrder>(
      C.PRODUCER,
      col.producer,
      (row) => producerLabel(producerOf(row.producerId), row.producerId),
      { color: "primary" },
    ),
    {
      key: C.WAREHOUSE,
      header: col.warehouse,
      cell: (row) => (
        <span className={CELL.ref}>
          {receivingWarehouseCode(row) ?? shortId(row.receivingWarehouseId)}
        </span>
      ),
    },
    dateCell<ProductionOrder>(C.NEED_BY, col.needBy, (row) => row.needByDate),
    dateCell<ProductionOrder>(C.EXPECTED, col.expected, (row) => row.expectedCompletionDate),
    {
      key: C.CARTONS,
      header: col.cartons,
      align: "right",
      cell: (row) => {
        const totals = productionOrderTotals(row);
        return (
          <span className={CELL.number}>
            {formatNumber(totals.receivedCartons)} / {formatNumber(totals.cartons)}
          </span>
        );
      },
    },
    {
      key: C.SAMPLE,
      header: col.sample,
      cell: (row) =>
        row.sampleApprovalRequired ? (
          <ToneDot tone="info" label={L.sampleRequired} />
        ) : (
          <span className={CELL.text}>{L.sampleNotRequired}</span>
        ),
    },
    {
      key: C.STATUS,
      header: col.status,
      cell: (row) => <ProductionStatusDot status={row.status} />,
    },
  ];
}
