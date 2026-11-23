"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { EINVOICE_LIMITS, EINVOICE_ROUTES, EXTERNAL_REDUCTION_BASES } from "@/constants/einvoice";
import { EXTERNAL_REDUCTION_BASIS_LABELS } from "@/constants/labels-einvoice";
import { DatePicker } from "@/components/shared/DatePicker";
import { FilePickerField } from "@/components/shared/FilePickerField";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { einvoiceErrorMessage } from "../errors";
import { externalReductionInputSchema } from "../input-schemas";
import { useRecordExternalReduction } from "../mutations";

import { ReturnRequestPicker } from "./ReturnRequestPicker";

import type { ExternalReductionBasis } from "@/constants/einvoice";
import type { EInvoice } from "../types";

function ExternalReductionForm({ invoice, onClose }: { invoice: EInvoice; onClose: () => void }) {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [templateCode, setTemplateCode] = useState(invoice.templateCode ?? "1");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [taxAuthorityCode, setTaxAuthorityCode] = useState("");
  const [lookupCode, setLookupCode] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [xml, setXml] = useState<File | null>(null);
  const [note, setNote] = useState("");
  // Mặc định như BE (`basis` vắng = DELIVERY_FAILED); hoá đơn thay thế có yêu cầu trả hàng gắn sẵn thì gợi ý RETURN
  const [basis, setBasis] = useState<ExternalReductionBasis>("DELIVERY_FAILED");
  const [returnRequestId, setReturnRequestId] = useState(invoice.returnRequestId ?? "");
  const [error, setError] = useState<string | null>(null);
  const record = useRecordExternalReduction();

  const submit = () => {
    const parsed = externalReductionInputSchema.safeParse({
      symbol,
      templateCode,
      invoiceNumber,
      issueDate,
      taxAuthorityCode,
      lookupCode,
      pdf,
      xml,
      note,
      basis,
      returnRequestId: returnRequestId.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ");
      return;
    }
    setError(null);
    record.mutate(
      { id: invoice.id, ...parsed.data },
      {
        onSuccess: (reduction) => {
          onClose();
          router.push(EINVOICE_ROUTES.detail(reduction.id));
        },
        onError: (failure) => setError(einvoiceErrorMessage(failure)),
      },
    );
  };

  return (
    <FormDialogBody
      title={`Ghi hoá đơn giảm làm trên cổng nhà cung cấp cho ${invoice.code}`}
      description="Hoá đơn giảm không gửi được qua hệ thống (nhà cung cấp cũ, hoặc trả hàng / giao thất bại trên hoá đơn thay thế): Kế toán lập trên cổng nhà cung cấp rồi ghi số, ngày và tệp vào đây. Hệ thống đọc tệp XML và đối chiếu mẫu số, ký hiệu, số, ngày đã nhập với tệp trước khi ghi."
      submitLabel="Ghi hoá đơn giảm"
      canSubmit
      isPending={record.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={submit}
    >
      <FormField id="reduction-basis" label="Căn cứ giảm" required>
        <Select
          value={basis}
          onValueChange={(value) =>
            setBasis(EXTERNAL_REDUCTION_BASES.find((entry) => entry === value) ?? "DELIVERY_FAILED")
          }
        >
          <SelectTrigger id="reduction-basis">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXTERNAL_REDUCTION_BASES.map((value) => (
              <SelectItem key={value} value={value}>
                {EXTERNAL_REDUCTION_BASIS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {basis === "RETURN" && (
        <ReturnRequestPicker
          id="reduction-return"
          orderId={invoice.orderId}
          value={returnRequestId}
          onChange={setReturnRequestId}
        />
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <FormField id="reduction-template" label="Mẫu số" required>
          <Input
            id="reduction-template"
            value={templateCode}
            onChange={(event) => setTemplateCode(event.target.value)}
          />
        </FormField>
        <FormField id="reduction-symbol" label="Ký hiệu" required>
          <Input
            id="reduction-symbol"
            placeholder="C26TAA"
            className="font-mono uppercase"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
          />
        </FormField>
        <FormField id="reduction-number" label="Số hoá đơn" required>
          <Input
            id="reduction-number"
            inputMode="numeric"
            value={invoiceNumber}
            onChange={(event) => setInvoiceNumber(event.target.value)}
          />
        </FormField>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <FormField id="reduction-date" label="Ngày hoá đơn" required>
          <DatePicker id="reduction-date" value={issueDate} onChange={setIssueDate} />
        </FormField>
        <FormField id="reduction-tax-code" label="Mã cơ quan thuế">
          <Input
            id="reduction-tax-code"
            maxLength={EINVOICE_LIMITS.providerCodeMax}
            value={taxAuthorityCode}
            onChange={(event) => setTaxAuthorityCode(event.target.value)}
          />
        </FormField>
        <FormField id="reduction-lookup" label="Mã tra cứu">
          <Input
            id="reduction-lookup"
            maxLength={EINVOICE_LIMITS.providerCodeMax}
            value={lookupCode}
            onChange={(event) => setLookupCode(event.target.value)}
          />
        </FormField>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField id="reduction-pdf" label="Bản PDF" required>
          <FilePickerField
            id="reduction-pdf"
            accept="application/pdf"
            fileName={pdf?.name}
            onChange={setPdf}
          />
        </FormField>
        <FormField id="reduction-xml" label="Tệp XML" required>
          <FilePickerField
            id="reduction-xml"
            accept=".xml,application/xml,text/xml"
            fileName={xml?.name}
            onChange={setXml}
          />
        </FormField>
      </div>
      <FormField id="reduction-note" label="Ghi chú" required>
        <Textarea
          id="reduction-note"
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

/**
 * Ghi hoá đơn giảm làm trên cổng NCC (WF-05 Q-8 / Q-9, BE-10; BE `POST /einvoices/{originalId}/external-reductions`)
 * — lối ra cho bản giảm không gửi được qua hệ thống.
 */
export function ExternalReductionDialog({
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
      {invoice && <ExternalReductionForm invoice={invoice} onClose={onClose} />}
    </FormDialog>
  );
}
