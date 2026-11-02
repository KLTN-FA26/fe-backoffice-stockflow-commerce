"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { RECEIPT_CARTON_LABELS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { qcDecidableCartons } from "@/features/receipt/carton-selectors";
import { qcCartonFieldErrors, receiptErrorMessage } from "@/features/receipt/errors";
import { useInspectLine } from "@/features/receipt/mutations";
import { toQcDecisionRequest } from "@/features/receipt/qc-api";
import { buildQcDecisionSchema, defaultCartonOutcomes } from "@/features/receipt/qc-input-schemas";
import { movedToQcQuantity } from "@/features/receipt/selectors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { QcCartonChoices } from "../cartons/QcCartonChoices";
import { FieldError } from "../primitives";
import { QcPartFields } from "./QcPartFields";
import { ReceiptDialog } from "./ReceiptDialog";

import type {
  QcDecisionFormInput,
  QcDecisionValues,
  ReceiptLineDto,
} from "@/features/receipt/types";

const L = RECEIPT_CARTON_LABELS;
const EMPTY_PART = { quantity: 0, locationCode: "", reason: "" };

/**
 * Docs 03 bước 8–9 (BR-08): chia SL đã chuyển sang khu QC thành Đạt / Cách ly / Không đạt. SCRUM-473: thùng kết luận
 * nguyên thùng theo LPN, hàng lẻ chia theo SL. Tổng hiện realtime; phần cách ly / không đạt cần khu và lý do.
 * `line` luôn là dòng mới nhất của phiếu (ReceiptDetail đọc theo id) — sau khi tải lại, thùng đã rời khu QC hết chọn được.
 */
export function InspectDialog({
  receiptId,
  line,
  onClose,
}: {
  receiptId: string;
  line: ReceiptLineDto;
  onClose: () => void;
}) {
  const moved = movedToQcQuantity(line);
  const hasCartons = line.packages.length > 0;
  const schema = useMemo(() => buildQcDecisionSchema(line), [line]);
  const form = useForm<QcDecisionFormInput, unknown, QcDecisionValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      accepted: line.looseQuantity,
      quarantined: EMPTY_PART,
      rejected: EMPTY_PART,
      cartons: defaultCartonOutcomes(line),
    },
    mode: "onChange",
  });
  const inspect = useInspectLine();
  const [serverError, setServerError] = useState<string | null>(null);
  const [cartonErrors, setCartonErrors] = useState<Record<string, string>>({});
  const errors = form.formState.errors;
  const values = useWatch({ control: form.control });
  // Mỗi thùng thuộc đúng một phần → tổng = phần lẻ của ba phần + mọi thùng
  const total =
    (Number(values.accepted) || 0) +
    (Number(values.quarantined?.quantity) || 0) +
    (Number(values.rejected?.quantity) || 0) +
    line.packages.reduce((sum, carton) => sum + carton.receivedQty, 0);

  const submit = form.handleSubmit((values) => {
    const decision = { ...values, cartons: qcDecidableCartons(values.cartons, line) };
    inspect.mutate(
      { receiptId, lineId: line.id, line, decision },
      {
        onSuccess: onClose,
        onError: (error) => {
          setServerError(receiptErrorMessage(error));
          if (!(error instanceof ApiError)) return;
          const sent = toQcDecisionRequest(decision, line);
          setCartonErrors(
            Object.fromEntries(qcCartonFieldErrors(error, sent).map((e) => [e.lpn, e.message])),
          );
        },
      },
    );
  });

  return (
    <ReceiptDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={UI_LABELS.receipt.action.inspect}
      description={`${line.sku ?? ""}${line.lotNumber ? ` — lô ${line.lotNumber}` : ""}: ${moved} đơn vị đang ở khu QC ${line.qcLocationCode ?? ""}${hasCartons ? ` (${L.cellSummary(line.packages.length, line.looseQuantity)})` : ""}.`}
      submitLabel={UI_LABELS.receipt.action.inspect}
      isPending={inspect.isPending}
      error={serverError}
      onEdit={() => {
        setServerError(null);
        setCartonErrors({});
      }}
      onSubmit={() => void submit()}
    >
      {hasCartons && <QcCartonChoices line={line} control={form.control} errors={cartonErrors} />}
      <div>
        <Label htmlFor="qc-accepted" className="text-[0.8125rem]">
          {hasCartons ? L.qcLooseAccepted : L.qcOutcome.ACCEPTED}
        </Label>
        <Input
          id="qc-accepted"
          type="number"
          min={0}
          autoFocus
          className="border-border-default bg-bg-surface mt-1 h-8 w-32 rounded-[var(--r-sm)] text-right text-[0.8125rem] tabular-nums"
          aria-invalid={errors.accepted ? true : undefined}
          aria-describedby={errors.accepted ? "qc-sum-error" : undefined}
          {...form.register("accepted", { valueAsNumber: true })}
        />
      </div>
      <QcPartFields loose={hasCartons} register={form.register} errors={errors} />
      <p
        className={`text-[0.8125rem] tabular-nums ${total === moved ? "text-ink-secondary" : "text-danger"}`}
        aria-live="polite"
      >
        {L.qcTotal(total, moved)}
      </p>
      <FieldError id="qc-sum-error">{errors.accepted?.message}</FieldError>
    </ReceiptDialog>
  );
}
