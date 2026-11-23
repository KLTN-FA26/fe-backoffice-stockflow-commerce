"use client";

import { useState } from "react";

import { RETURN_CUSTODY_CHOICE_LABELS, RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_CUSTODY_CHOICES, RETURN_LIMITS } from "@/constants/returns";
import { Card } from "@/components/shared/Card";
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

import { custodyChoiceErrorMessage } from "../errors";
import { useRecordCustodyChoice } from "../mutations";

import { CustomerCustodyCartons } from "./CustomerCustodyCartons";
import { InfoList, InfoRow, When } from "./primitives";

import type { ReturnCustodyChoice } from "@/constants/returns";
import type { ReturnRequest } from "../types";

const C = RETURN_LABELS.detail.custodyChoice;
const NOTE_ID = "custody-choice-note";

function ChoiceForm({ ret, onClose }: { ret: ReturnRequest; onClose: () => void }) {
  const known = RETURN_CUSTODY_CHOICES.find((value) => value === ret.custodyChoice);
  const [choice, setChoice] = useState<ReturnCustodyChoice>(known ?? "SEND_BACK");
  const [note, setNote] = useState(ret.custodyChoiceNote ?? "");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const record = useRecordCustodyChoice();
  const submit = () => {
    // BE `recordCustodyChoice`: huỷ hộ chỉ khi có biên bản khách đồng ý (VALIDATION_FAILED nếu thiếu)
    if (choice === "DESTROY_ON_BEHALF" && !note.trim()) {
      setNoteError(C.noteRequired);
      return;
    }
    setNoteError(null);
    record.mutate(
      { id: ret.id, version: ret.version, choice, note },
      { onSuccess: onClose, onError: (failure) => setError(custodyChoiceErrorMessage(failure)) },
    );
  };
  return (
    <FormDialogBody
      title={`${C.record} — ${ret.rmaNumber}`}
      description={C.hint}
      submitLabel={C.submit}
      canSubmit
      isPending={record.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={submit}
    >
      <FormField id="custody-choice" label={C.choice} required>
        <Select
          value={choice}
          onValueChange={(value) =>
            setChoice(RETURN_CUSTODY_CHOICES.find((entry) => entry === value) ?? choice)
          }
        >
          <SelectTrigger id="custody-choice">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RETURN_CUSTODY_CHOICES.map((value) => (
              <SelectItem key={value} value={value}>
                {RETURN_CUSTODY_CHOICE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        id={NOTE_ID}
        label={C.note}
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
 * Hàng của khách giữ hộ sau một yêu cầu không hoàn tiền (WF-05 Q-4, audit r2 returns H1): lựa chọn của khách Sale đã ghi
 * (`custodyChoice`), nút ghi / đổi lựa chọn (`canRecord`, chỉ khi kho chưa thực hiện — BE từ chối sau đó), và các thùng
 * đang giữ hộ của yêu cầu. Chỉ hiện với yêu cầu đã ghi lựa chọn hoặc có thể ghi.
 */
export function ReturnCustodyChoiceCard({
  ret,
  canRecord,
}: {
  ret: ReturnRequest;
  canRecord: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!canRecord && !ret.custodyChoice) return null;
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ink-primary text-sm font-semibold">{C.title}</h2>
        {canRecord && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {ret.custodyChoice ? C.change : C.record}
          </Button>
        )}
      </div>
      <p className="text-ink-secondary text-xs">{C.hint}</p>
      {ret.custodyChoice ? (
        <InfoList>
          <InfoRow label={C.choice}>{RETURN_CUSTODY_CHOICE_LABELS[ret.custodyChoice]}</InfoRow>
          {ret.custodyChoiceNote && <InfoRow label={C.note}>{ret.custodyChoiceNote}</InfoRow>}
          {ret.custodyChoiceAt && (
            <InfoRow label={C.recordedAt}>
              <When iso={ret.custodyChoiceAt} />
            </InfoRow>
          )}
        </InfoList>
      ) : (
        <p className="text-ink-tertiary text-[0.8125rem]">{C.none}</p>
      )}
      <CustomerCustodyCartons returnRequestId={ret.id} />
      <FormDialog open={open} onOpenChange={setOpen} className="sm:max-w-[560px]">
        {open && <ChoiceForm ret={ret} onClose={() => setOpen(false)} />}
      </FormDialog>
    </Card>
  );
}
