"use client";

import { useState } from "react";
import { Printer } from "lucide-react";

import { RECEIPT_CARTON_LABELS as L, STOCK_PACKAGE_STATUS_BY_API } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { canPrintCartonLabels } from "@/features/receipt/carton-actions";
import { liveCartons, liveSelection } from "@/features/receipt/carton-selectors";
import { SlideOverPanel } from "@/components/shared/SlideOverPanel";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { NUM } from "../primitives";
import { PrintLabelsDialog } from "./PrintLabelsDialog";

import type { ReceiptLineDto } from "@/features/receipt/types";
import type { PrintTarget } from "./PrintLabelsDialog";

const H = L.headers;
const MONO = "font-[family-name:var(--font-mono)]";

/**
 * Thùng của một dòng nhận (issue #104): LPN, SL đếm được, SL hiện còn, danh nghĩa, trạng thái, vị trí. Ai có quyền in
 * nhãn thì chọn thùng để in lại, hoặc in cả dòng.
 */
export function LineCartonsPanel({
  line,
  open,
  onClose,
}: {
  line: ReceiptLineDto;
  open: boolean;
  onClose: () => void;
}) {
  const can = usePermissionChecker();
  const printable = canPrintCartonLabels(line, can);
  const live = new Set(liveCartons(line).map((carton) => carton.lpn));
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [target, setTarget] = useState<PrintTarget | null>(null);
  const chosen = liveSelection(selected, line);
  const toggle = (lpn: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(lpn);
      else next.delete(lpn);
      return next;
    });

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      size="xl"
      monoTitle
      title={`${line.sku ?? "—"}${line.lotNumber ? ` · lô ${line.lotNumber}` : ""}`}
      subtitle={L.panelSubtitle(
        line.packages.length,
        line.looseQuantity,
        line.unitOfMeasure ?? null,
      )}
    >
      {printable && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => setTarget({ receiptLineId: line.id, count: live.size })}
          >
            <Printer className="size-3.5" /> {L.printLine}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={chosen.length === 0}
            onClick={() => setTarget({ lpns: chosen })}
          >
            {L.reprint(chosen.length)}
          </Button>
        </div>
      )}
      <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
        <table className="w-full text-[0.8125rem]">
          <caption className="sr-only">{L.cartons}</caption>
          <thead className="bg-bg-subtle text-ink-secondary">
            <tr>
              {printable && <th scope="col" className="w-8 px-2 py-2" />}
              <th scope="col" className="px-2 py-2 text-left font-medium">
                {H.lpn}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {H.received}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {H.now}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {H.nominal}
              </th>
              <th scope="col" className="px-2 py-2 text-left font-medium">
                {H.status}
              </th>
              <th scope="col" className="px-2 py-2 text-left font-medium">
                {H.location}
              </th>
            </tr>
          </thead>
          <tbody>
            {line.packages.map((carton) => (
              <tr key={carton.id} className="border-t border-[var(--table-line)]">
                {printable && (
                  <td className="px-2 py-2">
                    {live.has(carton.lpn) && (
                      <Checkbox
                        aria-label={L.selectCarton(carton.lpn)}
                        checked={selected.has(carton.lpn)}
                        onCheckedChange={(on) => toggle(carton.lpn, on === true)}
                      />
                    )}
                  </td>
                )}
                <td className={`px-2 py-2 ${MONO}`}>{carton.lpn}</td>
                <td className={`px-2 py-2 ${NUM}`}>{carton.receivedQty}</td>
                <td className={`px-2 py-2 ${NUM}`}>{carton.quantity}</td>
                <td className={`text-ink-secondary px-2 py-2 ${NUM}`}>{carton.nominalQty}</td>
                <td className="px-2 py-2">
                  <StatusDot domain="stock" status={STOCK_PACKAGE_STATUS_BY_API[carton.status]} />
                </td>
                <td className={`px-2 py-2 ${MONO}`}>{carton.locationCode ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Gỡ hẳn khi đóng: lần in sau bắt đầu sạch (không còn PDF / lỗi cũ), blob URL cũ được thu hồi */}
      {target && <PrintLabelsDialog target={target} onClose={() => setTarget(null)} />}
    </SlideOverPanel>
  );
}
