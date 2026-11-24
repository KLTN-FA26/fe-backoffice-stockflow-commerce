"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

import {
  BUSINESS_DOCUMENT_LABELS,
  BUSINESS_DOCUMENTS,
} from "@/constants/labels-business-documents";
import {
  BUSINESS_DOCUMENT_PATHS,
  businessDocumentErrorMessage,
  downloadBusinessDocument,
} from "@/lib/api/business-documents";
import { saveFile } from "@/lib/api/file-download";
import { useCan } from "@/lib/auth/components/Can";
import { DatePicker } from "@/components/shared/DatePicker";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";

import { todayInVietnam } from "../input-schemas";

const SPEC = BUSINESS_DOCUMENTS.debtReconciliation;
const L = BUSINESS_DOCUMENT_LABELS.reconciliation;

/** Kỳ mặc định: từ đầu tháng này tới hôm nay — đối chiếu công nợ định kỳ theo tháng (tự quyết, xem tu-quyet.md). */
function defaultPeriod(): { from: string; to: string } {
  const today = todayInVietnam();
  return { from: `${today.slice(0, 8)}01`, to: today };
}

/** Kỳ hợp lệ như BE kiểm (400 VALIDATION_FAILED): đủ hai ngày, đến ≥ từ, đến không sau hôm nay. */
export function reconciliationPeriodError(from: string, to: string, today: string): string | null {
  if (!from || !to) return L.required;
  if (to < from || to > today) return L.rangeInvalid;
  return null;
}

function ReconciliationForm({
  customerId,
  customerName,
  onClose,
}: {
  customerId: string;
  customerName: string;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState(defaultPeriod);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayInVietnam();

  const submit = async () => {
    const invalid = reconciliationPeriodError(period.from, period.to, today);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      saveFile(
        await downloadBusinessDocument(
          "debtReconciliation",
          BUSINESS_DOCUMENT_PATHS.debtReconciliation(customerId, period.from, period.to),
        ),
      );
      onClose();
    } catch (failure) {
      setError(businessDocumentErrorMessage("debtReconciliation", failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialogBody
      title={L.dialogTitle}
      description={L.description(customerName)}
      submitLabel={L.submit}
      canSubmit
      isPending={busy}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="reconciliation-from" label={L.from} required>
          <DatePicker
            id="reconciliation-from"
            value={period.from}
            max={today}
            onChange={(from) => setPeriod((current) => ({ ...current, from }))}
          />
        </FormField>
        <FormField id="reconciliation-to" label={L.to} required>
          <DatePicker
            id="reconciliation-to"
            value={period.to}
            max={today}
            onChange={(to) => setPeriod((current) => ({ ...current, to }))}
          />
        </FormField>
      </div>
    </FormDialogBody>
  );
}

/**
 * "Đối chiếu công nợ" của một khách (BE `feat/business-documents` #6, `GET /installments/debt-reconciliation`): chọn kỳ
 * rồi tải biên bản, tên file của BE. Chỉ vai có `payment-installments:READ` thấy nút (Kế toán, Sale, Trưởng phòng KD).
 */
export function DebtReconciliationAction({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const allowed = useCan(SPEC.permission);
  const [open, setOpen] = useState(false);
  if (!allowed) return null;
  return (
    // Nằm trong dòng bảng bấm được: sự kiện của nút và của hộp thoại (portal vẫn nổi bọt theo cây React) không được mở
    // drill-down của dòng
    <span
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button type="button" size="xs" variant="outline" onClick={() => setOpen(true)}>
        <FileDown className="size-3.5" aria-hidden="true" /> {SPEC.label}
      </Button>
      <FormDialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        {open && (
          <ReconciliationForm
            customerId={customerId}
            customerName={customerName}
            onClose={() => setOpen(false)}
          />
        )}
      </FormDialog>
    </span>
  );
}
