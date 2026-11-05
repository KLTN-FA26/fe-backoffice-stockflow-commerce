"use client";

import { Controller } from "react-hook-form";

import { QC_OUTCOME_API, RECEIPT_CARTON_LABELS as L, RECEIPT_CARTON_LIMITS } from "@/constants";

import { qcChoosable } from "@/features/receipt/carton-selectors";

import { FieldError } from "../primitives";

import type { Control } from "react-hook-form";
import type { QcDecisionFormInput, ReceiptLineDto } from "@/features/receipt/types";

/**
 * Kết luận từng thùng (SCRUM-473 §5, issue #104 §2): Đạt / Cách ly / Không đạt NGUYÊN thùng — thùng không mở, giữ LPN.
 * Chỉ thùng IN_STOCK đang ở khu QC của dòng mới chọn được (BE `STOCK_PACKAGE_WRONG_LOCATION`); thùng khác tính là Đạt.
 */
export function QcCartonChoices({
  line,
  control,
  errors,
}: {
  line: Pick<ReceiptLineDto, "packages" | "qcLocationCode">;
  control: Control<QcDecisionFormInput>;
  /** Lỗi BE theo LPN (`quarantined.packages[j]`…). */
  errors: Readonly<Record<string, string>>;
}) {
  return (
    <fieldset className="border-border-default rounded-[var(--r-sm)] border p-3">
      <legend className="text-ink-primary px-1 text-[0.8125rem] font-medium">
        {L.qcCartonsTitle}
      </legend>
      <ul
        className={`divide-y divide-[var(--table-line)] ${
          line.packages.length > RECEIPT_CARTON_LIMITS.scrollAfter
            ? "max-h-[260px] overflow-y-auto pr-1"
            : ""
        }`}
      >
        {line.packages.map((carton) => {
          const choosable = qcChoosable(carton, line);
          const errorId = `qc-carton-${carton.lpn}-error`;
          return (
            <li key={carton.id} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.8125rem]">
                  <span className="font-[family-name:var(--font-mono)]">{carton.lpn}</span>{" "}
                  <span className="text-ink-secondary tabular-nums">· {carton.receivedQty}</span>
                </span>
                <Controller
                  control={control}
                  name={`cartons.${carton.lpn}`}
                  render={({ field }) => (
                    <div
                      role="radiogroup"
                      aria-label={carton.lpn}
                      aria-describedby={errors[carton.lpn] ? errorId : undefined}
                      className="flex gap-3"
                    >
                      {QC_OUTCOME_API.map((outcome) => (
                        <label key={outcome} className="flex items-center gap-1.5 text-xs">
                          <input
                            type="radio"
                            name={`qc-carton-${carton.lpn}`}
                            aria-label={L.qcChoice(L.qcOutcome[outcome], carton.lpn)}
                            checked={
                              (choosable ? (field.value ?? "ACCEPTED") : "ACCEPTED") === outcome
                            }
                            disabled={!choosable}
                            onChange={() => field.onChange(outcome)}
                            className="accent-[var(--brand)]"
                          />
                          {L.qcOutcome[outcome]}
                        </label>
                      ))}
                    </div>
                  )}
                />
              </div>
              {!choosable && (
                <p className="text-ink-tertiary mt-1 text-xs">
                  {L.qcCartonAway(carton.locationCode ?? "—")}
                </p>
              )}
              <FieldError id={errorId}>{errors[carton.lpn]}</FieldError>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
