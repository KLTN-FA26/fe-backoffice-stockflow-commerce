"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LoaderCircle } from "lucide-react";

import { ADMIN_ROUTES, CUSTOMER_PERMISSIONS, SALES_ONBOARDING_PAYMENT_TERMS } from "@/constants";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { apiFieldErrors } from "@/lib/api/error-message";
import { ApiError } from "@/lib/api/error";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { customerErrorMessage } from "@/features/customer/errors";
import { useCreateCustomer } from "@/features/customer/mutations";
import { customerCreateInputSchema } from "@/features/customer/schemas";
import { PAYMENT_TERM_LABEL } from "@/features/customer/selectors";
import { Card } from "@/components/shared/Card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { CustomerCreateValues } from "@/features/customer/types";

const DEFAULTS: CustomerCreateValues = {
  companyName: "",
  taxCode: "",
  contactName: "",
  email: "",
  phone: "",
  paymentTerm: "PREPAID",
  depositPercent: "",
};

/** Lỗi nghiệp vụ 409 trỏ đúng trường để người dùng sửa tại chỗ. */
const FIELD_BY_ERROR: Readonly<Record<string, keyof CustomerCreateValues>> = {
  CUSTOMER_TAX_CODE_ALREADY_EXISTS: "taxCode",
  CUSTOMER_EMAIL_ALREADY_EXISTS: "email",
  USER_EMAIL_ALREADY_EXISTS: "email",
  CREDIT_PROFILE_INVALID: "depositPercent",
};

function isFormField(name: string): name is keyof CustomerCreateValues {
  return name in DEFAULTS;
}

function CustomerCreateForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const form = useForm<CustomerCreateValues>({
    resolver: zodResolver(customerCreateInputSchema),
    defaultValues: DEFAULTS,
    mode: "onTouched",
  });
  const { register, handleSubmit, setError, control, formState } = form;
  const { errors, isDirty } = formState;
  const paymentTerm = useWatch({ control, name: "paymentTerm" });
  const create = useCreateCustomer();
  useUnsavedChangesWarning(isDirty && !create.isSuccess);

  const onSubmit = (values: CustomerCreateValues) => {
    setFormError(null);
    create.mutate(values, {
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
        for (const [name, message] of Object.entries(apiFieldErrors(error))) {
          if (isFormField(name)) {
            setError(name, { type: "server", message });
            mapped = true;
          }
        }
        if (!mapped) setFormError(customerErrorMessage(error));
      },
    });
  };

  const cancel = () => (isDirty ? setLeaveOpen(true) : router.push(ADMIN_ROUTES.customers.list));

  return (
    <>
      <PageHeader
        title="Tạo khách hàng doanh nghiệp"
        subtitle="Tạo hồ sơ khách và gửi email mời kích hoạt portal. Khách chưa đăng nhập được tới khi tự đặt mật khẩu."
        actions={
          <Button variant="outline" size="sm" onClick={cancel}>
            <ArrowLeft className="size-3.5" /> Quay lại danh sách
          </Button>
        }
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-3xl space-y-4">
        {formError && (
          <div
            role="alert"
            className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]"
          >
            {formError}
          </div>
        )}
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
          <FormField
            id="customer-taxCode"
            label="Mã số thuế"
            error={errors.taxCode?.message}
            hint="Không bắt buộc. 10 số, 10-3 số, hoặc 12 số CCCD của chủ hộ kinh doanh."
          >
            <Input
              {...register("taxCode")}
              {...fieldA11y("customer-taxCode", errors.taxCode?.message, true)}
              inputMode="numeric"
              className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)] tabular-nums`}
            />
          </FormField>
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

        <Card className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-ink-primary text-sm font-semibold">Điều khoản thanh toán</h2>
            <p className="text-ink-tertiary mt-1 text-xs">
              Sales chọn Trả trước hoặc Đặt cọc. Công nợ (hạn mức, số ngày) do người duyệt công nợ
              thiết lập sau trên hồ sơ khách.
            </p>
          </div>
          <fieldset className="flex flex-wrap gap-2 sm:col-span-2">
            <legend className="sr-only">Điều khoản thanh toán</legend>
            {SALES_ONBOARDING_PAYMENT_TERMS.map((term) => (
              <label
                key={term}
                className="border-border-default has-[:checked]:border-brand has-[:focus-visible]:ring-brand/30 flex cursor-pointer items-center gap-2 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] has-[:focus-visible]:ring-2"
              >
                <input
                  type="radio"
                  value={term}
                  {...register("paymentTerm")}
                  className="accent-[var(--brand)]"
                />
                {PAYMENT_TERM_LABEL[term]}
              </label>
            ))}
          </fieldset>
          {paymentTerm === "DEPOSIT" && (
            <FormField
              id="customer-depositPercent"
              label="Tỷ lệ cọc đã thoả thuận (%)"
              required
              error={errors.depositPercent?.message}
              hint="Lớn hơn 0 và nhỏ hơn 100, tối đa 2 chữ số thập phân."
            >
              <Input
                {...register("depositPercent")}
                {...fieldA11y("customer-depositPercent", errors.depositPercent?.message, true)}
                inputMode="decimal"
                className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
              />
            </FormField>
          )}
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={cancel} disabled={create.isPending}>
            Huỷ
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            )}
            Tạo khách và gửi lời mời
          </Button>
        </div>
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
    </>
  );
}

export function CustomerCreate() {
  return (
    <PermissionBoundary permissions={[CUSTOMER_PERMISSIONS.viewPage, CUSTOMER_PERMISSIONS.create]}>
      <CustomerCreateForm />
    </PermissionBoundary>
  );
}
