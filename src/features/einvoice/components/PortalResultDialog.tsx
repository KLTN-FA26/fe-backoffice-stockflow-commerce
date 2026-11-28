"use client";

import { useState } from "react";

import { EINVOICE_LIMITS, PORTAL_RESULT_OUTCOMES } from "@/constants/einvoice";
import { PORTAL_RESULT_OUTCOME_LABELS } from "@/constants/labels-einvoice";
import { FilePickerField } from "@/components/shared/FilePickerField";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";
import { Textarea } from "@/components/ui/textarea";

import { beFieldErrors, portalResultErrorMessage } from "../errors";
import { portalResultInputSchema } from "../input-schemas";
import { useRecordPortalResult } from "../mutations";

import type { PortalResultOutcome } from "@/constants/einvoice";
import type { PortalResultField } from "../input-schemas";
import type { EInvoice } from "../types";

type FieldErrors = Partial<Record<PortalResultField, string>>;
const PORTAL_RESULT_FIELDS: readonly PortalResultField[] = [
  "invoiceNumber",
  "taxAuthorityCode",
  "lookupCode",
  "xml",
  "pdf",
  "note",
];

/** Lỗi zod → lỗi từng ô (ô đầu tiên của mỗi trường); lỗi không gắn ô nào trả về `rest`. */
function fieldErrorsOf(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const fields: FieldErrors = {};
  let rest: string | null = null;
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && key !== "outcome") {
      const field = key as PortalResultField;
      fields[field] ??= issue.message;
    } else rest ??= issue.message;
  }
  return { fields, rest };
}

function PortalResultForm({ invoice, onClose }: { invoice: EInvoice; onClose: () => void }) {
  const [outcome, setOutcome] = useState<PortalResultOutcome>("ISSUED");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [taxAuthorityCode, setTaxAuthorityCode] = useState("");
  const [lookupCode, setLookupCode] = useState("");
  const [xml, setXml] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const record = useRecordPortalResult();
  const issued = outcome === "ISSUED";

  const submit = () => {
    const parsed = portalResultInputSchema.safeParse({
      outcome,
      invoiceNumber,
      taxAuthorityCode,
      lookupCode,
      xml: issued ? xml : null,
      pdf: issued ? pdf : null,
      note,
    });
    if (!parsed.success) {
      const { fields, rest } = fieldErrorsOf(parsed.error.issues);
      setFieldErrors(fields);
      setError(rest);
      return;
    }
    setFieldErrors({});
    setError(null);
    record.mutate(
      { id: invoice.id, version: invoice.version, ...parsed.data },
      {
        onSuccess: onClose,
        onError: (failure) => {
          // Audit r2 M-2: BE nêu từng ô còn thiếu (`fieldErrors`) — đánh dấu đúng ô, câu tiếng Việt của FE
          setFieldErrors(beFieldErrors(failure, PORTAL_RESULT_FIELDS));
          setError(portalResultErrorMessage(failure, outcome));
        },
      },
    );
  };

  return (
    <FormDialogBody
      title={`Ghi kết quả từ cổng nhà cung cấp cho ${invoice.code}`}
      description="Dùng khi hoá đơn kẹt ở “đang gửi” không có lối ra: Kế toán đã kiểm trên cổng nhà cung cấp và ghi lại kết quả. Hệ thống tra lại nhà cung cấp để đối chiếu số, ký hiệu và ngày; không khớp thì từ chối."
      submitLabel="Ghi kết quả"
      canSubmit
      isPending={record.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={submit}
    >
      <FormField id="portal-outcome" label="Kết quả trên cổng" required>
        <Select value={outcome} onValueChange={(value) => setOutcome(value as PortalResultOutcome)}>
          <SelectTrigger id="portal-outcome">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PORTAL_RESULT_OUTCOMES.map((value) => (
              <SelectItem key={value} value={value}>
                {PORTAL_RESULT_OUTCOME_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {issued && (
        <div className="grid gap-3 md:grid-cols-3">
          <FormField
            id="portal-number"
            label="Số hoá đơn"
            required
            error={fieldErrors.invoiceNumber}
          >
            <Input
              {...fieldA11y("portal-number", fieldErrors.invoiceNumber)}
              inputMode="numeric"
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value)}
            />
          </FormField>
          <FormField
            id="portal-tax-code"
            label="Mã cơ quan thuế"
            required
            error={fieldErrors.taxAuthorityCode}
          >
            <Input
              {...fieldA11y("portal-tax-code", fieldErrors.taxAuthorityCode)}
              maxLength={EINVOICE_LIMITS.providerCodeMax}
              value={taxAuthorityCode}
              onChange={(event) => setTaxAuthorityCode(event.target.value)}
            />
          </FormField>
          <FormField id="portal-lookup" label="Mã tra cứu" required error={fieldErrors.lookupCode}>
            <Input
              {...fieldA11y("portal-lookup", fieldErrors.lookupCode)}
              maxLength={EINVOICE_LIMITS.providerCodeMax}
              value={lookupCode}
              onChange={(event) => setLookupCode(event.target.value)}
            />
          </FormField>
        </div>
      )}
      {issued && (
        <div className="grid gap-3 md:grid-cols-2">
          <FormField id="portal-xml" label="Tệp XML của hoá đơn" required error={fieldErrors.xml}>
            <FilePickerField
              {...fieldA11y("portal-xml", fieldErrors.xml)}
              accept=".xml,application/xml,text/xml"
              fileName={xml?.name}
              onChange={setXml}
            />
          </FormField>
          <FormField id="portal-pdf" label="Bản PDF" required error={fieldErrors.pdf}>
            <FilePickerField
              {...fieldA11y("portal-pdf", fieldErrors.pdf)}
              accept="application/pdf"
              fileName={pdf?.name}
              onChange={setPdf}
            />
          </FormField>
        </div>
      )}
      <FormField
        id="portal-note"
        label="Đã kiểm gì trên cổng nhà cung cấp"
        required
        error={fieldErrors.note}
      >
        <Textarea
          {...fieldA11y("portal-note", fieldErrors.note)}
          rows={2}
          maxLength={EINVOICE_LIMITS.noteMax}
          className={FORM_TEXTAREA_CLASS}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </FormField>
    </FormDialogBody>
  );
}

/** Ghi kết quả từ cổng NCC cho hoá đơn kẹt "đang gửi" (WF-05 Q-8, BE-08; BE `POST /einvoices/{id}/portal-result`). */
export function PortalResultDialog({
  invoice,
  onClose,
}: {
  invoice: EInvoice | null;
  onClose: () => void;
}) {
  return (
    <FormDialog
      open={invoice !== null}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-[640px]"
    >
      {invoice && <PortalResultForm invoice={invoice} onClose={onClose} />}
    </FormDialog>
  );
}
