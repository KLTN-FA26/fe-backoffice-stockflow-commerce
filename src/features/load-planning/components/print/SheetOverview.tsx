import { cn } from "cn";

import { LOAD_PLAN_PRINT_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";

import { formatKg } from "../../lib/print-labels";
import {
  CapturedImage,
  LetterChip,
  PRINT_EXACT,
  SECTION_TITLE,
  TABLE_FRAME,
  TD,
  TH,
} from "./primitives";

import type { PrintImages } from "../../lib/print-capture";
import type { PrintSheet } from "../../lib/print-sheet";

const O = LOAD_PLAN_PRINT_LABELS.overview;
const S = LOAD_PLAN_PRINT_LABELS.steps;

/**
 * Tổng quan: ảnh 3D xe đầy hàng nhìn từ hai phía (trái / phải) và bảng kê hàng theo dòng (mặt hàng × cỡ) — ký hiệu chữ
 * và màu khớp ảnh. `images` vắng khi người dùng chọn xem phiếu không có ảnh.
 */
export function SheetOverview({
  sheet,
  images,
  colorOf,
}: {
  sheet: PrintSheet;
  images: PrintImages | null;
  colorOf: (partName: string) => string;
}) {
  const totalM3 = sheet.lines.reduce((sum, line) => sum + line.volumeM3, 0);
  return (
    <section className="space-y-3">
      <h3 className={SECTION_TITLE}>{O.title}</h3>
      {images && (
        <div className="grid grid-cols-2 gap-3">
          <CapturedImage src={images.left.dataUrl} alt={S.overviewAlt(O.left)} caption={O.left} />
          <CapturedImage
            src={images.right.dataUrl}
            alt={S.overviewAlt(O.right)}
            caption={O.right}
          />
        </div>
      )}
      <div className={TABLE_FRAME}>
        <table className="w-full text-[0.75rem]">
          <caption className="sr-only">{O.contents}</caption>
          <thead className={cn("bg-bg-subtle text-ink-secondary text-left", PRINT_EXACT)}>
            <tr>
              <th scope="col" className={TH}>
                {O.legend}
              </th>
              <th scope="col" className={TH}>
                {O.item}
              </th>
              <th scope="col" className={cn(TH, "text-right")}>
                {O.pieces}
              </th>
              <th scope="col" className={cn(TH, "text-right")}>
                {O.size}
              </th>
              <th scope="col" className={cn(TH, "text-right")}>
                {O.weight}
              </th>
              <th scope="col" className={cn(TH, "text-right")}>
                {O.volume}
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.lines.map((line) => (
              <tr key={line.key} className="border-border-default border-t">
                <td className={TD}>
                  <LetterChip letter={line.letter} color={colorOf(line.partName)} />
                </td>
                <td className={TD}>{line.partName}</td>
                <td className={cn(TD, "text-right tabular-nums")}>{formatNumber(line.pieces)}</td>
                <td className={cn(TD, "text-right tabular-nums")}>{line.sizeCm}</td>
                <td className={cn(TD, "text-right tabular-nums")}>{formatKg(line.weightKg)}</td>
                <td className={cn(TD, "text-right tabular-nums")}>
                  {formatNumber(Math.round(line.volumeM3 * 1000) / 1000)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className={cn("bg-bg-subtle font-medium", PRINT_EXACT)}>
            <tr className="border-border-default border-t">
              <td className={TD} colSpan={2}>
                {O.total}
              </td>
              <td className={cn(TD, "text-right tabular-nums")}>
                {formatNumber(sheet.parcels.length)}
              </td>
              <td className={TD} />
              <td className={cn(TD, "text-right tabular-nums")}>{formatKg(sheet.totalWeightKg)}</td>
              <td className={cn(TD, "text-right tabular-nums")}>
                {formatNumber(Math.round(totalM3 * 1000) / 1000)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
