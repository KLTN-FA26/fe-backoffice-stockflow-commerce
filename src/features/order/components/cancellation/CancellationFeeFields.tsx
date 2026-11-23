"use client";

import { useId } from "react";

import { CANCELLATION_REQUEST_LABELS, ORDER_LIMITS } from "@/constants";
import { formatMoney } from "@/lib/format";
import { FORM_INPUT_CLASS, FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { fieldA11y } from "@/components/shared/FormField";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { ReasonDialogErrors } from "../useReasonDialogValidation";
import type { CancellationFeeMode, CancellationFeeState } from "./useCancellationFee";

const L = CANCELLATION_REQUEST_LABELS.fee;
const MODES: readonly { mode: CancellationFeeMode; label: string }[] = [
  { mode: "none", label: L.none },
  { mode: "percent", label: L.percent },
  { mode: "agreed", label: L.agreed },
];

/** Số đã thu và đã in hàng loạt chưa (R5-6) — mỗi số vắng là "không biết", không phải 0 / chưa in. */
export interface CancellationFeeFacts {
  paidTotal?: number | null;
  printingStarted?: boolean | null;
  currency: string;
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} role="alert" className="text-danger mt-1 text-xs">
      {message}
    </p>
  );
}

/**
 * Phí giữ lại khi duyệt huỷ (docs 17 §4.8 bước 30): mặc định hoàn toàn bộ; chỉ khi Đơn sản xuất đã in hàng loạt mới giữ
 * được phí. BO-UX-35: khi BE cho biết (R5-6) thì hiện số khách đã trả và mốc in, và khoá hai lựa chọn có phí khi chưa in;
 * không biết thì để BE quyết (409 CANCELLATION_FEE_BEFORE_PRINTING). Lỗi gắn vào ô qua `fieldA11y`.
 */
export function CancellationFeeFields({
  fee,
  errors,
  facts,
}: {
  fee: CancellationFeeState;
  errors: ReasonDialogErrors;
  facts?: CancellationFeeFacts;
}) {
  const baseId = useId();
  const amountId = `${baseId}-amount`;
  const reasonId = `${baseId}-reason`;
  const detailId = `${baseId}-detail`;
  const percentId = `${baseId}-percent`;
  const notPrinted = facts?.printingStarted === false;
  const paid = facts?.paidTotal;
  return (
    <fieldset className="border-border-default space-y-3 rounded-[var(--r-sm)] border p-3">
      <legend className="text-ink-primary px-1 text-[0.8125rem] font-medium">{L.legend}</legend>
      {(paid != null || facts?.printingStarted != null) && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.8125rem]">
          {paid != null && facts && (
            <>
              <dt className="text-ink-secondary">{L.paid}</dt>
              <dd className="text-ink-primary font-mono tabular-nums">
                {formatMoney(paid, facts.currency)}
              </dd>
            </>
          )}
          {facts?.printingStarted != null && (
            <>
              <dt className="text-ink-secondary">{L.production}</dt>
              <dd className="text-ink-primary">
                {facts.printingStarted ? L.printed : L.notPrinted}
              </dd>
            </>
          )}
        </dl>
      )}
      <div className="space-y-1.5">
        {MODES.map(({ mode, label }) => {
          const blocked = notPrinted && mode !== "none";
          return (
            <label
              key={mode}
              className={`flex items-center gap-2 ${blocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <input
                type="radio"
                name={`${baseId}-mode`}
                checked={fee.mode === mode}
                disabled={blocked}
                onChange={() => fee.setMode(mode)}
                className="accent-brand"
              />
              <span className="text-ink-primary text-[0.8125rem]">{label}</span>
            </label>
          );
        })}
      </div>
      <p className="text-ink-secondary text-xs">{notPrinted ? L.notPrintedHint : L.hint}</p>
      {fee.mode === "percent" && (
        <div>
          <Label htmlFor={percentId} className="text-[0.8125rem]">
            {L.percentLabel} <span className="text-danger">*</span>
          </Label>
          <Input
            type="number"
            step={ORDER_LIMITS.percentInputStep}
            inputMode="decimal"
            value={fee.percent}
            onChange={(event) => fee.setPercent(event.target.value)}
            {...fieldA11y(percentId, errors.retainedPercent)}
            className={`${FORM_INPUT_CLASS} mt-1 w-28 tabular-nums`}
          />
          <FieldError id={percentId} message={errors.retainedPercent} />
        </div>
      )}
      {fee.mode === "agreed" && (
        <div className="space-y-3">
          <div>
            <Label htmlFor={amountId} className="text-[0.8125rem]">
              {L.amountLabel} <span className="text-danger">*</span>
            </Label>
            <MoneyInput
              value={fee.amount}
              onChange={fee.setAmount}
              echo
              className="mt-1"
              {...fieldA11y(amountId, errors["agreedFee.amount"])}
            />
            <FieldError id={amountId} message={errors["agreedFee.amount"]} />
          </div>
          <div>
            <Label htmlFor={reasonId} className="text-[0.8125rem]">
              {L.reasonLabel} <span className="text-danger">*</span>
            </Label>
            <Input
              type="text"
              value={fee.reason}
              maxLength={ORDER_LIMITS.feeReasonMax}
              onChange={(event) => fee.setReason(event.target.value)}
              {...fieldA11y(reasonId, errors["agreedFee.reason"])}
              className={`${FORM_INPUT_CLASS} mt-1`}
            />
            <FieldError id={reasonId} message={errors["agreedFee.reason"]} />
          </div>
          <div>
            <Label htmlFor={detailId} className="text-[0.8125rem]">
              {L.detailLabel} <span className="text-danger">*</span>
            </Label>
            <Textarea
              rows={3}
              value={fee.detail}
              maxLength={ORDER_LIMITS.feeDetailMax}
              onChange={(event) => fee.setDetail(event.target.value)}
              {...fieldA11y(detailId, errors["agreedFee.detail"])}
              className={`${FORM_TEXTAREA_CLASS} mt-1 max-h-40 min-h-20 resize-none`}
            />
            <FieldError id={detailId} message={errors["agreedFee.detail"]} />
          </div>
        </div>
      )}
      <FieldError id={`${baseId}-fee`} message={errors.agreedFee} />
    </fieldset>
  );
}
