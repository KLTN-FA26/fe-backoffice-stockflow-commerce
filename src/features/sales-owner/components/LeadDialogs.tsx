"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { SALES_OWNER_LIMITS } from "@/constants/sales-owner";

import { suggestLeastLoaded, toSalesOption } from "@/lib/references/sales-workload";

import { SalesPickerField } from "@/components/backoffice/SalesPickerField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Textarea } from "@/components/ui/textarea";

import { leadErrorMessage } from "../errors";
import { leadAssignInputSchema } from "../inputs";
import { useAssignLead, useContactLead, useDisqualifyLead } from "../mutations";

import type { SalesWorkloadRow } from "@/lib/references/sales-workload";
import type { Lead } from "../types";

/**
 * Giao lead (§10.4, §10.7): điền sẵn Sale còn trống nhất trong số Sale không tạm dừng (`suggestLeastLoaded`) — quản lý
 * vẫn đổi được.
 */
export function LeadAssignDialog({
  lead,
  workload,
  onClose,
}: {
  lead: Lead;
  workload: readonly SalesWorkloadRow[];
  onClose: () => void;
}) {
  const assign = useAssignLead();
  const [error, setError] = useState<string | null>(null);
  const suggested = suggestLeastLoaded(workload);
  const form = useForm<{ salesUserId: string }>({
    resolver: zodResolver(leadAssignInputSchema),
    defaultValues: { salesUserId: lead.assignedTo ? "" : (suggested?.userId ?? "") },
  });
  const submit = form.handleSubmit(({ salesUserId }) => {
    setError(null);
    assign.mutate(
      { id: lead.id, salesUserId },
      { onSuccess: onClose, onError: (e) => setError(leadErrorMessage(e)) },
    );
  });
  return (
    <FormDialog open onOpenChange={(open) => !open && !assign.isPending && onClose()}>
      <FormDialogBody
        title="Giao khách tiềm năng"
        description={`${lead.companyName}: Sale được giao liên hệ, xác minh doanh nghiệp rồi tạo tài khoản; người đó thành người phụ trách khách.`}
        submitLabel="Giao"
        canSubmit
        isPending={assign.isPending}
        error={error}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        <Controller
          control={form.control}
          name="salesUserId"
          render={({ field }) => (
            <SalesPickerField
              id="lead-assign-sales"
              label="Sale nhận"
              required
              value={field.value}
              onChange={field.onChange}
              options={workload.filter((row) => row.userId !== lead.assignedTo).map(toSalesOption)}
              suggestedId={suggested?.userId}
              hint={
                suggested ? `Gợi ý: ${suggested.name} (ít khách nhất, không tạm dừng).` : undefined
              }
              error={form.formState.errors.salesUserId?.message}
            />
          )}
        />
      </FormDialogBody>
    </FormDialog>
  );
}

/** Sale đánh dấu đã liên hệ (§10.7) — ghi chú tuỳ ý. */
export function LeadContactDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const contact = useContactLead();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const tooLong = note.trim().length > SALES_OWNER_LIMITS.textMax;
  const noteError = tooLong ? "Tối đa 1000 ký tự" : undefined;
  return (
    <FormDialog open onOpenChange={(open) => !open && !contact.isPending && onClose()}>
      <FormDialogBody
        title="Đã liên hệ khách tiềm năng"
        description={`${lead.companyName}${lead.phone ? ` · ${lead.phone}` : ""}`}
        submitLabel="Lưu"
        canSubmit={!tooLong}
        isPending={contact.isPending}
        error={error}
        onSubmit={() => {
          setError(null);
          contact.mutate(
            { id: lead.id, note },
            { onSuccess: onClose, onError: (e) => setError(leadErrorMessage(e)) },
          );
        }}
        onCancel={onClose}
      >
        <FormField id="lead-contact-note" label="Ghi chú" error={noteError}>
          <Textarea
            {...fieldA11y("lead-contact-note", noteError)}
            rows={3}
            className={FORM_TEXTAREA_CLASS}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
      </FormDialogBody>
    </FormDialog>
  );
}

/** Loại lead (§10.7: lý do bắt buộc khi loại) — quản lý hoặc Sale được giao. */
export function LeadDisqualifyDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const disqualify = useDisqualifyLead();
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && !disqualify.isPending && onClose()}
      title="Loại khách tiềm năng"
      description={`${lead.companyName} sẽ không được giao / liên hệ tiếp.`}
      confirmLabel="Loại"
      requireReason
      reasonLabel="Lý do loại"
      reasonMaxLength={SALES_OWNER_LIMITS.textMax}
      closeOnConfirm={false}
      loading={disqualify.isPending}
      error={error}
      onConfirm={(reason) =>
        disqualify.mutate(
          { id: lead.id, reason: reason ?? "" },
          { onSuccess: onClose, onError: (e) => setError(leadErrorMessage(e)) },
        )
      }
    />
  );
}
