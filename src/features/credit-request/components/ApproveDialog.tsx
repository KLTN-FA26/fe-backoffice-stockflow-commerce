"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { formatMoney } from "@/lib/format/money";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { creditRequestErrorMessage, useApproveCreditRequest } from "../mutations";
import { approveInputFor } from "../schemas";

import { NumberField, TextAreaField } from "./fields";

import type {
  CreditRequest,
  CreditRequestApproveBody,
  CreditRequestApproveValues,
  CreditRequestReview,
} from "../types";

/**
 * Kế toán duyệt (15 §4.3 bước 11a): hạn mức ≤ mức xin, kỳ hạn; hạn mức của khách được đặt ngay. Gửi kèm
 * `review.creditTermsVersion` (−1 khi khách chưa có hạn mức) — hạn mức vừa bị sửa ở nơi khác → 409 OPTIMISTIC_LOCK.
 */
export function ApproveDialog({
  request,
  review,
  onClose,
}: {
  request: CreditRequest;
  review: CreditRequestReview;
  onClose: () => void;
}) {
  const approve = useApproveCreditRequest();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CreditRequestApproveValues, unknown, CreditRequestApproveBody>({
    resolver: zodResolver(approveInputFor(request.requestedLimit)),
    mode: "onChange",
    defaultValues: {
      approvedLimit: String(request.salesRecommendedLimit ?? request.requestedLimit),
      approvedTermDays: String(request.requestedTermDays),
      note: "",
    },
  });
  const { errors, isValid } = form.formState;
  const submit = form.handleSubmit((body) => {
    setError(null);
    approve.mutate(
      {
        id: request.id,
        version: request.version,
        creditTermsVersion: review.creditTermsVersion,
        body,
      },
      { onSuccess: onClose, onError: (e) => setError(creditRequestErrorMessage(e)) },
    );
  });

  return (
    <FormDialog open onOpenChange={(open) => !open && !approve.isPending && onClose()}>
      <FormDialogBody
        title="Duyệt đề nghị cấp hạn mức"
        description={`Khách xin ${formatMoney(request.requestedLimit, request.currency)}, ${request.requestedTermDays} ngày. Hạn mức và kỳ hạn của khách được cập nhật ngay khi duyệt.`}
        submitLabel="Duyệt"
        canSubmit={isValid}
        isPending={approve.isPending}
        error={error}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="cr-approve-limit"
            label="Hạn mức duyệt (₫)"
            required
            error={errors.approvedLimit?.message}
            register={form.register("approvedLimit")}
          />
          <NumberField
            id="cr-approve-term"
            label="Kỳ hạn (ngày)"
            required
            error={errors.approvedTermDays?.message}
            register={form.register("approvedTermDays")}
          />
        </div>
        <TextAreaField
          id="cr-approve-note"
          label="Ghi chú"
          hint="Không bắt buộc; lưu làm ghi chú hạn mức của khách."
          error={errors.note?.message}
          register={form.register("note")}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
