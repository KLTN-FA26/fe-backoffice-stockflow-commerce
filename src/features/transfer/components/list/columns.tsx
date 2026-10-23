"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  TRANSFER_COLUMNS,
  TRANSFER_DELIVERY_MODE_LABELS,
  UI_LABELS,
} from "@/constants";
import {
  CELL,
  dateCell,
  nameCell,
  statusCell,
  viewColumn,
} from "@/components/shared/column-helpers";

import { COLUMN_LABELS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { TransferOrderRow } from "@/features/transfer/types";

const C = TRANSFER_COLUMNS;

const header = (key: string) => COLUMN_LABELS[key] ?? key;

/**
 * Cột bảng lệnh chuyển — field BE `TransferOrderRowResponse`. Không có cột tracking: hãng / xe
 * nhà là bên ngoài, hệ thống chỉ ghi thời điểm xuất (rescope SCRUM-327).
 */
export function buildTransferColumns(
  navigateToDetail: (row: TransferOrderRow) => void,
  warehouseLabel: (id: string) => string,
): ColumnDef<TransferOrderRow>[] {
  return [
    {
      key: C.NUMBER,
      header: header(C.NUMBER),
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.transfers.detail(row.transferId)}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.number}
        </Link>
      ),
    },
    nameCell<TransferOrderRow>(C.FROM_WAREHOUSE, header(C.FROM_WAREHOUSE), (row) =>
      warehouseLabel(row.fromWarehouseId),
    ),
    nameCell<TransferOrderRow>(C.TO_WAREHOUSE, header(C.TO_WAREHOUSE), (row) =>
      warehouseLabel(row.toWarehouseId),
    ),
    // BE PR #164: nguyên chuyến (FTL) đi qua đóng gói + kế hoạch xe; giao lẻ xuất kho thủ công
    nameCell<TransferOrderRow>(
      C.DELIVERY_MODE,
      header(C.DELIVERY_MODE),
      (row) => TRANSFER_DELIVERY_MODE_LABELS[row.deliveryMode],
    ),
    dateCell<TransferOrderRow>(C.EXPECTED_DATE, header(C.EXPECTED_DATE), (row) => row.expectedDate),
    dateCell<TransferOrderRow>(C.PACKED_AT, header(C.PACKED_AT), (row) => row.packedAt, {
      withTime: true,
    }),
    dateCell<TransferOrderRow>(
      C.DISPATCHED_AT,
      header(C.DISPATCHED_AT),
      (row) => row.dispatchedAt,
      {
        withTime: true,
      },
    ),
    dateCell<TransferOrderRow>(C.CREATED_AT, header(C.CREATED_AT), (row) => row.createdAt, {
      withTime: true,
    }),
    statusCell<TransferOrderRow>(C.STATUS, header(C.STATUS), (row) => row.status, "to", {
      withIcon: true,
    }),
    {
      ...viewColumn<TransferOrderRow>((row) => ({
        label: `${UI_LABELS.transfer.viewDetail} ${row.number}`,
        onOpen: () => navigateToDetail(row),
      })),
      key: C.ACTIONS,
    },
  ];
}
