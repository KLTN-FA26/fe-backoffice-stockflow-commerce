import { cn } from "cn";

import { LOAD_PLAN_PRINT_LABELS } from "@/constants";

import { ParcelTable } from "./ParcelTable";
import { CapturedImage, LetterChip } from "./primitives";

import type { PrintStep } from "../../lib/print-sheet";

const S = LOAD_PLAN_PRINT_LABELS.steps;

/**
 * Một bước xếp trên một trang riêng khi in (`break-before-page`): tiêu đề, khối và vị trí, ảnh xe sau bước này, rồi các
 * kiện phải xếp ở bước đó. Ảnh vắng khi xem phiếu không có ảnh.
 */
export function SheetStep({
  step,
  first,
  image,
  color,
  colorOf,
}: {
  step: PrintStep;
  /** Bước đầu nằm cùng trang với tiêu đề phần "Trình tự xếp hàng"; các bước sau mỗi bước một trang. */
  first: boolean;
  image: string | undefined;
  color: string;
  colorOf: (partName: string) => string;
}) {
  return (
    <section className={cn("space-y-2", !first && "print:break-before-page")}>
      <h3 className="text-ink-primary flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span>{S.step(step.seq, step.total)}</span>
        <LetterChip letter={step.letter} color={color} />
        <span>{S.summary(step.count, step.partName)}</span>
      </h3>
      <p className="text-ink-secondary text-xs">
        {S.block}: {step.blockCm} · {S.position}: {step.positionCm}
      </p>
      {image && <CapturedImage src={image} alt={S.imageAlt(step.seq)} />}
      <ParcelTable
        parcels={step.parcels}
        colorOf={colorOf}
        caption={S.step(step.seq, step.total)}
      />
    </section>
  );
}
