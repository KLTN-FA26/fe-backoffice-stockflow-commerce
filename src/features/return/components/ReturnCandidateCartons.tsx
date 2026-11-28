"use client";

import { RETURN_RECEIVING_LABELS } from "@/constants/labels-return-receiving";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";

import { splitCandidates } from "../receiving";

import { EMPTY, MONO } from "./primitives";

import type { CandidateCarton } from "../types";

const C = RETURN_RECEIVING_LABELS.candidates;
const TH = "py-1 pr-3 font-medium";

function restriction(carton: CandidateCarton): string {
  return carton.eligibility === "COUNT_REQUIRED"
    ? C.countRequired(carton.maxReceivableQuantity)
    : RETURN_RECEIVING_LABELS.eligibility[carton.eligibility];
}

/**
 * Thùng của chuyến có thể nhận trên phiếu nháp (WF-05 BE-22; BE `candidateCartons`): mọi thùng thật sự còn hợp lệ của SKU
 * được duyệt — không tự chọn sẵn một nhóm thùng vừa đủ số, vì khách gửi lại thùng nào là việc của khách. "Chọn" chỉ đưa
 * thùng vào ô ghi nhận; người dùng vẫn phải xác nhận tình trạng / số đếm. Thùng không nhận được nằm trong mục thu gọn,
 * kèm lý do, để tra cứu.
 */
export function ReturnCandidateCartons({
  cartons,
  selectedLpn,
  disabled,
  onSelect,
}: {
  cartons: readonly CandidateCarton[];
  selectedLpn: string | null;
  disabled: boolean;
  onSelect: (carton: CandidateCarton) => void;
}) {
  const { workable, excluded } = splitCandidates(cartons);
  return (
    <Card className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-ink-primary text-sm font-semibold">{C.title}</h2>
        <p className="text-ink-tertiary text-xs">{C.description}</p>
      </div>
      {workable.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{C.empty}</p>
      ) : (
        <table className="w-full text-[0.8125rem]">
          <caption className="sr-only">{C.title}</caption>
          <thead className="text-ink-tertiary text-left">
            <tr>
              <th scope="col" className={TH}>
                {C.lpn}
              </th>
              <th scope="col" className={TH}>
                {C.sku}
              </th>
              <th scope="col" className={TH}>
                {C.lot}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {C.label}
              </th>
              <th scope="col" className={TH}>
                {C.status}
              </th>
              <th scope="col" className={TH} aria-label={C.select} />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--table-line)]">
            {workable.map((carton) => {
              const selected = carton.lpn === selectedLpn;
              return (
                <tr
                  key={carton.lpn}
                  aria-selected={selected}
                  className={selected ? "bg-bg-muted" : ""}
                >
                  <td className={`py-1.5 pr-3 ${MONO}`}>{carton.lpn}</td>
                  <td className={`py-1.5 pr-3 ${MONO}`}>{carton.sku}</td>
                  <td className={`py-1.5 pr-3 ${MONO}`}>{carton.lotNumber ?? EMPTY}</td>
                  <td className={`py-1.5 pr-3 text-right ${MONO}`}>{carton.quantity}</td>
                  <td
                    className={`py-1.5 pr-3 ${carton.eligibility === "COUNT_REQUIRED" ? "text-warning-ink" : "text-ink-secondary"}`}
                  >
                    {restriction(carton)}
                  </td>
                  <td className="py-1.5 text-right">
                    <Button
                      type="button"
                      size="xs"
                      variant={selected ? "default" : "outline"}
                      disabled={disabled}
                      aria-label={C.selectLpn(carton.lpn)}
                      aria-pressed={selected}
                      onClick={() => onSelect(carton)}
                    >
                      {C.select}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {excluded.length > 0 && (
        <details className="text-[0.8125rem]">
          <summary className="text-ink-secondary cursor-pointer text-xs font-medium">
            {C.excludedTitle(excluded.length)}
          </summary>
          <p className="text-ink-tertiary mt-1 text-xs">{C.excludedHint}</p>
          <ul className="mt-1 divide-y divide-[var(--table-line)]">
            {excluded.map((carton) => (
              <li
                key={carton.lpn}
                className="flex flex-wrap items-center justify-between gap-2 py-1"
              >
                <span className={MONO}>{carton.lpn}</span>
                <span className={MONO}>
                  {carton.sku} × {carton.quantity}
                </span>
                <span className="text-ink-tertiary">{restriction(carton)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
