"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";

import { SalesPickerField } from "@/components/backoffice/SalesPickerField";
import { NoteField } from "@/components/backoffice/NoteField";
import { DatePicker } from "@/components/shared/DatePicker";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";

import { coverErrorMessage } from "../errors";
import { coverInputSchema } from "../inputs";
import { useCreateCover } from "../mutations";

import type { SalesOption } from "@/lib/references/sales-workload";
import type { CoverValues } from "../inputs";

/**
 * Lập lịch người thay (BR-S07): "B lo thay A từ ngày X tới Y" — Sale lập cho chính mình, quản lý lập cho bất kỳ ai.
 * Không tự thay mình, tối đa 60 ngày; chồng lịch BE kiểm (`STAFF_COVER_OVERLAP`), lỗi hiện tiếng Việt trong hộp thoại.
 * Người phụ trách KHÔNG đổi; hết lịch tự trả về.
 */
export function CoverCreateDialog({
  self,
  isManager,
  sales,
  onClose,
}: {
  self: { userId: string; name: string };
  isManager: boolean;
  sales: readonly SalesOption[];
  onClose: () => void;
}) {
  const create = useCreateCover();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CoverValues>({
    resolver: zodResolver(coverInputSchema),
    defaultValues: {
      userId: isManager ? "" : self.userId,
      coverUserId: "",
      from: "",
      to: "",
      reason: "",
    },
  });
  const { errors } = form.formState;
  const [absent, from] = useWatch({ control: form.control, name: ["userId", "from"] });
  const submit = form.handleSubmit((values) => {
    setError(null);
    create.mutate(values, {
      onSuccess: onClose,
      onError: (e) => setError(coverErrorMessage(e)),
    });
  });

  return (
    <FormDialog open onOpenChange={(open) => !open && !create.isPending && onClose()}>
      <FormDialogBody
        title="Lập lịch người thay"
        description="Trong lịch, mọi việc với khách của người vắng đi tới người thay. Người phụ trách không đổi; hết lịch tự trả về."
        submitLabel="Lập lịch"
        canSubmit
        isPending={create.isPending}
        error={error}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        {isManager ? (
          <Controller
            control={form.control}
            name="userId"
            render={({ field }) => (
              <SalesPickerField
                id="cover-user"
                label="Sale vắng mặt"
                required
                value={field.value}
                onChange={field.onChange}
                options={sales}
                error={errors.userId?.message}
              />
            )}
          />
        ) : (
          <p className="text-ink-secondary text-[0.8125rem]">
            Sale vắng mặt: <span className="text-ink-primary font-medium">{self.name}</span>
          </p>
        )}
        <Controller
          control={form.control}
          name="coverUserId"
          render={({ field }) => (
            <SalesPickerField
              id="cover-by"
              label="Người thay"
              required
              value={field.value}
              onChange={field.onChange}
              options={sales.filter((option) => option.userId !== absent)}
              error={errors.coverUserId?.message}
            />
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField id="cover-from" label="Từ ngày" required error={errors.from?.message}>
            <Controller
              control={form.control}
              name="from"
              render={({ field }) => (
                <DatePicker
                  id="cover-from"
                  quickKind="future"
                  value={field.value}
                  onChange={field.onChange}
                  aria-invalid={!!errors.from}
                />
              )}
            />
          </FormField>
          <FormField id="cover-to" label="Đến ngày" required error={errors.to?.message}>
            <Controller
              control={form.control}
              name="to"
              render={({ field }) => (
                <DatePicker
                  id="cover-to"
                  quickKind="future"
                  min={from || undefined}
                  value={field.value}
                  onChange={field.onChange}
                  aria-invalid={!!errors.to}
                />
              )}
            />
          </FormField>
        </div>
        <NoteField
          id="cover-reason"
          label="Lý do"
          placeholder="Ví dụ: nghỉ phép"
          error={errors.reason?.message}
          register={form.register("reason")}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
