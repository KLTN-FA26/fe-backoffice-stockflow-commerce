"use client";

import { useState } from "react";

import { SALES_CONTRACT_PERMISSIONS, SHORTAGE_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { formatDate } from "@/lib/format/date";
import { suggestedWindowEnd } from "@/lib/domain/shortage-card";
import { DatePicker } from "@/components/shared/DatePicker";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField } from "@/components/shared/FormField";

import { useExecuteShortageWait } from "../../shortage-card-mutations";
import { useOrderActionDialog } from "../useOrderActionDialog";

import { ExecuteButton, SHORTAGE_EXECUTE_ACTION } from "./ShortageExecuteButton";

import type { ShortageExecuteProps } from "./ShortageExecuteButton";

const L = SHORTAGE_LABELS;

/**
 * "Chờ sản xuất phần thiếu" (docs 17 §4.14 bước 58, D48): gỡ treo, huỷ dòng thiếu, báo Quản lý kho + Điều phối sản xuất.
 * Khi ngày dự kiến của thẻ sau cửa sổ giao (`afterWindow`) thì có thêm "Dời cửa sổ giao tới ngày dự kiến" — hộp tick sẵn,
 * ngày bắt đầu = ngày dự kiến của thẻ (BE bắt khớp đúng), ngày kết thúc gợi ý = ngày dự kiến + độ dài cửa sổ hiện tại, Sale
 * sửa được; bằng chứng là chính thẻ. UI-only — Backend phải re-check (BR-28, `sales-contracts:UPDATE` khi dời).
 */
export function ShortageWaitAction({ order, card, allowed }: ShortageExecuteProps) {
  const dialog = useOrderActionDialog(SHORTAGE_EXECUTE_ACTION);
  const { mutate, isPending } = useExecuteShortageWait(dialog.hookOptions);
  const canMove = useCan(SALES_CONTRACT_PERMISSIONS.update);
  const option = card.options.find((o) => o.option === "WAIT_FOR_PRODUCTION");
  const expected = option?.expectedDeliveryDate ?? null;
  const offerMove = !!option?.afterWindow && !!expected;
  const suggested = expected
    ? suggestedWindowEnd(expected, card.batch.windowFrom, card.batch.windowTo)
    : "";
  const [move, setMove] = useState(true);
  const [windowEnd, setWindowEnd] = useState(suggested);
  const moving = offerMove && canMove && move;
  const C = L.confirm;
  const M = L.moveWindow;

  return (
    <>
      <ExecuteButton
        option="WAIT_FOR_PRODUCTION"
        allowed={allowed}
        onClick={() => {
          setMove(true);
          setWindowEnd(suggested);
          dialog.show();
        }}
      />
      {dialog.open && (
        <FormDialog open onOpenChange={(open) => !open && !isPending && dialog.close()}>
          <FormDialogBody
            title={C.waitTitle}
            description={C.waitLines[0] ?? ""}
            submitLabel={C.submit}
            canSubmit={!moving || windowEnd.length > 0}
            isPending={isPending}
            error={dialog.error}
            onCancel={dialog.close}
            onSubmit={() =>
              dialog.submit(mutate, {
                orderId: order.orderId,
                cardId: card.cardId,
                version: card.version,
                moveWindow: moving,
                windowEnd: moving ? windowEnd : undefined,
              })
            }
          >
            <ul className="text-ink-secondary list-disc space-y-1 pl-5 text-[0.8125rem]">
              {C.waitLines.slice(1).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {offerMove && expected && (
              <div className="border-border-default space-y-3 rounded-[var(--r-sm)] border p-3">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={moving}
                    disabled={!canMove}
                    onChange={(event) => setMove(event.target.checked)}
                    className="accent-brand mt-1"
                  />
                  <span className="text-ink-primary text-[0.8125rem] font-medium">
                    {M.toggle(formatDate(expected))}
                  </span>
                </label>
                {!canMove && <p className="text-ink-secondary text-xs">{L.blockedNoPermission}</p>}
                {moving && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField id="shortage-window-start" label={M.startLabel}>
                      <input
                        id="shortage-window-start"
                        readOnly
                        value={formatDate(expected)}
                        className={FORM_INPUT_CLASS}
                      />
                    </FormField>
                    <FormField
                      id="shortage-window-end"
                      label={M.endLabel}
                      required
                      hint={M.endHint}
                      error={windowEnd ? undefined : M.endRequired}
                    >
                      <DatePicker
                        id="shortage-window-end"
                        value={windowEnd}
                        min={expected}
                        onChange={setWindowEnd}
                      />
                    </FormField>
                  </div>
                )}
              </div>
            )}
          </FormDialogBody>
        </FormDialog>
      )}
    </>
  );
}
