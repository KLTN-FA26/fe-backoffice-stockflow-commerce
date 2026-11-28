"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { creditRequestErrorMessage, useRecommendCreditRequest } from "../mutations";
import { creditRequestRecommendInput } from "../schemas";

import { NumberField, TextAreaField } from "./fields";

import type {
  CreditRequest,
  CreditRequestRecommendBody,
  CreditRequestRecommendValues,
} from "../types";

/** Sale ghi ý kiến cho đề nghị khách gửi (SUBMITTED → PENDING_APPROVAL; 15 §4.3 bước 10). */
export function RecommendDialog({
  request,
  onClose,
}: {
  request: CreditRequest;
  onClose: () => void;
}) {
  const recommend = useRecommendCreditRequest();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CreditRequestRecommendValues, unknown, CreditRequestRecommendBody>({
    resolver: zodResolver(creditRequestRecommendInput),
    mode: "onChange",
    defaultValues: { note: "", recommendedLimit: "" },
  });
  const { errors, isValid } = form.formState;
  const submit = form.handleSubmit((body) => {
    setError(null);
    recommend.mutate(
      { id: request.id, version: request.version, body },
      { onSuccess: onClose, onError: (e) => setError(creditRequestErrorMessage(e)) },
    );
  });

  return (
    <FormDialog open onOpenChange={(open) => !open && !recommend.isPending && onClose()}>
      <FormDialogBody
        title="Ghi ý kiến của Sale"
        description="Ý kiến của bạn chỉ nội bộ thấy. Ghi xong, đề nghị chuyển Kế toán duyệt."
        submitLabel="Ghi ý kiến"
        canSubmit={isValid}
        isPending={recommend.isPending}
        error={error}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        <TextAreaField
          id="cr-recommend-note"
          label="Ý kiến"
          required
          error={errors.note?.message}
          register={form.register("note")}
        />
        <NumberField
          id="cr-recommend-limit"
          label="Hạn mức đề xuất (₫)"
          hint="Không bắt buộc."
          error={errors.recommendedLimit?.message}
          register={form.register("recommendedLimit")}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
