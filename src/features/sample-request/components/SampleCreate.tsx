"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LoaderCircle } from "lucide-react";

import { ADMIN_ROUTES, SAMPLE_REQUEST_PERMISSIONS } from "@/constants";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { ApiError } from "@/lib/api/error";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { sampleErrorMessage } from "@/features/sample-request/errors";
import { useCreateSample } from "@/features/sample-request/mutations";
import { sampleCreateInputSchema } from "@/features/sample-request/schemas";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { Card } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

import { SampleSpecFields } from "./SampleSpecFields";

import type { SampleCreateOutput, SampleCreateValues } from "@/features/sample-request/types";

const FIELD_BY_CODE: Readonly<Record<string, keyof SampleCreateValues>> = {
  CUSTOMER_NOT_ACTIVE: "customerId",
  SAMPLE_QUOTE_MISMATCH: "designSnapshotId",
  CONFLICT: "designSnapshotId",
  NOT_FOUND: "designSnapshotId",
};

function SampleCreateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const quoteId = params.get("quoteId") ?? "";
  const form = useForm<SampleCreateValues, unknown, SampleCreateOutput>({
    resolver: zodResolver(sampleCreateInputSchema),
    defaultValues: {
      customerId: params.get("customerId") ?? "",
      quoteId,
      designSnapshotId: params.get("designSnapshotId") ?? "",
      blankSku: params.get("blankSku") ?? "",
      quantity: "",
      dueDate: "",
    },
    mode: "onTouched",
  });
  const customerId = useWatch({ control: form.control, name: "customerId" });
  const create = useCreateSample();
  useUnsavedChangesWarning(form.formState.isDirty && !create.isSuccess);

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    create.mutate(values, {
      onSuccess: (sample) => router.replace(ADMIN_ROUTES.sampleRequests.detail(sample.id)),
      onError: (error) => {
        const field = error instanceof ApiError ? FIELD_BY_CODE[error.code] : undefined;
        if (field) form.setError(field, { type: "server", message: sampleErrorMessage(error) });
        else setFormError(sampleErrorMessage(error));
      },
    });
  });

  return (
    <>
      <PageHeader
        title="Tạo yêu cầu mẫu"
        subtitle={
          quoteId
            ? "Làm mẫu cho một dòng báo giá — khách duyệt mẫu xong mới chấp nhận được báo giá."
            : "Lưu nháp; gửi sản xuất ở màn chi tiết."
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link
              href={
                quoteId ? ADMIN_ROUTES.quotes.detail(quoteId) : ADMIN_ROUTES.sampleRequests.list
              }
            >
              <ArrowLeft className="size-3.5" /> Quay lại
            </Link>
          </Button>
        }
      />
      <form onSubmit={(event) => void submit(event)} noValidate className="max-w-3xl space-y-4">
        {formError && (
          <div
            role="alert"
            className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]"
          >
            {formError}
          </div>
        )}
        <Card className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <CustomerPicker
                idPrefix="sample"
                value={field.value}
                onChange={field.onChange}
                error={form.formState.errors.customerId?.message}
                locked={!!quoteId}
              />
            )}
          />
          {quoteId && (
            <p className="text-ink-secondary self-end text-[0.8125rem]">
              Gắn với báo giá{" "}
              <Link
                href={ADMIN_ROUTES.quotes.detail(quoteId)}
                className="text-accent hover:underline"
              >
                đang mở
              </Link>{" "}
              (BE kiểm tra cùng khách, thiết kế và phôi).
            </p>
          )}
          {customerId ? (
            <SampleSpecFields
              control={form.control}
              register={form.register}
              errors={form.formState.errors}
              customerId={customerId}
            />
          ) : (
            <p className="text-ink-tertiary text-[0.8125rem] sm:col-span-2">
              Chọn khách hàng trước.
            </p>
          )}
        </Card>
        <div className="flex justify-end">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            )}
            Lưu nháp
          </Button>
        </div>
      </form>
    </>
  );
}

export function SampleCreate() {
  return (
    <PermissionBoundary
      permissions={[SAMPLE_REQUEST_PERMISSIONS.viewPage, SAMPLE_REQUEST_PERMISSIONS.create]}
    >
      <SampleCreateForm />
    </PermissionBoundary>
  );
}
