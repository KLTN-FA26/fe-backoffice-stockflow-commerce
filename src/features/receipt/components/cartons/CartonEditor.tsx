"use client";

import { useState } from "react";

import { RECEIPT_CARTON_LABELS as L, RECEIPT_CARTON_LIMITS } from "@/constants";
import {
  cartonUnitOptions,
  countedIntoCartons,
  defaultCartonUnit,
  newCartons,
  unitFactorOf,
} from "@/features/receipt/carton-selectors";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { FieldError } from "../primitives";
import { CartonAddControl } from "./CartonAddControl";
import { CartonRow } from "./CartonRow";
import { CartonUnitPicker } from "./CartonUnitPicker";

import type { LineCartonContext } from "@/features/receipt/carton-selectors";

export interface CartonDraft {
  unitOfMeasure: string;
  packages: { lpn: string; quantity: number }[];
}

export interface CartonEditorErrors {
  unit?: string;
  packages?: string;
  carton: (index: number) => { quantity?: string; lpn?: string };
}

/**
 * Chia một dòng kiểm đếm vào thùng (issue #104, BE spec SCRUM-473 §3): chọn đơn vị, thêm N thùng điền sẵn sức chứa,
 * sửa SL từng thùng, bỏ thùng, xem hàng lẻ còn lại. LPN do BE cấp khi lưu; thùng có LPN bị bỏ sẽ VOID nên phải xác nhận.
 */
export function CartonEditor({
  lineNo,
  quantity,
  value,
  context,
  errors,
  onChange,
}: {
  lineNo: number;
  /** SL nhận của dòng (đơn vị cơ sở). */
  quantity: number;
  value: CartonDraft;
  context: LineCartonContext;
  errors: CartonEditorErrors;
  onChange: (next: CartonDraft) => void;
}) {
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);
  const unit = value.unitOfMeasure || defaultCartonUnit(context) || "";
  const factor = unit ? unitFactorOf(context.units, unit) : null;
  const labelled = value.packages.some((carton) => carton.lpn);
  const counted = countedIntoCartons(value.packages);
  const loose = (Number(quantity) || 0) - counted;
  const nominalOf = (lpn: string) =>
    context.savedPackages.find((saved) => saved.lpn === lpn)?.nominalQty ?? factor;

  const update = (packages: CartonDraft["packages"]) => onChange({ unitOfMeasure: unit, packages });
  const remove = (index: number) => update(value.packages.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <CartonUnitPicker
          lineNo={lineNo}
          options={cartonUnitOptions(context)}
          value={unit}
          disabled={labelled}
          onChange={(next) => onChange({ ...value, unitOfMeasure: next })}
        />
        <CartonAddControl
          lineNo={lineNo}
          factor={factor}
          room={RECEIPT_CARTON_LIMITS.cartonsPerLineMax - value.packages.length}
          onAdd={(count, size) => update([...value.packages, ...newCartons(count, size)])}
        />
      </div>
      <FieldError>{errors.unit}</FieldError>
      {!labelled && <Alert tone="info">{L.lockedHint}</Alert>}
      {value.packages.length > 0 && (
        <ul
          className={`divide-y divide-[var(--table-line)] ${
            value.packages.length > RECEIPT_CARTON_LIMITS.scrollAfter
              ? "max-h-[320px] overflow-y-auto pr-1"
              : ""
          }`}
        >
          {value.packages.map((carton, index) => (
            <CartonRow
              // Thùng mới chưa có khoá ổn định: thứ tự trong danh sách là danh tính của nó tới khi BE cấp LPN
              key={carton.lpn || `new-${index}`}
              label={carton.lpn || L.newCartonLabel(index + 1)}
              lpn={carton.lpn}
              quantity={carton.quantity}
              nominal={carton.lpn ? nominalOf(carton.lpn) : factor}
              errors={errors.carton(index)}
              onQuantity={(next) =>
                update(value.packages.map((c, i) => (i === index ? { ...c, quantity: next } : c)))
              }
              onRemove={() => (carton.lpn ? setPendingRemove(index) : remove(index))}
            />
          ))}
        </ul>
      )}
      <p
        aria-live="polite"
        className={`text-[0.8125rem] tabular-nums ${loose < 0 ? "text-danger" : "text-ink-secondary"}`}
      >
        {L.summary(value.packages.length, counted, loose)}
      </p>
      <FieldError>{errors.packages}</FieldError>
      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => !open && setPendingRemove(null)}
        title={L.confirmRemoveTitle}
        description={L.confirmRemoveDescription(value.packages[pendingRemove ?? -1]?.lpn ?? "")}
        confirmLabel={L.confirmRemoveAction}
        onConfirm={() => {
          if (pendingRemove !== null) remove(pendingRemove);
          setPendingRemove(null);
        }}
      />
    </div>
  );
}
