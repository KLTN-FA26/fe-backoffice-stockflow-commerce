"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { EINVOICE_LIMITS, EINVOICE_ROUTES } from "@/constants/einvoice";
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
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/format/date";

import { beFieldErrors, externalReductionErrorMessage } from "../errors";
import { externalReductionInputSchema } from "../input-schemas";
import { useRecordExternalReduction } from "../mutations";

import type { ExternalReductionBasis } from "@/constants/einvoice";
import type { EInvoice } from "../types";

type ReductionField =
  | "basis"
  | "returnRequestId"
  | "voidedAdjustmentId"
  | "templateCode"
  | "symbol"
  | "invoiceNumber"
  | "issueDate"
  | "taxAuthorityCode"
  | "lookupCode"
  | "pdf"
  | "xml"
  | "note";
const REDUCTION_FIELDS: readonly ReductionField[] = [
  "basis",
  "returnRequestId",
  "voidedAdjustmentId",
  "templateCode",
  "symbol",
  "invoiceNumber",
  "issueDate",
  "taxAuthorityCode",
  "lookupCode",
  "pdf",
  "xml",
  "note",
];
type FieldErrors = Partial<Record<ReductionField, string>>;

/** Lỗi zod → lỗi từng ô (ô đầu tiên của mỗi trường); lỗi không gắn ô nào trả về `rest`. */
function zodFieldErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const fields: FieldErrors = {};
  let rest: string | null = null;
  for (const issue of issues) {
    const field = REDUCTION_FIELDS.find((known) => known === issue.path[0]);
    if (field) fields[field] ??= issue.message;
    else rest ??= issue.message;
  }
  return { fields, rest };
}

