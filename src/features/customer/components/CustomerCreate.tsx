"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";

import { ADMIN_ROUTES, CUSTOMER_PERMISSIONS } from "@/constants";
import { SALES_OWNER_PERMISSIONS } from "@/constants/sales-owner";

import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { apiFieldErrors } from "@/lib/api/error-message";
import { ApiError } from "@/lib/api/error";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { useCustomerDuplicates } from "@/features/customer/duplicates";
import { customerErrorMessage } from "@/features/customer/errors";
import { useCreateCustomer } from "@/features/customer/mutations";
import { customerCreateInputSchema } from "@/features/customer/schemas";

import { FORM_BAR_ACTION_CLASS, FormBottomBar } from "@/components/backoffice/FormBottomBar";
import { Card } from "@/components/shared/Card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FIELD_BY_ERROR, PREFILL_FIELDS, isFormField, prefilledDefaults } from "./create-form";
import { DuplicatePanel } from "./create/DuplicatePanel";
import { OwnerFields } from "./create/OwnerFields";
import { TaxCodeFields } from "./create/TaxCodeFields";

import type { CustomerCreateFormValues, CustomerCreateValues } from "@/features/customer/types";

const PREFILL_PARSERS = Object.fromEntries(PREFILL_FIELDS.map((field) => [field, parseAsString]));

/**
 * Tạo khách doanh nghiệp. Sale phụ trách (KE-HOACH sales-owner): MST bắt buộc, Sales Manager được miễn kèm lý do (BR-S14);
 * cảnh báo khách có thể trùng kèm người đang phụ trách (BR-S14, tình huống 16); Manager chọn Sale phụ trách (BR-S02); điền
 * sẵn từ khách tiềm năng qua URL (`?companyName=…&leadId=…`, §10.7).
 */
function CustomerCreateForm() {
  const router = useRouter();
  const can = usePermissionChecker();
  const isManager = can(SALES_OWNER_PERMISSIONS.update);
  const [prefill] = useQueryStates(PREFILL_PARSERS);
  const [formError, setFormError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const form = useForm<CustomerCreateFormValues, unknown, CustomerCreateValues>({
    resolver: zodResolver(customerCreateInputSchema),
    defaultValues: prefilledDefaults(prefill),
    mode: "onTouched",
  });
  const { register, handleSubmit, setError, formState, control } = form;
  const { errors, isDirty } = formState;
  const create = useCreateCustomer();
  useUnsavedChangesWarning(isDirty && !create.isSuccess);
  const [taxCode, phone, email, name, leadId] = useWatch({
    control,
    name: ["taxCode", "phone", "email", "companyName", "leadId"],
  });
  const duplicates = useCustomerDuplicates({
    taxCode: taxCode ?? "",
    phone: phone ?? "",
    email: email ?? "",
    name: name ?? "",
  });

  const onSubmit = (values: CustomerCreateValues) => {
    setFormError(null);
    // BR-S14: chỉ Manager được miễn MST — Sale thường không gửi cờ miễn dù ô có giá trị cũ.
    const body = isManager ? values : { ...values, taxCodeExemption: false, salesOwnerId: "" };
    create.mutate(body, {
      onSuccess: (result) =>
        router.replace(ADMIN_ROUTES.customers.detail(result.customer.customerId)),
      onError: (error) => {
        const field = error instanceof ApiError ? FIELD_BY_ERROR[error.code] : undefined;
        let mapped = false;
        if (field) {
          setError(
            field,
            { type: "server", message: customerErrorMessage(error) },
            { shouldFocus: true },
          );
          mapped = true;
        }
        for (const [fieldName, message] of Object.entries(apiFieldErrors(error))) {
          if (isFormField(fieldName)) {
            setError(fieldName, { type: "server", message });
            mapped = true;
          }
        }
        if (!mapped) setFormError(customerErrorMessage(error));
      },
    });
  };

  const cancel = () => (isDirty ? setLeaveOpen(true) : router.push(ADMIN_ROUTES.customers.list));

  return (
    // Giao diện kiểu Vercel như form sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề / nút quay lại —
    // breadcrumb topbar đã có tên trang và link về danh sách; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">Tạo khách hàng doanh nghiệp</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-3xl space-y-4 pb-24">
        {formError && (
          <div
            role="alert"
            className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]"
          >
            {formError}
          </div>
        )}
        <DuplicatePanel matches={duplicates} />
        <Card className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-ink-primary text-sm font-semibold sm:col-span-2">Doanh nghiệp</h2>
          <FormField
            id="customer-companyName"
            label="Tên công ty / cửa hàng"
            required
            error={errors.companyName?.message}
            className="sm:col-span-2"
          >
            <Input
              {...register("companyName")}
              {...fieldA11y("customer-companyName", errors.companyName?.message)}
              autoFocus
              autoComplete="organization"
              className={FORM_INPUT_CLASS}
            />
          </FormField>
          <TaxCodeFields form={form} canExempt={isManager} />
        </Card>

        <Card className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-ink-primary text-sm font-semibold sm:col-span-2">
            Người liên hệ (nhận email kích hoạt)
          </h2>
          <FormField
            id="customer-contactName"
            label="Họ tên"
            required
            error={errors.contactName?.message}
          >
            <Input
              {...register("contactName")}
              {...fieldA11y("customer-contactName", errors.contactName?.message)}
              autoComplete="name"
              className={FORM_INPUT_CLASS}
            />
          </FormField>
          <FormField id="customer-email" label="Email" required error={errors.email?.message}>
            <Input
              {...register("email")}
              {...fieldA11y("customer-email", errors.email?.message)}
              type="email"
              autoComplete="email"
              className={FORM_INPUT_CLASS}
            />
          </FormField>
          <FormField id="customer-phone" label="Điện thoại" error={errors.phone?.message}>
            <Input
              {...register("phone")}
              {...fieldA11y("customer-phone", errors.phone?.message)}
              type="tel"
              autoComplete="tel"
              className={`${FORM_INPUT_CLASS} tabular-nums`}
            />
          </FormField>
        </Card>

        <OwnerFields
          form={form}
          isManager={isManager}
          fromLead={!!leadId}
          ownerKnown={can(SALES_OWNER_PERMISSIONS.read)}
        />

        <FormBottomBar note="Khách nhận email mời kích hoạt portal; chưa đăng nhập được tới khi tự đặt mật khẩu.">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={cancel}
            disabled={create.isPending}
            className={FORM_BAR_ACTION_CLASS.outline}
          >
            Huỷ
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={create.isPending}
            className={FORM_BAR_ACTION_CLASS.primary}
          >
            {create.isPending && (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            )}
            Tạo khách và gửi lời mời
          </Button>
        </FormBottomBar>
      </form>
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Bỏ thông tin đang nhập?"
        description="Các thay đổi chưa lưu sẽ bị mất."
        confirmLabel="Bỏ thay đổi"
        cancelLabel="Ở lại"
        onConfirm={() => router.push(ADMIN_ROUTES.customers.list)}
      />
    </div>
  );
}

export function CustomerCreate() {
  return (
    <PermissionBoundary permissions={[CUSTOMER_PERMISSIONS.viewPage, CUSTOMER_PERMISSIONS.create]}>
      <CustomerCreateForm />
    </PermissionBoundary>
  );
}
