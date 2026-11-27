"use client";

import { parseAsString, useQueryStates } from "nuqs";

import { UI_LABELS } from "@/constants";

/** Cùng dạng `ListSummaryItem` của `ListToolbar` — hook không import tầng components. */
interface ColumnFilterSummaryItem {
  label: string;
  value: string;
  active: boolean;
  onClear: () => void;
}

const SUMMARY_LABEL = "Search trong cột";

const TEXT = parseAsString.withDefault("");

/** Parser theo khoá chuỗi thường — nuqs không suy được kiểu khi khoá là tham số generic. */
function parsersFor(keys: readonly string[]): Record<string, typeof TEXT> {
  return Object.fromEntries(keys.map((key) => [key, TEXT]));
}

/**
 * Lọc gõ chữ trên header cột (data-table-mode-a §4.1) của trang mà BE không có tham số tìm theo cột: mỗi cột một khoá
 * URL (nuqs) → F5 / gửi link giữ nguyên. Chỉ giữ state; hàm khớp dòng là hàm thuần ở `selectors.ts` của feature.
 * `keys` phải cố định qua các lần render (khai báo hằng ngoài component).
 */
export function useColumnTextFilters<K extends string>(keys: readonly K[]) {
  const [raw, setValues] = useQueryStates(parsersFor(keys));
  // Mọi khoá của `keys` đều có parser (mặc định "") nên đọc theo K luôn ra chuỗi.
  const values = Object.fromEntries(keys.map((key) => [key, raw[key] ?? ""])) as Record<K, string>;
  const active = keys.some((key) => values[key].trim() !== "");

  /**
   * Chip "Search trong cột" của thanh Cấu hình: liệt kê `Nhãn “giá trị”`, X xoá mọi lọc cột. `format` đổi giá trị
   * lưu trên URL (vd mã lý do) thành chữ người đọc.
   */
  const summaryItem = (
    labels: Record<K, string>,
    format: Partial<Record<K, (value: string) => string>> = {},
  ): ColumnFilterSummaryItem => {
    const entries = keys
      .filter((key) => values[key].trim() !== "")
      .map((key) => {
        const value = values[key].trim();
        return `${labels[key]} “${format[key]?.(value) ?? value}”`;
      });
    return {
      label: SUMMARY_LABEL,
      value: entries.length > 0 ? entries.join(", ") : UI_LABELS.common.notEntered,
      active: entries.length > 0,
      onClear: () => void setValues(null),
    };
  };

  return {
    values,
    active,
    /** Đặt lọc một cột; chuỗi rỗng = bỏ khoá khỏi URL. */
    set: (key: K, value: string) => {
      void setValues({ [key]: value || null });
    },
    clear: () => void setValues(null),
    summaryItem,
  };
}

export type ColumnTextFilters<K extends string> = ReturnType<typeof useColumnTextFilters<K>>;
