"use client";

import Link from "next/link";
import { cn } from "cn";
import { Eye } from "lucide-react";

import { formatDate, formatDateTime } from "@/lib/format/date";

import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { StatusDomain } from "@/lib/mock-data";

/* -------------------------------------------------------------------------- */
/*  Chuẩn ô bảng Mode A — mọi bảng danh sách dùng chung, không tự đặt cỡ chữ  */
/* -------------------------------------------------------------------------- */

const MONO = "font-[family-name:var(--font-mono)]";

/**
 * Class chuẩn từng loại ô (tất cả 13px). Ô viết tay ở feature (link, ô ghép…) dùng lại các class
 * này thay vì tự đặt cỡ / màu — nguồn duy nhất để các bảng không lệch nhau.
 */
export const CELL = {
  /** Mã chứng từ chính: mono 500 accent. */
  code: `text-accent ${MONO} text-[0.8125rem] font-medium`,
  /** Tên / đối tượng chính: 500 ink-primary. */
  name: "text-ink-primary text-[0.8125rem] font-medium",
  /** Chữ phụ (danh mục, loại, kho…): 400 ink-secondary. */
  text: "text-ink-secondary text-[0.8125rem]",
  /** Mã tham chiếu phụ (PO, đơn hàng, mã vạch…): mono 400 ink-secondary. */
  ref: `text-ink-secondary ${MONO} text-[0.8125rem]`,
  /** Ngày / giờ: 400 ink-secondary, tabular. */
  date: "text-ink-secondary text-[0.8125rem] tabular-nums whitespace-nowrap",
  /** Số / tiền: mono 500 ink-primary, tabular (cột căn phải qua `align`). */
  number: `text-ink-primary ${MONO} text-[0.8125rem] font-medium tabular-nums`,
  /** Dòng phụ của ô hai dòng (SĐT, email, loại xe…): 12px ink-tertiary. */
  sub: "text-ink-tertiary text-xs",
  /** Ô trống "—". */
  empty: "text-ink-tertiary text-[0.8125rem]",
  /** Nút hành động cuối dòng (28px) — chiều cao chuẩn của dòng. */
  action:
    "border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary flex size-7 items-center justify-center rounded-[var(--r-sm)] border transition-colors",
} as const;

export const EMPTY_CELL = "—";

type SortOpts<T> = { sortable?: boolean; compare?: (a: T, b: T) => number };

/** Ô trống thống nhất. */
export function EmptyCell() {
  return <span className={CELL.empty}>{EMPTY_CELL}</span>;
}

/** Cột mã chứng từ chính: mono, accent, tuỳ chọn click. */
export function codeCell<T>(
  key: string,
  header: string,
  getValue: (row: T) => string,
  opts?: SortOpts<T> & { onClick?: (row: T) => void },
): ColumnDef<T> {
  return {
    key,
    header,
    sortable: opts?.sortable,
    compare: opts?.compare,
    cell: (row) => {
      const value = getValue(row);
      const onClick = opts?.onClick;
      if (onClick) {
        return (
          <Button
            type="button"
            variant="link"
            onClick={() => onClick(row)}
            className={`${CELL.code} h-auto p-0 hover:underline`}
          >
            {value}
          </Button>
        );
      }
      return <span className={CELL.code}>{value}</span>;
    },
  };
}

/** Cột tên / đối tượng chính. */
export function nameCell<T>(
  key: string,
  header: string,
  getValue: (row: T) => string | null | undefined,
  opts?: SortOpts<T>,
): ColumnDef<T> {
  return {
    key,
    header,
    ...opts,
    cell: (row) => {
      const value = getValue(row);
      return value ? <span className={CELL.name}>{value}</span> : <EmptyCell />;
    },
  };
}

/** Cột text phụ. `color` giữ cho tương thích; mặc định ink-secondary. */
export function textCell<T>(
  key: string,
  header: string,
  getValue: (row: T) => string,
  opts?: SortOpts<T> & {
    color?: "primary" | "secondary" | "tertiary";
    lineClamp?: boolean;
  },
): ColumnDef<T> {
  const colorClass =
    opts?.color === "primary"
      ? "text-ink-primary font-medium"
      : opts?.color === "tertiary"
        ? "text-ink-tertiary"
        : "text-ink-secondary";
  return {
    key,
    header,
    sortable: opts?.sortable,
    compare: opts?.compare,
    cell: (row) => {
      const value = getValue(row);
      if (!value || value === EMPTY_CELL) return <EmptyCell />;
      return (
        <span className={cn("text-[0.8125rem]", colorClass, opts?.lineClamp && "line-clamp-1")}>
          {value}
        </span>
      );
    },
  };
}

/** Cột mã tham chiếu phụ (PO, đơn hàng, SKU phụ, mã vạch…): mono, ink-secondary. */
export function refCell<T>(
  key: string,
  header: string,
  getValue: (row: T) => string | null | undefined,
  opts?: SortOpts<T>,
): ColumnDef<T> {
  return {
    key,
    header,
    ...opts,
    cell: (row) => {
      const value = getValue(row);
      return value ? <span className={CELL.ref}>{value}</span> : <EmptyCell />;
    },
  };
}

