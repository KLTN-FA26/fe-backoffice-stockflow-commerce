"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { CREDIT_REQUEST_ROUTES } from "@/constants/credit-request";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { creditRequestErrorMessage, useCreateCreditRequest } from "../mutations";
import { creditRequestCreateInput } from "../schemas";

import { NumberField, TextAreaField } from "./fields";

import type { CreditRequestCreateBody, CreditRequestCreateValues } from "../types";

/**
 * Sale tạo đề nghị cấp hạn mức thay khách (handoff A2; BE `POST /credit-requests` với `customerId` + `salesNote` bắt
 * buộc → `PENDING_APPROVAL`). Mở từ nút "Tạo mới" hoặc từ trang khách (`?create=<customerId>` — điền sẵn khách).
 */
export function CreateCreditRequestDialog({
  customerId,
  onClose,
}: {
  customerId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const create = useCreateCreditRequest();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CreditRequestCreateValues, unknown, CreditRequestCreateBody>({
    resolver: zodResolver(creditRequestCreateInput),
    mode: "onChange",
    defaultValues: {
      customerId: customerId ?? "",
      requestedLimit: "",
      requestedTermDays: "30",
      reason: "",
      salesNote: "",
      recommendedLimit: "",
    },
  });
  const { errors, isValid } = form.formState;
  const customer = useWatch({ control: form.control, name: "customerId" });
  const submit = form.handleSubmit((body) => {
    setError(null);
    create.mutate(body, {
      onSuccess: (created) => {
        onClose();
        router.push(CREDIT_REQUEST_ROUTES.detail(created.id));
      },
      onError: (e) => setError(creditRequestErrorMessage(e)),
    });
  });

  return (
    <FormDialog open onOpenChange={(open) => !open && !create.isPending && onClose()}>
      <FormDialogBody
        title="Tạo đề nghị cấp hạn mức"
        description="Gửi thay khách kèm ý kiến của bạn; đề nghị chuyển thẳng Kế toán duyệt. Mỗi khách chỉ có một đề nghị đang mở."
        submitLabel="Gửi Kế toán duyệt"
        canSubmit={isValid}
        isPending={create.isPending}
        error={error}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        <CustomerPicker
          idPrefix="credit-request"
          value={customer}
          onChange={(id) => form.setValue("customerId", id, { shouldValidate: true })}
          error={errors.customerId?.message}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="cr-limit"
            label="Hạn mức xin (₫)"
            required
            error={errors.requestedLimit?.message}
            register={form.register("requestedLimit")}
          />
          <NumberField
            id="cr-term"
            label="Kỳ hạn (ngày sau giao)"
            required
            error={errors.requestedTermDays?.message}
            register={form.register("requestedTermDays")}
          />
        </div>
        <TextAreaField
          id="cr-reason"
          label="Lý do khách cần"
          error={errors.reason?.message}
          register={form.register("reason")}
        />
        <TextAreaField
          id="cr-sales-note"
          label="Ý kiến của Sale"
          required
          error={errors.salesNote?.message}
          register={form.register("salesNote")}
        />
        <NumberField
          id="cr-recommended"
          label="Hạn mức Sale đề xuất (₫)"
          hint="Không bắt buộc."
          error={errors.recommendedLimit?.message}
          register={form.register("recommendedLimit")}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
