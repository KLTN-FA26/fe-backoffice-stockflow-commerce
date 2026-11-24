"use client";

import { useState } from "react";

import { RETURN_CUSTODY_NOTE_CHOICE_LABELS, RETURN_LABELS } from "@/constants/labels-return";
import {
  RETURN_CUSTODY_NOTE_CHOICES,
  RETURN_LIMITS,
  RETURN_CUSTODY_TAKER_STATUSES,
} from "@/constants/returns";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { formatDateTime } from "@/lib/format/date";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { custodyNoteErrorMessage } from "../errors";
import { canChooseForCustodyNote, canEndCustodyNote } from "../lifecycle";
import { useChooseForCustodyNote, useEndCustodyNote } from "../mutations";
import { useReturns } from "../queries";

import type { ReturnCustodyNoteChoice } from "@/constants/returns";
import type { CustodyOutcome } from "../types";

const C = RETURN_LABELS.detail.custody;
const NOTE_ID = "custody-note-choice-note";
const TAKEN_ID = "custody-note-taken-by";

/** Biên nhận giữ hộ mà thao tác nhắm tới: yêu cầu (và khách của nó), biên nhận, kết cục hiện có, hàng gì. */
export interface CustodyNoteTarget {
  returnId: string;
  rmaNumber: string | null | undefined;
  customerId: string | null | undefined;
  evidenceId: string;
  outcome: CustodyOutcome | null | undefined;
  /** "SKU × số lượng" — câu của hộp thoại ghi rời kho. */
  what: string;
}

/** Yêu cầu bổ sung chọn được: cùng khách, không phải chính yêu cầu này, còn nhận hàng (CF-5: chỉ bốn trạng thái BE nhận). */
function useSupplementaryReturns(target: CustodyNoteTarget, enabled: boolean) {
  const query = useReturns(
    { page: 0, size: 50, customerId: target.customerId ?? undefined },
    { enabled: enabled && !!target.customerId },
  );
  const options = (query.data?.items ?? []).filter(
    (row) =>
      row.id !== target.returnId &&
      (RETURN_CUSTODY_TAKER_STATUSES as readonly string[]).includes(row.status),
  );
  return { options, isPending: query.isPending && !!target.customerId };
}

