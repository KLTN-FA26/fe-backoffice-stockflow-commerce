"use client";

import { RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";

import { cartonOpened } from "../lifecycle";
import { scanProgress } from "../selectors";

import { EMPTY, MONO } from "./primitives";

import type { ReturnReceipt, ReturnReceiptCarton } from "../types";

const D = RETURN_RECEIPT_LABELS.detail;
const TH = "py-1 pr-3 font-medium";

/**
 * WF-05 TH-4 / Q-18: thùng mở (đếm ít hơn nhãn) hiện "Đã mở · đếm 7/10" và không nhập tồn — phiếu NHÁP: "Sẽ không nhập
 * tồn"; đã xác nhận: "Không nhập tồn — huỷ". BE gửi `stockEntered` cả trên phiếu nháp (audit r2 L16: trước đây nháp đã
 * đọc là "huỷ"), nên nháp quyết theo `draft` trước. Q-4 (audit r2 returns H1): thùng nguyên của yêu cầu không hoàn tiền là
 * hàng giữ hộ khách (`heldForCustomer`), không phải tồn kho. Thiếu dữ liệu = nguyên thùng.
 */
function CountCell({ carton, draft }: { carton: ReturnReceiptCarton; draft: boolean }) {
  if (!cartonOpened(carton) && (draft || carton.stockEntered !== false))
    return carton.heldForCustomer && !draft ? (
      <span className="text-warning">{D.heldForCustomer}</span>
    ) : (
      <span className="text-ink-tertiary">{D.sealed}</span>
    );
  const stock = draft ? D.willNotStock : carton.stockEntered === false ? D.notStocked : null;
  return (
    <span className="text-warning tabular-nums">
      {D.openedState(carton.countedQuantity ?? 0, carton.quantity)}
      {stock && <span className="block text-xs">{stock}</span>}
    </span>
  );
}

/** Thùng đã quét (gỡ được khi phiếu nháp) và thùng của nguồn để đối chiếu (docs 03 §4.2 bước 11). */
export function ReturnCartonTables({
  receipt,
  onRemove,
  removing,
}: {
  receipt: ReturnReceipt;
  /** Có = phiếu nháp và có quyền sửa. */
  onRemove?: (lpn: string) => void;
  removing: boolean;
}) {
  const progress = scanProgress(receipt);
  return (
    <>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-ink-primary text-sm font-semibold">{D.scanned}</h2>
          <span className="text-ink-secondary text-[0.8125rem]">
            {D.progress(progress.scanned, progress.expected)}
          </span>
        </div>
        {receipt.cartons.length === 0 ? (
          <p className="text-ink-tertiary text-[0.8125rem]">{D.noCartons}</p>
        ) : (
          <table className="w-full text-[0.8125rem]">
            <caption className="sr-only">{D.scanned}</caption>
            <thead className="text-ink-tertiary text-left">
              <tr>
                <th scope="col" className={TH}>
                  {D.lpn}
                </th>
                <th scope="col" className={TH}>
                  {D.sku}
                </th>
                <th scope="col" className={TH}>
                  {D.lot}
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  {D.quantity}
                </th>
                <th scope="col" className={TH}>
                  {D.countColumn}
                </th>
                <th scope="col" className={TH}>
                  {D.conditionColumn}
                </th>
                {onRemove && <th scope="col" className={TH} aria-label={D.remove} />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--table-line)]">
              {receipt.cartons.map((carton) => (
                <tr key={carton.lpn}>
                  <td className={`py-1.5 pr-3 ${MONO}`}>{carton.lpn}</td>
                  <td className={`py-1.5 pr-3 ${MONO}`}>{carton.sku}</td>
                  <td className={`py-1.5 pr-3 ${MONO}`}>{carton.lotNumber ?? EMPTY}</td>
                  <td className={`py-1.5 pr-3 text-right ${MONO}`}>{carton.quantity}</td>
                  <td className="py-1.5 pr-3">
                    <CountCell carton={carton} draft={receipt.status === "DRAFT"} />
                  </td>
                  <td className="py-1.5 pr-3">{carton.condition ?? EMPTY}</td>
                  {onRemove && (
                    <td className="py-1.5 text-right">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={removing}
                        aria-label={`${D.remove} ${carton.lpn}`}
                        onClick={() => onRemove(carton.lpn)}
                      >
                        {D.remove}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {progress.missing.length > 0 && receipt.status === "DRAFT" && (
          <p className="text-ink-tertiary text-xs">{D.shortNote}</p>
        )}
      </Card>
      {receipt.expectedCartons.length > 0 && (
        <Card className="space-y-3">
          <h2 className="text-ink-primary text-sm font-semibold">{D.expected}</h2>
          <ul className="divide-y divide-[var(--table-line)] text-[0.8125rem]">
            {receipt.expectedCartons.map((carton) => (
              <li
                key={carton.lpn}
                className="flex flex-wrap items-center justify-between gap-2 py-1.5"
              >
                <span className={MONO}>{carton.lpn}</span>
                <span className={MONO}>
                  {carton.sku} × {carton.quantity}
                </span>
                <span className={carton.scanned ? "text-positive" : "text-ink-tertiary"}>
                  {carton.scanned ? D.scannedState : D.notScanned}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
