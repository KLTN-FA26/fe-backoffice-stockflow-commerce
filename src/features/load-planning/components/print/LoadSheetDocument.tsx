import { LOAD_PLAN_PRINT_LABELS } from "@/constants";

import { colorOf } from "../../lib/palette";

import { ParcelTable } from "./ParcelTable";
import { SheetHeader } from "./SheetHeader";
import { SignatureBoxes, UnplacedNote } from "./SheetNotes";
import { SheetOverview } from "./SheetOverview";
import { SheetStep } from "./SheetStep";
import { SECTION_TITLE } from "./primitives";

import type { BookingView } from "../../lib/booking-view";
import type { ColorMap } from "../../lib/palette";
import type { PrintImages } from "../../lib/print-capture";
import type { PrintSheet } from "../../lib/print-sheet";

const L = LOAD_PLAN_PRINT_LABELS;
const S = LOAD_PLAN_PRINT_LABELS.steps;
const P = LOAD_PLAN_PRINT_LABELS.parcel;

/**
 * Phiếu xếp hàng của một xe (A4): trang 1 = đầu phiếu, ảnh tổng quan, bảng kê, ghi chú kiện chưa xếp và ô ký; mỗi bước xếp
 * một trang; trang cuối là danh sách đầy đủ các kiện. Khung back-office bị ẩn khi in (`BackofficeShell`), token màu ép về
 * bảng sáng (`globals.css` @media print). Chỉ dựng khi ảnh đã sẵn sàng (hoặc người dùng bỏ ảnh).
 */
export function LoadSheetDocument({
  planCode,
  sheet,
  images,
  booking,
  colorMap,
  printedAt,
}: {
  planCode: string;
  sheet: PrintSheet;
  images: PrintImages | null;
  booking: BookingView;
  colorMap: ColorMap;
  printedAt: string;
}) {
  const colorFor = (partName: string) => colorOf(colorMap, partName);
  return (
    <article className="border-border-default bg-bg-surface space-y-5 rounded-[var(--card-radius)] border p-[var(--card-pad)] print:border-0 print:p-0">
      {/*
        A4 dọc, lề 12 mm (chừa 16 mm ở dưới cho chân trang). Chỉ trang này khai báo nên không đổi các trang in khác.
        Số trang do trình duyệt đếm (`counter(page)` ở lề cuối trang; trình duyệt chưa hỗ trợ thì chỉ còn chân trang cố định).
      */}
      <style>{`@page { size: A4 portrait; margin: 12mm 12mm 16mm; @bottom-right { content: "${L.pageWord} " counter(page) "/" counter(pages); font-size: 8pt; } }`}</style>
      {/* `fixed` lặp lại ở MỌI trang in; ẩn trên màn hình */}
      <footer className="text-ink-tertiary fixed inset-x-0 -bottom-[10mm] hidden text-center text-[0.6875rem] print:block">
        {L.footer(planCode, sheet.layout.seq)}
      </footer>
      <SheetHeader planCode={planCode} sheet={sheet} booking={booking} printedAt={printedAt} />
      <SheetOverview sheet={sheet} images={images} colorOf={colorFor} />
      {sheet.unplaced && <UnplacedNote unplaced={sheet.unplaced} />}
      <SignatureBoxes />
      {sheet.steps.length > 0 && (
        <div className="space-y-5 print:break-before-page">
          <div>
            <h3 className={SECTION_TITLE}>{S.title}</h3>
            <p className="text-ink-secondary text-xs">{S.intro}</p>
          </div>
          {sheet.steps.map((step, index) => (
            <SheetStep
              key={step.seq}
              step={step}
              first={index === 0}
              image={images?.steps[index]}
              color={colorFor(step.partName)}
              colorOf={colorFor}
            />
          ))}
        </div>
      )}
      <section className="space-y-2 print:break-before-page">
        <h3 className={SECTION_TITLE}>{P.title}</h3>
        <ParcelTable
          parcels={sheet.parcels}
          colorOf={colorFor}
          caption={P.title}
          showStep
          showTotal
        />
      </section>
    </article>
  );
}