function ExternalReductionForm({ invoice, onClose }: { invoice: EInvoice; onClose: () => void }) {
  const router = useRouter();
  // Audit r2 M-10: chỉ những căn cứ BE nói nhận lúc này (`externalReductionBases`); trả hàng chỉ chọn trong các yêu cầu
  // BE nêu (`externalReductionReturns` — hàng đã hoàn tiền đang chờ giảm trên hoá đơn này, gửi đúng `id`; audit r3 EINV-2:
  // cả hoá đơn gốc của NCC cũ mà bản điều chỉnh trả hàng nháp đã bị huỷ)
  // Audit r3 EINV-2, nửa sai sót: căn cứ ERROR chỉ chọn trong các bản điều chỉnh sai sót đã huỷ BE nêu
  // (`externalReductionErrors`), gửi đúng `voidedAdjustmentId`
  const bases = invoice.externalReductionBases;
  // CF-4 / CF-10: hoá đơn phần còn lại của đơn (không thuộc lần giao nào) — chỉ giảm phí vận chuyển đã miễn, BE tự tính số tiền
  const isRest = !invoice.shipmentId;
  const returns = invoice.externalReductionReturns;
  const errorDrafts = invoice.externalReductionErrors;
  const [symbol, setSymbol] = useState("");
  const [templateCode, setTemplateCode] = useState(invoice.templateCode ?? "1");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [taxAuthorityCode, setTaxAuthorityCode] = useState("");
  const [lookupCode, setLookupCode] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [xml, setXml] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [basis, setBasis] = useState<ExternalReductionBasis>(bases[0] ?? "DELIVERY_FAILED");
  const [returnRequestId, setReturnRequestId] = useState(
    returns.length === 1 ? (returns[0]?.returnRequestId ?? "") : "",
  );
  const [pickedDraft, setPickedDraft] = useState(
    errorDrafts.length === 1 ? (errorDrafts[0]?.voidedAdjustmentId ?? "") : "",
  );
  // Sau 409 dữ liệu được tải lại: bản đã chọn mà BE không còn nêu (đã ghi, hết nhận) thì coi như chưa chọn, không gửi lại
  const voidedAdjustmentId = errorDrafts.some((row) => row.voidedAdjustmentId === pickedDraft)
    ? pickedDraft
    : "";
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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
      voidedAdjustmentId: voidedAdjustmentId || undefined,
    });
    if (!parsed.success) {
      const { fields, rest } = zodFieldErrors(parsed.error.issues);
      setFieldErrors(fields);
      setError(rest);
      return;
    }
    // BE `requireSameSeller`: hoá đơn giảm không mang ngày trước hoá đơn nó giảm (400 không kèm ô nào — chặn ở đây)
    if (invoice.issueDate && parsed.data.issueDate < invoice.issueDate) {
      setFieldErrors({
        issueDate: `Ngày hoá đơn giảm không được trước ngày của hoá đơn bị giảm (${formatDate(invoice.issueDate)}).`,
      });
      setError(null);
      return;
    }
    setFieldErrors({});
    setError(null);
    record.mutate(
      { id: invoice.id, ...parsed.data },
      {
        onSuccess: (reduction) => {
          onClose();
          router.push(EINVOICE_ROUTES.detail(reduction.id));
        },
        onError: (failure) => {
          // BE nêu ô sai (`fieldErrors`: invoiceNumber, issueDate…) → gắn vào ô, câu tiếng Việt của FE
          setFieldErrors(beFieldErrors(failure, REDUCTION_FIELDS));
          setError(externalReductionErrorMessage(failure, parsed.data.basis));
        },
      },
    );
  };

  return (
    <FormDialogBody
      title={`Ghi hoá đơn giảm làm trên cổng nhà cung cấp cho ${invoice.code}`}
      description="Hoá đơn giảm không gửi được qua hệ thống (nhà cung cấp cũ hoặc không điều chỉnh được, hoặc trả hàng / giao thất bại trên hoá đơn thay thế): Kế toán lập trên cổng nhà cung cấp rồi ghi số, ngày và tệp vào đây. Hệ thống đọc tệp XML và đối chiếu mẫu số, ký hiệu, số, ngày đã nhập với tệp trước khi ghi."
      submitLabel="Ghi hoá đơn giảm"
      canSubmit
      isPending={record.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={submit}
    >
      <FormField
        id="reduction-basis"
        label="Căn cứ giảm"
        required
        error={fieldErrors.basis}
        hint={
          isRest
            ? "Hoá đơn này không thuộc lần giao nào: hoá đơn giảm chỉ lấy lại phí vận chuyển đã miễn (hệ thống tự tính số tiền, không lấy phí khuôn) — hoá đơn giảm làm trên cổng phải đúng số đó."
            : undefined
        }
      >
        <Select
          value={basis}
          onValueChange={(value) => setBasis(bases.find((entry) => entry === value) ?? basis)}
        >
          <SelectTrigger id="reduction-basis">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bases.map((value) => (
              <SelectItem key={value} value={value}>
                {isRest && value === "DELIVERY_FAILED"
                  ? "Giao hàng thất bại — phí vận chuyển đã miễn"
                  : EXTERNAL_REDUCTION_BASIS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {basis === "RETURN" && (
        <FormField
          id="reduction-return"
          label="Yêu cầu trả hàng"
          required
          error={fieldErrors.returnRequestId}
          hint={
            returns.length === 0
              ? "Không có yêu cầu trả hàng nào chờ giảm trên hoá đơn này."
              : undefined
          }
        >
          <Select
            value={returnRequestId}
            onValueChange={setReturnRequestId}
            disabled={returns.length === 0}
          >
            <SelectTrigger
              id="reduction-return"
              aria-invalid={fieldErrors.returnRequestId ? true : undefined}
            >
              <SelectValue placeholder="Chọn yêu cầu trả hàng" />
            </SelectTrigger>
            <SelectContent>
              {returns.map((row) => (
                <SelectItem key={row.returnRequestId} value={row.returnRequestId}>
                  {row.rmaNumber ?? row.returnRequestId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}
      {basis === "ERROR" && (
        <FormField
          id="reduction-error"
          label="Bản điều chỉnh sai sót đã huỷ"
          required
          error={fieldErrors.voidedAdjustmentId}
          hint={
            errorDrafts.length === 0
              ? "Không có bản điều chỉnh sai sót nào chờ ghi trên hoá đơn này."
              : "Hệ thống ghi đúng các dòng và văn bản thoả thuận của bản nháp đã huỷ — hoá đơn làm trên cổng phải giảm đúng như vậy."
          }
        >
          <Select
            value={voidedAdjustmentId}
            onValueChange={setPickedDraft}
            disabled={errorDrafts.length === 0}
          >
            <SelectTrigger
              id="reduction-error"
              aria-invalid={fieldErrors.voidedAdjustmentId ? true : undefined}
            >
              <SelectValue placeholder="Chọn bản điều chỉnh sai sót" />
            </SelectTrigger>
            <SelectContent>
              {errorDrafts.map((row) => (
                <SelectItem key={row.voidedAdjustmentId} value={row.voidedAdjustmentId}>
                  {[
                    row.code ?? row.voidedAdjustmentId,
                    row.reason,
                    formatMoney(row.grandTotal, invoice.currency),
                  ]
                    .filter((part): part is string => !!part)
                    .join(" · ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <FormField id="reduction-template" label="Mẫu số" required error={fieldErrors.templateCode}>
          <Input
            id="reduction-template"
            value={templateCode}
            onChange={(event) => setTemplateCode(event.target.value)}
          />
        </FormField>
        <FormField id="reduction-symbol" label="Ký hiệu" required error={fieldErrors.symbol}>
          <Input
            id="reduction-symbol"
            placeholder="C26TAA"
            className="font-mono uppercase"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
          />
        </FormField>
        <FormField
          id="reduction-number"
          label="Số hoá đơn"
          required
          error={fieldErrors.invoiceNumber}
        >
          <Input
            id="reduction-number"
            inputMode="numeric"
            value={invoiceNumber}
            onChange={(event) => setInvoiceNumber(event.target.value)}
          />
        </FormField>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <FormField id="reduction-date" label="Ngày hoá đơn" required error={fieldErrors.issueDate}>
          <DatePicker id="reduction-date" value={issueDate} onChange={setIssueDate} />
        </FormField>
        <FormField
          id="reduction-tax-code"
          label="Mã cơ quan thuế"
          error={fieldErrors.taxAuthorityCode}
        >
          <Input
            id="reduction-tax-code"
            maxLength={EINVOICE_LIMITS.providerCodeMax}
            value={taxAuthorityCode}
            onChange={(event) => setTaxAuthorityCode(event.target.value)}
          />
        </FormField>
        <FormField id="reduction-lookup" label="Mã tra cứu" error={fieldErrors.lookupCode}>
          <Input
            id="reduction-lookup"
            maxLength={EINVOICE_LIMITS.providerCodeMax}
            value={lookupCode}
            onChange={(event) => setLookupCode(event.target.value)}
          />
        </FormField>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField id="reduction-pdf" label="Bản PDF" required error={fieldErrors.pdf}>
          <FilePickerField
            id="reduction-pdf"
            accept="application/pdf"
            fileName={pdf?.name}
            onChange={setPdf}
          />
        </FormField>
        <FormField id="reduction-xml" label="Tệp XML" required error={fieldErrors.xml}>
          <FilePickerField
            id="reduction-xml"
            accept=".xml,application/xml,text/xml"
            fileName={xml?.name}
            onChange={setXml}
          />
        </FormField>
      </div>
      <FormField id="reduction-note" label="Ghi chú" required error={fieldErrors.note}>
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
