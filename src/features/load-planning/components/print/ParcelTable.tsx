import { cn } from "cn";

import { LOAD_PLAN_PRINT_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";

import { formatKg } from "../../lib/print-labels";
import { EMPTY, LetterChip, PRINT_EXACT, TABLE_FRAME, TD, TH } from "./primitives";

import type { PrintParcel } from "../../lib/print-sheet";

const P = LOAD_PLAN_PRINT_LABELS.parcel;

/**
 * Bảng kiện của một bước xếp, hoặc (`showStep`) danh sách đầy đủ mọi kiện của xe kèm cột bước và dòng tổng. Mỗi hàng
 * một kiện: mã nhãn, mặt hàng, đơn hàng, kích thước danh định, khối lượng, bộ "x/N", hướng đặt.
 */
export function ParcelTable({
  parcels,
  colorOf,
  caption,
  showStep = false,
  showTotal = false,
}: {
  parcels: readonly PrintParcel[];
  colorOf: (partName: string) => string;
  caption: string;
  showStep?: boolean;
  showTotal?: boolean;
}) {
  const totalKg = parcels.reduce((sum, parcel) => sum + parcel.weightKg, 0);
  return (
    <div className={TABLE_FRAME}>
      <table className="w-full text-[0.75rem]">
        <caption className="sr-only">{caption}</caption>
        <thead className={cn("bg-bg-subtle text-ink-secondary text-left", PRINT_EXACT)}>
          <tr>
            {showStep && (
              <th scope="col" className={TH}>
                {P.step}
              </th>
            )}
            <th scope="col" className={TH}>
              {P.label}
            </th>
            <th scope="col" className={TH}>
              {P.item}
            </th>
            <th scope="col" className={TH}>
              {P.order}
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              {P.size}
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              {P.weight}
            </th>
            <th scope="col" className={TH}>
              {P.kit}
            </th>
            <th scope="col" className={TH}>
              {P.orientation}
            </th>
          </tr>
        </thead>
        <tbody>
          {parcels.map((parcel) => (
            <tr
              key={`${parcel.step}-${parcel.ref}`}
              className="border-border-default break-inside-avoid border-t"
            >
              {showStep && <td className={cn(TD, "tabular-nums")}>{parcel.step}</td>}
              <td className={cn(TD, "font-mono")}>{parcel.labelCode}</td>
              <td className={TD}>
                <span className="inline-flex items-center gap-1.5">
                  <LetterChip letter={parcel.letter} color={colorOf(parcel.partName)} />
                  {parcel.partName}
                </span>
              </td>
              <td className={cn(TD, "font-mono")}>{parcel.orderNo ?? EMPTY}</td>
              <td className={cn(TD, "text-right tabular-nums")}>{parcel.sizeCm}</td>
              <td className={cn(TD, "text-right tabular-nums")}>{formatKg(parcel.weightKg)}</td>
              <td className={TD}>{parcel.kit ?? EMPTY}</td>
              <td className={TD}>{parcel.orientation}</td>
            </tr>
          ))}
        </tbody>
        {showTotal && (
          <tfoot className={cn("bg-bg-subtle font-medium", PRINT_EXACT)}>
            <tr className="border-border-default border-t">
              <td className={TD} colSpan={showStep ? 4 : 3}>
                {P.total}: {formatNumber(parcels.length)}
              </td>
              <td className={TD} />
              <td className={cn(TD, "text-right tabular-nums")}>{formatKg(totalKg)}</td>
              <td className={TD} colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