function ChoiceForm({ target, onClose }: { target: CustodyNoteTarget; onClose: () => void }) {
  const known = RETURN_CUSTODY_NOTE_CHOICES.find((value) => value === target.outcome?.choice);
  const [choice, setChoice] = useState<ReturnCustodyNoteChoice>(known ?? "SEND_BACK");
  const [note, setNote] = useState(target.outcome?.choiceNote ?? "");
  const [takenBy, setTakenBy] = useState(target.outcome?.takenByReturnId ?? "");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [takenError, setTakenError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supplementary = useSupplementaryReturns(target, choice === "TAKEN_BY_RETURN");
  const record = useChooseForCustodyNote();
  const submit = () => {
    // BE `ReturnRequest.chooseForCustody`: huỷ hộ chỉ với biên bản khách đồng ý; nhận trên yêu cầu bổ sung phải nêu yêu cầu
    const missingNote = choice === "DESTROY_ON_BEHALF" && !note.trim();
    const missingReturn = choice === "TAKEN_BY_RETURN" && !takenBy;
    setNoteError(missingNote ? C.choiceNoteRequired : null);
    setTakenError(missingReturn ? C.takenByReturnRequired : null);
    if (missingNote || missingReturn) return;
    record.mutate(
      {
        returnId: target.returnId,
        evidenceId: target.evidenceId,
        choice,
        note,
        takenByReturnId: choice === "TAKEN_BY_RETURN" ? takenBy : undefined,
      },
      {
        onSuccess: onClose,
        onError: (failure) => setError(custodyNoteErrorMessage(failure, "choose")),
      },
    );
  };
  return (
    <FormDialogBody
      title={`${C.choiceTitle}${target.rmaNumber ? ` — ${target.rmaNumber}` : ""}`}
      description={C.choiceHint}
      submitLabel={C.choose}
      canSubmit
      isPending={record.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={submit}
    >
      <FormField id="custody-note-choice" label={C.choice} required>
        <Select
          value={choice}
          onValueChange={(value) =>
            setChoice(RETURN_CUSTODY_NOTE_CHOICES.find((entry) => entry === value) ?? choice)
          }
        >
          <SelectTrigger id="custody-note-choice">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RETURN_CUSTODY_NOTE_CHOICES.map((value) => (
              <SelectItem key={value} value={value}>
                {RETURN_CUSTODY_NOTE_CHOICE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {choice === "TAKEN_BY_RETURN" && (
        <FormField
          id={TAKEN_ID}
          label={C.takenByReturn}
          hint={C.takenByReturnHint}
          required
          error={takenError ?? undefined}
        >
          {!supplementary.isPending && supplementary.options.length === 0 ? (
            <p className="text-ink-tertiary text-[0.8125rem]">{C.noOtherReturn}</p>
          ) : (
            <Select value={takenBy} onValueChange={setTakenBy}>
              <SelectTrigger {...fieldA11y(TAKEN_ID, takenError ?? undefined, true)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supplementary.options.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.rmaNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      )}
      <FormField
        id={NOTE_ID}
        label={C.choiceNote}
        required={choice === "DESTROY_ON_BEHALF"}
        error={noteError ?? undefined}
      >
        <Textarea
          {...fieldA11y(NOTE_ID, noteError ?? undefined)}
          rows={2}
          maxLength={RETURN_LIMITS.reasonMax}
          className={FORM_TEXTAREA_CLASS}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </FormField>
    </FormDialogBody>
  );
}

/**
 * Thao tác trên một biên nhận giữ hộ (audit r3 RAD-3; Q-11 hỏi thêm, TH-6): Sale ghi / đổi lựa chọn của khách (gửi trả, huỷ
 * hộ có biên bản, nhận trên yêu cầu bổ sung) khi hàng còn giữ; Quản lý kho ghi hàng đã rời kho (biên bản bắt buộc, ghi một
 * lần) khi Sale đã ghi lựa chọn. Quyền như BE (`sales-rmas:UPDATE`, `sales-rma-custody:UPDATE`) — BE kiểm lại.
 */
export function CustodyNoteActions({ target }: { target: CustodyNoteTarget }) {
  const can = usePermissionChecker();
  const [choosing, setChoosing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useEndCustodyNote();
  const canChoose = canChooseForCustodyNote(target.outcome, can);
  const canEnd = canEndCustodyNote(target.outcome, can);
  if (!canChoose && !canEnd) return null;
  const closeEnd = () => {
    setEnding(false);
    setError(null);
  };
  const choice = target.outcome?.choice;
  return (
    <span className="inline-flex flex-wrap justify-end gap-1.5">
      {canChoose && (
        <Button type="button" size="xs" variant="outline" onClick={() => setChoosing(true)}>
          {target.outcome ? C.changeChoice : C.choose}
        </Button>
      )}
      {canEnd && (
        <Button type="button" size="xs" variant="outline" onClick={() => setEnding(true)}>
          {C.end}
        </Button>
      )}
      <FormDialog open={choosing} onOpenChange={setChoosing} className="sm:max-w-[560px]">
        {choosing && <ChoiceForm target={target} onClose={() => setChoosing(false)} />}
      </FormDialog>
      {ending && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && closeEnd()}
          title={C.endTitle}
          description={C.endDescription(
            target.what,
            choice ? RETURN_CUSTODY_NOTE_CHOICE_LABELS[choice] : "",
          )}
          confirmLabel={C.end}
          requireReason
          reasonLabel={C.endNote}
          reasonMaxLength={RETURN_LIMITS.reasonMax}
          closeOnConfirm={false}
          loading={end.isPending}
          error={error}
          onConfirm={(note) =>
            end.mutate(
              { returnId: target.returnId, evidenceId: target.evidenceId, note: note ?? "" },
              {
                onSuccess: closeEnd,
                onError: (failure) => setError(custodyNoteErrorMessage(failure, "end")),
              },
            )
          }
        />
      )}
    </span>
  );
}

/** Kết cục của biên nhận: chờ Sale / lựa chọn (kèm yêu cầu bổ sung, biên bản) / đã rời kho. */
export function CustodyOutcomeText({ outcome }: { outcome: CustodyOutcome | null | undefined }) {
  if (!outcome) return <span className="text-ink-tertiary">{C.waitChoice}</span>;
  return (
    <span className="text-ink-secondary">
      {RETURN_CUSTODY_NOTE_CHOICE_LABELS[outcome.choice]}
      {outcome.choice === "TAKEN_BY_RETURN" && outcome.takenByRmaNumber
        ? ` — ${C.takenBy(outcome.takenByRmaNumber)}`
        : ""}
      {outcome.choiceNote ? ` · ${outcome.choiceNote}` : ""}
      {outcome.endedAt && (
        <span className="text-ink-tertiary block">
          {C.endedAt(formatDateTime(outcome.endedAt))}
          {outcome.endedNote ? ` · ${outcome.endedNote}` : ""}
        </span>
      )}
    </span>
  );
}