/** @deprecated giữ tên cũ — cùng style với `refCell`. */
export const subCodeCell = refCell;

/** Cột hai dòng: dòng chính + dòng phụ nhỏ (tên + SĐT, xe + loại xe…). */
export function stackCell<T>(
  key: string,
  header: string,
  getMain: (row: T) => ReactNode,
  getSub: (row: T) => ReactNode,
  opts?: SortOpts<T> & { mono?: boolean },
): ColumnDef<T> {
  return {
    key,
    header,
    sortable: opts?.sortable,
    compare: opts?.compare,
    cell: (row) => <StackText main={getMain(row)} sub={getSub(row)} mono={opts?.mono} />,
  };
}

/** Nội dung ô hai dòng — dùng trực tiếp khi ô cần render tuỳ biến. */
export function StackText({
  main,
  sub,
  mono,
}: {
  main: ReactNode;
  sub?: ReactNode;
  mono?: boolean;
}) {
  if (!main && !sub) return <EmptyCell />;
  // Dòng chính trống nhưng có dòng phụ (NCC không có người liên hệ nhưng có email, xe chưa gán biển
  // số…) → vẫn hiện dòng phụ, dòng chính là "—"
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {main ? (
        <span
          className={mono ? `text-ink-primary ${MONO} text-[0.8125rem] font-medium` : CELL.name}
        >
          {main}
        </span>
      ) : (
        <EmptyCell />
      )}
      {sub ? <span className={CELL.sub}>{sub}</span> : null}
    </div>
  );
}

/** Cột ngày (hoặc ngày giờ) — qua lib/format, timezone Asia/Ho_Chi_Minh. */
export function dateCell<T>(
  key: string,
  header: string,
  getValue: (row: T) => string | null | undefined,
  opts?: SortOpts<T> & { withTime?: boolean },
): ColumnDef<T> {
  return {
    key,
    header,
    sortable: opts?.sortable,
    compare: opts?.compare,
    cell: (row) => {
      const value = getValue(row);
      if (!value) return <EmptyCell />;
      return (
        <span className={CELL.date}>
          {opts?.withTime ? formatDateTime(value) : formatDate(value)}
        </span>
      );
    },
  };
}

/** Cột tiền: mono, tabular-nums, căn phải. */
export function moneyCell<T>(
  key: string,
  header: string,
  getValue: (row: T) => number,
  formatFn: (n: number) => string,
  opts?: SortOpts<T>,
): ColumnDef<T> {
  return {
    key,
    header,
    align: "right",
    sortable: opts?.sortable,
    compare: opts?.compare,
    cell: (row) => <span className={CELL.number}>{formatFn(getValue(row))}</span>,
  };
}

/** Cột số lượng: mono, tabular-nums, căn phải. */
export function numberCell<T>(
  key: string,
  header: string,
  getValue: (row: T) => number,
  opts?: SortOpts<T>,
): ColumnDef<T> {
  return {
    key,
    header,
    align: "right",
    sortable: opts?.sortable,
    compare: opts?.compare,
    cell: (row) => <span className={CELL.number}>{getValue(row).toLocaleString("vi-VN")}</span>,
  };
}

/** Cột StatusDot — domain cố định hoặc lấy từ row. */
export function statusCell<T>(
  key: string,
  header: string,
  getStatus: (row: T) => string,
  domain: StatusDomain | ((row: T) => StatusDomain),
  opts?: SortOpts<T> & { withIcon?: boolean },
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

/** Dot + nhãn cho cờ không nằm trong status-map (đã/chưa cấu hình…) — cùng dáng StatusDot. */
export function ToneDot({
  tone,
  label,
}: {
  tone: "positive" | "warning" | "danger" | "info" | "neutral" | "muted";
  label: string;
}) {
  const dot = {
    positive: "bg-dot-positive",
    warning: "bg-dot-warning",
    danger: "bg-dot-danger",
    info: "bg-dot-info",
    neutral: "bg-neutral",
    muted: "bg-muted-tone",
  }[tone];
  return (
    <span className="text-ink-primary inline-flex items-center gap-2 text-[0.8125rem] leading-[1.4] font-medium whitespace-nowrap">
      <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/** Nút xem cuối dòng (icon Eye 28px). `href` → link sang trang chi tiết; không thì gọi `onOpen`. */
export function ViewAction({
  label,
  href,
  onOpen,
}: {
  label: string;
  href?: string;
  onOpen?: () => void;
}) {
  if (href) {
    return (
      <Link
        href={href}
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={CELL.action}
      >
        <Eye className="size-3.5" />
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
      className={CELL.action}
    >
      <Eye className="size-3.5" />
    </button>
  );
}

/** Cột hành động chuẩn: cuối bảng, header rỗng, không nằm trong ẩn / hiện cột. */
export function viewColumn<T>(
  getAction: (row: T) => { label: string; href?: string; onOpen?: () => void },
  key = "actions",
): ColumnDef<T> {
  return { key, header: "", cell: (row) => <ViewAction {...getAction(row)} /> };
}
