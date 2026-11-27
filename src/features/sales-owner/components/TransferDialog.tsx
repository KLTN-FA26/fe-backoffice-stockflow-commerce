"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { transferErrorMessage } from "../errors";
import { transferInputSchema } from "../inputs";
import { useTransferCustomers } from "../mutations";
import { salesOwnerFeatureKeys } from "../queries";

import { TransferFields } from "./TransferFields";
import { TransferResultView } from "./TransferResultView";

import type { SalesOwnerChangeReason } from "@/constants/sales-owner";
import type { SalesOption } from "@/lib/references/sales-workload";
import type { TransferValues } from "../inputs";
import type { OwnedCustomer } from "../api";
import type { TransferResult } from "../types";

/**
 * "Chuyển khách…" (BR-S09, §10.1): từ Sale A sang một hay nhiều Sale (BE chia đều), tất cả hoặc một phần khách, lý do
 * bắt buộc, lô tạm để trả lại sau. `requestId` sinh MỘT lần mỗi lần mở hộp thoại: bấm lại sau lỗi mạng / timeout gửi
 * đúng khoá cũ, BE trả kết quả đã chạy thay vì chuyển hai lần. Kết quả hiện ngay trong hộp: số khách đã chuyển và khách
 * bị bỏ qua kèm lý do (khách đã đổi tay trong lúc chạy, ca #9).
 */
export function TransferDialog({
  sales,
  fromUserId = "",
  onClose,
}: {
  /** Sale đang làm (bảng tải) + người cũ của khách cần giao, nếu mở từ đó. */
  sales: readonly SalesOption[];
  fromUserId?: string;
  onClose: () => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TransferResult | null>(null);
  const [customerNames, setCustomerNames] = useState<ReadonlyMap<string, string>>(new Map());
  const queryClient = useQueryClient();
  const transfer = useTransferCustomers();
  const form = useForm<TransferValues>({
    resolver: zodResolver(transferInputSchema),
    defaultValues: {
      fromUserId,
      toUserIds: [],
      scope: "all",
      customerIds: [],
      reason: "",
      note: "",
      temporary: false,
      notifyCustomer: true,
    },
  });
  const names = new Map(sales.map((option) => [option.userId, option.name]));
  const submit = form.handleSubmit((values) => {
    setError(null);
    // Tên khách đã tải (chọn một phần) — để báo khách bị bỏ qua bằng tên thay vì id
    const owned = queryClient.getQueryData<{ items: OwnedCustomer[] }>(
      salesOwnerFeatureKeys.ownedBy(values.fromUserId),
    );
    setCustomerNames(new Map((owned?.items ?? []).map((c) => [c.customerId, c.fullName])));
    transfer.mutate(
      {
        requestId,
        fromUserId: values.fromUserId,
        toUserIds: values.toUserIds,
        ...(values.scope === "picked" ? { customerIds: values.customerIds } : {}),
        reason: values.reason as SalesOwnerChangeReason,
        note: values.note,
        temporary: values.temporary,
        notifyCustomer: values.notifyCustomer,
      },
      { onSuccess: setResult, onError: (e) => setError(transferErrorMessage(e)) },
    );
  });

  if (result)
    return (
      <FormDialog open onOpenChange={(open) => !open && onClose()}>
        <FormDialogBody
          title="Kết quả chuyển khách"
          description={`Từ ${names.get(form.getValues("fromUserId")) ?? "Sale cũ"}.`}
          submitLabel="Đóng"
          canSubmit
          isPending={false}
          error={null}
          hideCancel
          onSubmit={onClose}
          onCancel={onClose}
        >
          <TransferResultView result={result} names={customerNames} />
        </FormDialogBody>
      </FormDialog>
    );

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && !transfer.isPending && onClose()}
      className="sm:max-w-[600px]"
    >
      <FormDialogBody
        title="Chuyển khách"
        description="Chỉ chuyển khách đang thuộc Sale này lúc chạy; khách vừa được đổi tay sẽ được bỏ qua và báo lại."
        submitLabel="Chuyển"
        canSubmit
        isPending={transfer.isPending}
        error={error}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        <TransferFields form={form} sales={sales} />
      </FormDialogBody>
    </FormDialog>
  );
}
