"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import { ADMIN_ROUTES, LOAD_COLUMNS, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { statusCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";

import { LoadProgress } from "../LoadProgress";
import { MONO } from "../primitives";
import { COLUMN_LABELS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { LoadRow } from "@/features/shipping/types";

const C = LOAD_COLUMNS;
const header = (key: string) => COLUMN_LABELS[key] ?? key;

/** Cột bảng chuyến xe — không có cột mã vận đơn / tracking (hãng là bên thứ ba). */
export function buildLoadColumns(navigateToLoading: (row: LoadRow) => void): ColumnDef<LoadRow>[] {
  return [
    {
      key: C.NUMBER,
      header: header(C.NUMBER),
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.shipments.loading(row.loadId)}
          className={`text-accent text-[0.8125rem] font-medium hover:underline ${MONO}`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.number}
        </Link>
      ),
    },
    {
      key: C.VEHICLE,
      header: header(C.VEHICLE),
      cell: (row) => (
        <span className="text-[0.8125rem]">
          <span className={`text-ink-primary ${MONO}`}>{row.vehiclePlate ?? "—"}</span>
          {row.vehicleType && (
            <span className="text-ink-tertiary block text-xs">{row.vehicleType}</span>
          )}
        </span>
      ),
    },
    {
      key: C.CARRIER,
      header: header(C.CARRIER),
      cell: (row) => (
        <span className="text-ink-secondary text-[0.8125rem]">{row.carrierName ?? "—"}</span>
      ),
    },
    {
      key: C.PROGRESS,
      header: header(C.PROGRESS),
      cell: (row) => <LoadProgress loaded={row.loadedPackages} planned={row.plannedPackages} />,
    },
    statusCell<LoadRow>(C.STATUS, header(C.STATUS), (row) => row.status, "shipment", {
      withIcon: true,
    }),
    {
      key: C.DISPATCHED_AT,
      header: header(C.DISPATCHED_AT),
      cell: (row) => (
        <span className="text-ink-secondary text-[0.8125rem] tabular-nums">
          {row.dispatchedAt ? formatDateTime(row.dispatchedAt) : "—"}
        </span>
      ),
    },
    {
      key: C.ACTIONS,
      header: "",
      cell: (row) => (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={(event) => {
            event.stopPropagation();
            navigateToLoading(row);
          }}
          className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)]"
          aria-label={`${UI_LABELS.shipping.openLoad} ${row.number}`}
        >
          <Eye className="size-3.5" />
        </Button>
      ),
    },
  ];
}
