"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CORRECTION_BASES, EINVOICE_LIMITS, EINVOICE_ROUTES } from "@/constants/einvoice";
import { CORRECTION_BASIS_LABELS } from "@/constants/labels-einvoice";
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
import { adjustInputSchema, replaceInputSchema } from "../input-schemas";
import { useAdjustEInvoice, useReplaceEInvoice } from "../mutations";

import { CorrectionLinesEditor, draftLinesOf, toCorrectionLines } from "./CorrectionLinesEditor";

import type { CorrectionBasis } from "@/constants/einvoice";
import type { EInvoice } from "../types";

type Mode = "adjust" | "replace";

const INTRO: Record<Mode, string> = {
  adjust:
    "Lập nháp hoá đơn điều chỉnh tham chiếu hoá đơn gốc (TT 91/2026 Điều 10). Trả hàng và chiết khấu chỉ điều chỉnh giảm (số âm). Điều chỉnh vì sai sót cần văn bản thoả thuận với bên mua trước khi phát hành.",
  replace:
    "Lập nháp hoá đơn thay thế ghi lại toàn bộ nội dung; hoá đơn gốc hết hiệu lực khi hoá đơn thay thế được phát hành. Mỗi hoá đơn chỉ thay thế một lần và không thay thế được hoá đơn đã điều chỉnh (BR-08).",
};

function CorrectionForm({
  invoice,
  mode,
  onClose,
}: {
  invoice: EInvoice;
  mode: Mode;
  onClose: () => void;
}) {
  const router = useRouter();
  const [basis, setBasis] = useState<CorrectionBasis>("ERROR");
  const [reason, setReason] = useState("");
  const [returnRequestId, setReturnRequestId] = useState(invoice.returnRequestId ?? "");
  const [lines, setLines] = useState(() => draftLinesOf(invoice.lines, mode));
  const [error, setError] = useState<string | null>(null);
  const adjust = useAdjustEInvoice();
  const replace = useReplaceEInvoice();
  const priced = mode === "replace" || basis === "ERROR";
  const done = {
    onSuccess: (draft: EInvoice) => {
      onClose();
      router.push(EINVOICE_ROUTES.detail(draft.id));
    },
    onError: (failure: unknown) => setError(einvoiceErrorMessage(failure)),
  };

  const submit = () => {
    const corrected = toCorrectionLines(lines, priced);
    const invalid = (issue?: { message: string }) =>
      setError(issue?.message ?? "Dữ liệu chưa hợp lệ");
    if (mode === "adjust") {
      const parsed = adjustInputSchema.safeParse({
        basis,
        reason,
        lines: corrected,
        returnRequestId: basis === "RETURN" ? returnRequestId.trim() || undefined : undefined,
      });
      if (!parsed.success) return invalid(parsed.error.issues[0]);
      setError(null);
      adjust.mutate({ id: invoice.id, ...parsed.data }, done);
      return;
    }
    const parsed = replaceInputSchema.safeParse({ reason, lines: corrected });
    if (!parsed.success) return invalid(parsed.error.issues[0]);
    setError(null);
    replace.mutate({ id: invoice.id, ...parsed.data }, done);
  };

  return (
    <FormDialogBody
      title={`${mode === "adjust" ? "Lập điều chỉnh" : "Lập thay thế"} cho ${invoice.code}`}
      description={INTRO[mode]}
      submitLabel="Lập nháp"
      canSubmit
      isPending={adjust.isPending || replace.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={submit}
    >
      {mode === "adjust" && (
        <FormField id="correction-basis" label="Căn cứ điều chỉnh" required>
          <Select value={basis} onValueChange={(value) => setBasis(value as CorrectionBasis)}>
            <SelectTrigger id="correction-basis">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CORRECTION_BASES.map((value) => (
                <SelectItem key={value} value={value}>
                  {CORRECTION_BASIS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}
      {mode === "adjust" && basis === "RETURN" && (
        <FormField id="correction-return" label="Mã yêu cầu trả hàng" required>
          <Input
            id="correction-return"
            value={returnRequestId}
            onChange={(event) => setReturnRequestId(event.target.value)}
          />
        </FormField>
      )}
      <FormField id="correction-reason" label="Lý do" required>
        <Textarea
          id="correction-reason"
          rows={2}
          maxLength={EINVOICE_LIMITS.reasonMax}
          className={FORM_TEXTAREA_CLASS}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
      <CorrectionLinesEditor
        lines={invoice.lines}
        value={lines}
        onChange={setLines}
        mode={mode}
        priced={priced}
      />
    </FormDialogBody>
  );
}

/** Lập điều chỉnh / thay thế hoá đơn đã phát hành (docs 21 §4.4; BE `/adjustments`, `/replacements`). */
export function CorrectionDialog({
  invoice,
  mode,
  onClose,
}: {
  invoice: EInvoice;
  mode: Mode | null;
  onClose: () => void;
}) {
  return (
    <FormDialog
      open={mode !== null}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-[760px]"
    >
      {mode && <CorrectionForm invoice={invoice} mode={mode} onClose={onClose} />}
    </FormDialog>
  );
}
