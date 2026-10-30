"use client";

import { useState } from "react";
import { Eye, EyeOff, Info, Maximize2 } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";

import { TooltipProvider } from "@/components/ui/tooltip";

import { FloatingBar, FloatingDivider } from "../../shared/FloatingBar";
import { IconTool } from "../../shared/IconTool";

import type { LocationStockRow } from "@/features/warehouse-map/cartons-3d";

const S = UI_LABELS.warehouseMap.map.scene;
/** Số dòng tồn liệt kê trên thẻ — nhiều hơn thì xem trang tồn kho. */
const MAX_ROWS = 8;

export interface FocusStock {
  rows: readonly LocationStockRow[];
  isLoading: boolean;
  isError: boolean;
}

function StockRows({ stock }: { stock: FocusStock }) {
  if (stock.isLoading) return <p className="text-ink-tertiary">{S.stockLoading}</p>;
  if (stock.isError) return <p className="text-danger">{S.stockFailed}</p>;
  if (stock.rows.length === 0) return <p className="text-ink-tertiary">{S.stockEmpty}</p>;
  const extra = stock.rows.length - MAX_ROWS;
  return (
    <>
      <ul className="divide-y divide-(--table-line)">
        {stock.rows.slice(0, MAX_ROWS).map((row, index) => (
          <li key={`${row.locationCode}-${row.sku ?? index}`} className="flex gap-2 py-1">
            <span className="text-ink-primary font-[family-name:var(--font-mono)]">
              {row.locationCode}
            </span>
            <span className="text-ink-secondary min-w-0 flex-1 truncate">{row.sku}</span>
            {row.sku && (
              <span className="text-ink-primary font-[family-name:var(--font-mono)] tabular-nums">
                {row.onHand == null ? S.stockHidden : formatNumber(row.onHand)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {extra > 0 && <p className="text-ink-tertiary">{S.stockMore(extra)}</p>}
    </>
  );
}

/**
 * Góc trái-trên cảnh 3D khi đang xem một kệ / khu vực: thanh nổi nhỏ (mã + con mắt bật / tắt thẻ hàng
 * trên kệ, mở modal chi tiết, về toàn cảnh). Thẻ hàng mặc định đóng để không che cảnh.
 */
export function FocusCard({
  code,
  name,
  stock,
  onDetail,
  onOverview,
}: {
  code: string;
  name: string;
  /** Chỉ kệ có danh sách hàng. */
  stock?: FocusStock;
  onDetail: () => void;
  onOverview: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider>
      <div className="absolute top-3 left-3 z-(--z-sticky) flex w-72 flex-col gap-2">
        <FloatingBar label={S.focusLabel(code)} inline className="items-center">
          <span className="text-ink-primary px-2 font-[family-name:var(--font-mono)] text-sm font-semibold">
            {code}
          </span>
          <FloatingDivider />
          {stock && (
            <IconTool
              label={open ? S.hideStock : S.showStock}
              pressed={open}
              onClick={() => setOpen((on) => !on)}
            >
              {open ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </IconTool>
          )}
          <IconTool label={S.openDetail} onClick={onDetail}>
            <Info className="size-3.5" />
          </IconTool>
          <IconTool label={S.overview} onClick={onOverview}>
            <Maximize2 className="size-3.5" />
          </IconTool>
        </FloatingBar>
        {stock && open && (
          <section
            aria-label={S.stockTitle}
            className="bg-bg-surface border-border-default flex flex-col gap-1 rounded-(--card-radius) border p-3 text-xs shadow-(--sh-md)"
          >
            <p className="text-ink-secondary truncate">{name}</p>
            <StockRows stock={stock} />
            <p className="text-ink-tertiary">{S.stockNote}</p>
          </section>
        )}
      </div>
    </TooltipProvider>
  );
}
