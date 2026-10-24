import { LOAD_PLANNING_LABELS } from "@/constants";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatNominalCm } from "../../lib/dims";
import { buildItemTable } from "../../lib/item-rows";

import type { Layout, UnplacedLine } from "../../types";

/**
 * Bảng "số kiện đã xếp theo xe": mỗi dòng một mặt hàng × cỡ, mỗi cột một xe, cuối bảng là tổng.
 * Số "Tổng" của dòng tô cảnh báo khi còn kiện chưa xếp. (Gốc: bảng đầu của `loading-tables.tsx`.)
 */
export function VehicleItemTable({
  layouts,
  unplaced = [],
}: {
  layouts: readonly Layout[];
  unplaced?: readonly UnplacedLine[];
}) {
  const labels = LOAD_PLANNING_LABELS.itemTable;
  const { rows, grandTotal } = buildItemTable(layouts, unplaced);
  if (rows.length === 0) return null;
  const totalLoaded = layouts.reduce((sum, layout) => sum + layout.boxes.length, 0);

  return (
    <div className="border-border-default rounded border">
      <div className="border-border-default bg-bg-subtle border-b px-3 py-2 text-sm font-medium">
        {labels.title}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableCaption className="sr-only">{labels.title}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.item}</TableHead>
              {layouts.map((layout) => (
                <TableHead
                  key={layout.seq}
                  className="text-center whitespace-nowrap"
                  title={labels.vehicleTitle(layout.seq, layout.code)}
                >
                  {labels.vehicleHeader(layout.seq)}
                </TableHead>
              ))}
              <TableHead className="text-right">{labels.loaded}</TableHead>
              <TableHead className="text-right">{labels.total}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="whitespace-nowrap">
                  <span className="font-medium">
                    {row.partName || LOAD_PLANNING_LABELS.unnamed}
                  </span>
                  {row.label && <span className="text-ink-tertiary ml-2 text-xs">{row.label}</span>}
                  <span className="text-ink-tertiary ml-2 text-[11px] tabular-nums">
                    {formatNominalCm(row.origMm)}
                  </span>
                </TableCell>
                {layouts.map((layout) => (
                  <TableCell
                    key={layout.seq}
                    className="text-ink-secondary text-center tabular-nums"
                  >
                    {row.perVehicle[layout.seq] ?? ""}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium tabular-nums">{row.loaded}</TableCell>
                <TableCell
                  className={`text-right tabular-nums ${row.loaded < row.total ? "text-warning" : "text-ink-secondary"}`}
                >
                  {row.total}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">{labels.total}</TableCell>
              {layouts.map((layout) => (
                <TableCell key={layout.seq} className="text-center font-medium tabular-nums">
                  {layout.boxes.length}
                </TableCell>
              ))}
              <TableCell className="text-right font-medium tabular-nums">{totalLoaded}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{grandTotal}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
