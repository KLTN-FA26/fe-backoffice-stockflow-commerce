"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { SALES_OWNER_LIMITS } from "@/constants/sales-owner";

import { SalesPickerField } from "@/components/backoffice/SalesPickerField";
import { NoteField } from "@/components/backoffice/NoteField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Notice } from "@/components/shared/Notice";

import { requestErrorMessage } from "../errors";
import { approveRequestInputSchema } from "../inputs";
import { useApproveOwnerChangeRequest, useRejectOwnerChangeRequest } from "../mutations";

import { RECENTLY_CONTACTED_WARNING } from "./request-columns";

import type { SalesOption } from "@/lib/references/sales-workload";
import type { ApproveRequestValues } from "../inputs";
import type { OwnerChangeRequest } from "../types";

/**
 * Đồng ý yêu cầu đổi Sale (BR-S15, §10.5 bước 3–4): chọn người phụ trách mới — điền sẵn người khách nêu tên; cờ "vận
 * động" hiện ngay trên hộp. BE đổi người phụ trách với lý do "Khách yêu cầu" và báo khách + cả hai Sale.
 */
export function ApproveRequestDialog({
  request,
  sales,
  onClose,
}: {
  request: OwnerChangeRequest;
  /** Sale giao được (D42, `useAssignableSales`). */
  sales: readonly SalesOption[];
  onClose: () => void;
}) {
  const approve = useApproveOwnerChangeRequest();
  const [error, setError] = useState<string | null>(null);
  const options = sales.filter((option) => option.userId !== request.currentOwnerId);
  const preferred = options.some((o) => o.userId === request.preferredSalesUserId)
    ? (request.preferredSalesUserId ?? "")
    : "";
  const form = useForm<ApproveRequestValues>({
    resolver: zodResolver(approveRequestInputSchema),
    defaultValues: { newSalesOwnerId: preferred, note: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) => {
    setError(null);
    approve.mutate(
      { id: request.id, ...values },
      { onSuccess: onClose, onError: (e) => setError(requestErrorMessage(e)) },
    );
  });
  return (
    <FormDialog open onOpenChange={(open) => !open && !approve.isPending && onClose()}>
      <FormDialogBody
        title="Đồng ý đổi Sale"
        description={`${request.customerName ?? "Khách"} đang do ${request.currentOwnerName ?? "chưa ai"} phụ trách.`}
        submitLabel="Đồng ý và đổi"
        canSubmit
        isPending={approve.isPending}
        error={error}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        {request.preferredSalesRecentlyContacted && (
          <Notice tone="warning">{RECENTLY_CONTACTED_WARNING}.</Notice>
        )}
        <Controller
          control={form.control}
          name="newSalesOwnerId"
          render={({ field }) => (
            <SalesPickerField
              id="request-new-owner"
              label="Sale phụ trách mới"
              required
              value={field.value}
              onChange={field.onChange}
              options={options}
              error={errors.newSalesOwnerId?.message}
            />
          )}
        />
        <NoteField
          id="request-approve-note"
          error={errors.note?.message}
          register={form.register("note")}
        />
      </FormDialogBody>
    </FormDialog>
  );
}

/** Từ chối (§10.5 bước 4: "trả lời khách lý do") — ghi chú bắt buộc. */
export function RejectRequestDialog({
  request,
  onClose,
}: {
  request: OwnerChangeRequest;
  onClose: () => void;
}) {
  const reject = useRejectOwnerChangeRequest();
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && !reject.isPending && onClose()}
      title="Từ chối yêu cầu đổi Sale"
      description={`${request.customerName ?? "Khách"} sẽ nhận lý do bạn ghi dưới đây.`}
      confirmLabel="Từ chối"
      requireReason
      reasonLabel="Lý do gửi khách"
      reasonMaxLength={SALES_OWNER_LIMITS.textMax}
      closeOnConfirm={false}
      loading={reject.isPending}
      error={error}
      onConfirm={(note) =>
        reject.mutate(
          { id: request.id, note: note ?? "" },
          { onSuccess: onClose, onError: (e) => setError(requestErrorMessage(e)) },
        )
      }
    />
  );
}
