"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";

import { SALES_OWNER_ERROR_CODES } from "@/constants/sales-owner";

import { ApiError } from "@/lib/api/error";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { transferErrorMessage } from "../errors";
import { transferInputSchema } from "../inputs";
import { useTransferCustomers } from "../mutations";
import { salesOwnerFeatureKeys } from "../queries";
import { overTransferCap } from "../selectors";

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
 * đúng khoá cũ, BE trả kết quả đã chạy thay vì chuyển hai lần. Đổi nội dung rồi gửi lại cùng khoá thì BE từ chối
 * (`SALES_OWNER_TRANSFER_REQUEST_REUSED`) → sinh khoá mới cho lần bấm sau. Một lô tối đa 500 khách: Sale nguồn có hơn 500
 * khách (bảng tải) mà chọn "tất cả" thì cảnh báo và không gửi. Kết quả hiện ngay trong hộp: số khách đã chuyển và khách
 * bị bỏ qua kèm lý do (khách đã đổi tay trong lúc chạy, ca #9).
 */
export function TransferDialog({
  sales,
  targets,
  fromUserId = "",
  customerCounts,
  onClose,
}: {
  /** Ô "Từ Sale": Sale đang làm (bảng tải) + người cũ của khách cần giao, nếu mở từ đó. */
  sales: readonly SalesOption[];
  /** Ô "Sang Sale": chỉ Sale giao được (D42, `useAssignableSales`). */
  targets: readonly SalesOption[];
  fromUserId?: string;
  /** Số khách đang phụ trách theo Sale (bảng tải) — để cảnh báo lô quá 500 khách trước khi gửi. */
  customerCounts?: ReadonlyMap<string, number>;
  onClose: () => void;
}) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
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
  const [from, scope] = useWatch({ control: form.control, name: ["fromUserId", "scope"] });
  const sourceCustomers = customerCounts?.get(from) ?? null;
  const overCap = overTransferCap(scope, sourceCustomers);
  const names = new Map([...targets, ...sales].map((option) => [option.userId, option.name]));
  const submit = form.handleSubmit((values) => {
    setError(null);
    if (overCap) return;
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
      {
        onSuccess: setResult,
        onError: (e) => {
          // Khoá đã dùng cho nội dung khác: lần bấm sau là một yêu cầu mới
          if (e instanceof ApiError && e.code === SALES_OWNER_ERROR_CODES.transferRequestReused)
            setRequestId(crypto.randomUUID());
          setError(transferErrorMessage(e));
        },
      },
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
        canSubmit={!overCap}
        isPending={transfer.isPending}
        error={error}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        <TransferFields
          form={form}
          sales={sales}
          targets={targets}
          sourceCustomers={sourceCustomers}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
