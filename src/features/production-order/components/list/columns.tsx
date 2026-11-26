"use client";

import { PRODUCTION_LABELS, PRODUCTION_ORDER_COLUMNS as C } from "@/constants";
import { formatNumber } from "@/lib/format";

import {
  productionOrderTotals,
  receivingWarehouseCode,
  receivingWarehouseName,
} from "@/features/production-order/selectors";

import {
  CELL,
  codeCell,
  dateCell,
  EmptyCell,
  StackText,
  textCell,
  ToneDot,
} from "@/components/shared/column-helpers";

import { producerLabel, ProductionStatusDot } from "../parts";

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
      (row) => producerLabel(producerOf(row.producerId), row.producerName),
      { color: "primary" },
    ),
    {
      key: C.WAREHOUSE,
      header: col.warehouse,
      // Tên kho (BE kèm sẵn, FE#286), mã nhỏ ở dòng dưới — không còn mã trần "BDG" / "HNI"
      cell: (row) => {
        const name = receivingWarehouseName(row);
        if (!name) return <EmptyCell />;
        const code = receivingWarehouseCode(row);
        return <StackText main={name} sub={code && code !== name ? code : undefined} />;
      },
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
      // Ghim phải + không xuống dòng: bảng rộng hơn màn hình vẫn thấy đủ nhãn trạng thái ("Đang sản xuất"), không bị cắt
      sticky: "right",
      className: "whitespace-nowrap",
      cell: (row) => <ProductionStatusDot status={row.status} />,
    },
  ];
}
