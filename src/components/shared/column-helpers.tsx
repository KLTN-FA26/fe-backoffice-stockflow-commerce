"use client";

import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";
import type { StatusDomain } from "@/lib/mock-data";
import type { ColumnDef } from "@/components/shared/DataTable";

/* -------------------------------------------------------------------------- */
/*  Shared cell renderers — đảm bảo đồng bộ style giữa mọi table            */
/* -------------------------------------------------------------------------- */

/** Cột mã chứng từ: mono, accent color, optional link */
export function codeCell<T>(
  key: string,
  header: string,
  getValue: (row: T) => string,
  opts?: { sortable?: boolean; compare?: (a: T, b: T) => number; onClick?: (row: T) => void },
): ColumnDef<T> {
  return {
    key,
    header,
    sortable: opts?.sortable,
    compare: opts?.compare,
    cell: (row) => {
      const value = getValue(row);
      if (opts?.onClick) {
        return (
          <Button
            type="button"
            variant="link"
            onClick={() => opts.onClick!(row)}
            className="text-accent h-auto p-0 font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
          >
            {value}
          </Button>
        );
      }
      return (
        <span className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium">
          {value}
        </span>
      );
    },
  };
}

/** Cột text thường */
export function textCell<T>(
  key: string,
  header: string,
  getValue: (row: T) => string,
  opts?: {
    sortable?: boolean;
    compare?: (a: T, b: T) => number;
    color?: "primary" | "secondary" | "tertiary";
    lineClamp?: boolean;
  },
): ColumnDef<T> {
  const colorClass =
    opts?.color === "primary"
      ? "text-ink-primary"
      : opts?.color === "tertiary"
        ? "text-ink-tertiary"
        : "text-ink-secondary";
  return {
    key,
    header,
    sortable: opts?.sortable,
    compare: opts?.compare,
    cell: (row) => (
      <span className={`text-[0.8125rem] ${colorClass}${opts?.lineClamp ? "line-clamp-1" : ""}`}>
        {getValue(row)}
      </span>
    ),
  };
}

/** Cột mã phụ (SKU, sub-code): mono, nhỏ hơn, ink-secondary */
export function subCodeCell<T>(
  key: string,
  header: string,
  getValue: (row: T) => string,
  opts?: { sortable?: boolean; compare?: (a: T, b: T) => number },
): ColumnDef<T> {
  return {
    key,
    header,
    sortable: opts?.sortable,
    compare: opts?.compare,
    cell: (row) => (
      <span className="text-ink-secondary font-[family-name:var(--font-mono)] text-xs">
        {getValue(row)}
      </span>
    ),
  };
}

/** Cột ngày: tabular-nums, ink-secondary */
export function dateCell<T>(
  key: string,
  header: string,
  getValue: (row: T) => string,
  opts?: { sortable?: boolean; compare?: (a: T, b: T) => number },
): ColumnDef<T> {
  return {
    key,
    header,
    sortable: opts?.sortable,
    compare: opts?.compare,
    cell: (row) => (
      <span className="text-ink-tertiary text-[0.8125rem] tabular-nums">
        {new Date(getValue(row)).toLocaleDateString("vi-VN")}
      </span>
    ),
  };
}

/** Cột tiền: mono, tabular-nums, căn phải */
export function moneyCell<T>(
  key: string,
  header: string,
  getValue: (row: T) => number,
  formatFn: (n: number) => string,
  opts?: { sortable?: boolean; compare?: (a: T, b: T) => number },
): ColumnDef<T> {
  return {
    key,
    header,
    align: "right",
    sortable: opts?.sortable,
    compare: opts?.compare,
    cell: (row) => (
      <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium tabular-nums">
        {formatFn(getValue(row))}
      </span>
    ),
  };
}

/** Cột số lượng: mono, tabular-nums, căn phải */
export function numberCell<T>(
  key: string,
  header: string,
  getValue: (row: T) => number,
  opts?: { sortable?: boolean; compare?: (a: T, b: T) => number },
): ColumnDef<T> {
  return {
    key,
    header,
    align: "right",
    sortable: opts?.sortable,
    compare: opts?.compare,
    cell: (row) => (
      <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
        {getValue(row).toLocaleString("vi-VN")}
      </span>
    ),
  };
}

/** Cột StatusDot — domain cố định hoặc lấy từ row */
export function statusCell<T>(
  key: string,
  header: string,
  getStatus: (row: T) => string,
  domain: StatusDomain | ((row: T) => StatusDomain),
  opts?: { sortable?: boolean; compare?: (a: T, b: T) => number; withIcon?: boolean },
): ColumnDef<T> {
  return {
    key,
    header,
    sortable: opts?.sortable,
    compare: opts?.compare,
    cell: (row) => {
      const d = typeof domain === "function" ? domain(row) : domain;
      return <StatusDot domain={d} status={getStatus(row)} size="sm" withIcon={opts?.withIcon} />;
    },
  };
}
