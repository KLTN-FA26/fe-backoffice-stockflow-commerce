"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ApiError } from "@/lib/api/error";
import { customerErrorMessage } from "@/features/customer/errors";
import { useUpdateCustomer } from "@/features/customer/mutations";
import { customerUpdateInputSchema } from "@/features/customer/schemas";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import type { Customer, CustomerUpdateValues } from "@/features/customer/types";

function EditForm({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CustomerUpdateValues>({
    resolver: zodResolver(customerUpdateInputSchema),
    defaultValues: {
      fullName: customer.fullName,
      phone: customer.phone ?? "",
      taxCode: customer.taxCode ?? "",
    },
  });
  const { errors } = form.formState;
  const update = useUpdateCustomer();

  const submit = form.handleSubmit((values) => {
    setError(null);
    update.mutate(
      { id: customer.customerId, version: customer.version, values },
      {
        onSuccess: onClose,
        onError: (failure) => {
          if (failure instanceof ApiError && failure.code === "CUSTOMER_TAX_CODE_ALREADY_EXISTS") {
            form.setError("taxCode", { type: "server", message: customerErrorMessage(failure) });
            return;
          }
          setError(customerErrorMessage(failure));
        },
      },
    );
  });

  return (
    <FormDialogBody
      title="Sửa thông tin khách hàng"
      description="Email đăng nhập portal không đổi ở đây. Mã số thuế đã có thì không xoá được."
      submitLabel="Lưu"
      canSubmit
      isPending={update.isPending}
      error={error}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <FormField
        id="edit-fullName"
        label="Tên công ty / cửa hàng"
        required
        error={errors.fullName?.message}
      >
        <Input
          {...form.register("fullName")}
          {...fieldA11y("edit-fullName", errors.fullName?.message)}
          autoFocus
          className={FORM_INPUT_CLASS}
        />
      </FormField>
      <FormField id="edit-phone" label="Điện thoại" error={errors.phone?.message}>
        <Input
          {...form.register("phone")}
          {...fieldA11y("edit-phone", errors.phone?.message)}
          type="tel"
          className={FORM_INPUT_CLASS}
        />
      </FormField>
      <FormField id="edit-taxCode" label="Mã số thuế" error={errors.taxCode?.message}>
        <Input
          {...form.register("taxCode")}
          {...fieldA11y("edit-taxCode", errors.taxCode?.message)}
          inputMode="numeric"
          className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)] tabular-nums`}
        />
      </FormField>
    </FormDialogBody>
  );
}

/** Sửa hồ sơ khách (gửi kèm `version` — người khác vừa sửa → OPTIMISTIC_LOCK, tải lại). */
export function CustomerEditDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && <EditForm customer={customer} onClose={() => onOpenChange(false)} />}
    </FormDialog>
  );
}
