"use client";

import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MONO = "font-[family-name:var(--font-mono)] tabular-nums";
const HEAD = "text-ink-secondary h-9 px-3 text-xs font-semibold";
const CELL = "px-3 py-2 align-middle";
// Màn cảm ứng (kho): nút chọn cao 44px — ngón tay không chạm nhầm dòng bên cạnh
const CHOOSE_BASE =
  "h-7 min-w-16 rounded-[var(--r-sm)] px-2.5 text-xs pointer-coarse:h-11 pointer-coarse:min-w-20";
// Hai bộ class tách hẳn: `cn` chỉ nối chuỗi, không gộp class trùng thuộc tính (viền / nền)
const CHOOSE_CLASS = `border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary ${CHOOSE_BASE}`;
const CHOSEN_CLASS = `border-brand bg-bg-muted text-ink-primary hover:bg-bg-muted ${CHOOSE_BASE}`;

export interface SlottingSuggestionItem {
  locationCode: string;
  /** Lý do xếp hạng đã dịch (vd "Cùng lô"). */
  reason: string;
  /** Đã định dạng; null = không giới hạn. */
  freeVolume: string | null;
  freeWeight: string | null;
}

export interface SlottingSuggestionLabels {
  caption: string;
  rank: string;
  location: string;
  capacity: string;
  freeVolume: string;
  freeWeight: string;
  unlimited: string;
  action: string;
  choose: string;
  chooseBin: (code: string) => string;
  chosen: string;
}

/**
 * Danh sách bin gợi ý xếp hạng (FRONTEND-AI-RULES §6 `SlottingSuggestionList`) — thứ tự = thứ hạng, không có điểm số.
 * Chỉ hiển thị: nhận dữ liệu đã dịch / định dạng qua props, không biết nghiệp vụ. `onChoose` vắng = chỉ xem.
 *
 * Bốn cột gọn để vừa cột trái trang chi tiết ở 1024px (≈ 400px): lý do nằm dưới mã bin, thể tích + tải xếp hai dòng
 * trong một cột căn phải — số mono, tabular. Cùng dáng bảng `DataTable` (header `bg.subtle`, vạch dòng `--table-line`).
 */
export function SlottingSuggestionList({
  items,
  labels,
  selected,
  onChoose,
}: {
  items: readonly SlottingSuggestionItem[];
  labels: SlottingSuggestionLabels;
  selected?: string | null;
  onChoose?: (locationCode: string) => void;
}) {
  const amount = (value: string | null, label: string) => (
    <span
      className={cn("block", value === null ? "text-ink-tertiary text-xs" : "text-ink-primary")}
      title={label}
    >
      {value ?? labels.unlimited}
    </span>
  );
  return (
    <div className="border-border-default overflow-hidden rounded-(--section-radius) border">
      <div className="w-full overflow-x-auto">
        <table data-slot="table" className="w-full text-sm">
          <caption className="sr-only">{labels.caption}</caption>
          <TableHeader>
            <TableRow className="bg-bg-subtle hover:bg-bg-subtle border-(--table-line)">
              <TableHead className={cn(HEAD, "w-10")}>{labels.rank}</TableHead>
              <TableHead className={HEAD}>{labels.location}</TableHead>
              <TableHead className={cn(HEAD, "text-right")}>{labels.capacity}</TableHead>
              {onChoose && (
                <TableHead className={cn(HEAD, "w-24 text-right")}>
                  <span className="sr-only">{labels.action}</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const isSelected = selected === item.locationCode;
              return (
                <TableRow
                  key={item.locationCode}
                  data-state={isSelected ? "selected" : undefined}
                  className="border-(--table-line) transition-colors"
                >
                  <TableCell className={cn(CELL, "text-ink-tertiary text-[0.8125rem]", MONO)}>
                    {index + 1}
                  </TableCell>
                  <TableCell className={CELL}>
                    <span
                      className={cn("text-ink-primary block text-[0.8125rem] font-medium", MONO)}
                    >
                      {item.locationCode}
                    </span>
                    <span className="text-ink-tertiary block text-xs">{item.reason}</span>
                  </TableCell>
                  <TableCell className={cn(CELL, "text-right text-[0.8125rem]", MONO)}>
                    {amount(item.freeVolume, labels.freeVolume)}
                    {amount(item.freeWeight, labels.freeWeight)}
                  </TableCell>
                  {onChoose && (
                    <TableCell className={cn(CELL, "text-right")}>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        aria-label={labels.chooseBin(item.locationCode)}
                        aria-pressed={isSelected}
                        onClick={() => onChoose(item.locationCode)}
                        className={isSelected ? CHOSEN_CLASS : CHOOSE_CLASS}
                      >
                        {isSelected ? labels.chosen : labels.choose}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
