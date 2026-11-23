"use client";

import { useCallback, useMemo } from "react";

import { usePageConfig } from "@/hooks/use-page-config";

/** Cùng dạng `ListOption` / `ListSummaryItem` của `ListToolbar` — hook không import tầng components. */
interface ColumnOption<C extends string> {
  label: string;
  value: C;
}
interface ColumnSummaryItem {
  label: string;
  value: string;
  active: boolean;
  onClear: () => void;
}

interface ColumnConfig<C extends string> {
  visibleColumns: C[];
}

export interface ColumnVisibilityOptions<C extends string> {
  /** Cột hiện mặc định (thiếu → mọi cột). Cột ẩn mặc định vẫn bật lại được qua `Columns3`. */
  defaults?: readonly C[];
  /** Cột mã / link chi tiết và cột thao tác: luôn hiện, toggle bỏ qua (data-table-mode-a §4.2). */
  locked?: readonly C[];
}

/**
 * Ẩn / hiện cột của một bảng danh sách (data-table-mode-a §4.2) — sở thích cá nhân nên lưu localStorage qua
 * `usePageConfig` (state-persistence), không lên URL. Bản lưu cũ có cột đã gỡ / thiếu cột khoá / rỗng → không làm
 * vỡ bảng: bỏ key lạ, thêm lại cột khoá, rỗng → mặc định, giữ đúng thứ tự cột gốc.
 *
 * `storageKey` riêng cho cột (`…:columns`): hook số dòng / trang (`usePagedList`) ghi cả object của nó vào khoá
 * `…:config`, dùng chung khoá thì hai bên xoá field của nhau.
 */
/** Mặc định ổn định (không tạo mảng mới mỗi lần render → `useMemo` / `merge` không đổi). */
const NO_COLUMNS: readonly never[] = [];
const ACTIONS = "actions";

export function useColumnVisibility<C extends string>(
  storageKey: string,
  all: readonly C[],
  { defaults = all, locked = NO_COLUMNS }: ColumnVisibilityOptions<C> = {},
) {
  const defaultConfig = useMemo<ColumnConfig<C>>(
    () => ({ visibleColumns: all.filter((c) => defaults.includes(c) || locked.includes(c)) }),
    [all, defaults, locked],
  );
  const merge = useCallback(
    (stored: Partial<ColumnConfig<C>>, fallback: ColumnConfig<C>): ColumnConfig<C> => {
      const kept = Array.isArray(stored.visibleColumns)
        ? stored.visibleColumns.filter((c): c is C => all.includes(c))
        : [];
      if (kept.length === 0) return fallback;
      return { visibleColumns: all.filter((c) => kept.includes(c) || locked.includes(c)) };
    },
    [all, locked],
  );
  const { config, updateConfig } = usePageConfig(storageKey, defaultConfig, merge);
  const visible = config.visibleColumns;
  // Cột thao tác (key `actions`) không phải cột dữ liệu: không đếm, không có trong popover Ẩn hiện cột.
  const dataColumns = all.filter((c) => c !== ACTIONS);
  const hasColumnConfig =
    visible.length !== defaultConfig.visibleColumns.length ||
    visible.some((c) => !defaultConfig.visibleColumns.includes(c));

  return {
    visible,
    hasColumnConfig,
    /** Số cột dữ liệu đang hiện / tổng (không tính cột thao tác — chip `Cột hiển thị: x/y`). */
    visibleCount: visible.filter((c) => c !== ACTIONS).length,
    total: dataColumns.length,
    isVisible: (column: C) => visible.includes(column),
    toggle: (column: C) => {
      if (locked.includes(column)) return;
      updateConfig((current) => ({
        visibleColumns: all.filter((c) =>
          c === column ? !current.visibleColumns.includes(c) : current.visibleColumns.includes(c),
        ),
      }));
    },
    reset: () => updateConfig(() => defaultConfig),
    defaults: defaultConfig.visibleColumns,
    locked,
  };
}

export type ColumnVisibility<C extends string> = ReturnType<typeof useColumnVisibility<C>>;

/** Bộ props `Columns3` của `ListToolbar` từ một `useColumnVisibility` (nhãn theo `labels`). */
export function columnToolbarProps<C extends string>(
  state: ColumnVisibility<C>,
  labels: Record<C, string>,
  all: readonly C[],
) {
  // Cột khoá dữ liệu (mã / link) vẫn liệt kê, `ListToolbar` hiện tick tắt; cột thao tác thì không.
  const columnOptions: ColumnOption<C>[] = all
    .filter((c) => c !== ACTIONS)
    .map((c) => ({ value: c, label: labels[c] }));
  return {
    columnOptions,
    selectedColumns: state.visible,
    defaultColumns: [...state.defaults],
    lockedColumns: [...state.locked],
    visibleColumnCount: state.visibleCount,
    onToggleColumn: state.toggle,
    onResetColumns: state.reset,
    hasColumnConfig: state.hasColumnConfig,
  };
}

/** Chip `Cột hiển thị: x/y` của thanh Cấu hình, X đưa về mặc định. */
export function columnSummaryItem<C extends string>(state: ColumnVisibility<C>): ColumnSummaryItem {
  return {
    label: "Cột hiển thị",
    value: `${state.visibleCount}/${state.total}`,
    active: state.hasColumnConfig,
    onClear: state.reset,
  };
}
