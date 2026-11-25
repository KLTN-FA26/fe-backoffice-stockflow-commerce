"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  CREDIT_NOTE_MAX,
  CREDIT_TERM_DAYS_MAX,
  creditProfileInputSchema,
} from "@/features/customer/credit-profile-schemas";
import { creditProfileErrorMessage } from "@/features/customer/errors";
import { useSaveCreditProfile } from "@/features/customer/mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { CreditProfile, CreditProfileValues } from "@/features/customer/types";

function defaultsOf(profile: CreditProfile): CreditProfileValues {
  return {
    creditLimit: profile.creditLimit == null ? "" : String(Math.trunc(profile.creditLimit)),
    creditTermDays: profile.creditTermDays == null ? "" : String(profile.creditTermDays),
    note: profile.note ?? "",
  };
}

function CreditProfileForm({
  customerId,
  profile,
  onClose,
}: {
  customerId: string;
  profile: CreditProfile;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  // Version của bản các ô đang hiển thị (-1 = chưa cấu hình, BE nhận). Sau 409 BE tải lại `profile` nhưng các ô vẫn
  // là bản cũ: chỉ gửi version đã mở, chờ người dùng tải bản mới — không ghi đè thầm lặng hạn mức người khác vừa đặt.
  const [openedVersion, setOpenedVersion] = useState(profile.version);
  const stale = profile.version !== openedVersion;
  const form = useForm<CreditProfileValues>({
    resolver: zodResolver(creditProfileInputSchema),
    defaultValues: defaultsOf(profile),
  });
  const { errors } = form.formState;
  const save = useSaveCreditProfile();

  const reloadLatest = () => {
    form.reset(defaultsOf(profile));
    setOpenedVersion(profile.version);
    setError(null);
  };

  const submit = form.handleSubmit((values) => {
    setError(null);
    save.mutate(
      { id: customerId, expectedVersion: openedVersion, values },
      { onSuccess: onClose, onError: (failure) => setError(creditProfileErrorMessage(failure)) },
    );
  });

  return (
    <FormDialogBody
      title={profile.configured ? "Sửa hạn mức công nợ" : "Cấp hạn mức công nợ"}
      description="Áp dụng cho đơn mới và lần duyệt công nợ tiếp theo. Hợp đồng đã ký giữ nguyên lịch thanh toán đã chốt. Để trống cả hai ô = không cho công nợ."
      submitLabel="Lưu"
      canSubmit={!stale}
      isPending={save.isPending}
      error={error}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      {stale && (
        <Notice tone="warning" live>
          <span>
            Người khác vừa lưu hạn mức công nợ của khách này. Các ô bên dưới vẫn là bản cũ của bạn.{" "}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={reloadLatest}
            >
              Tải lại theo bản mới
            </Button>{" "}
            (các chỉnh sửa của bạn sẽ mất).
          </span>
        </Notice>
      )}
      <FormField
        id="credit-limit"
        label="Hạn mức công nợ"
        error={errors.creditLimit?.message}
        hint="Tổng dư nợ tối đa khách được nợ cùng lúc."
      >
        <Controller
          control={form.control}
          name="creditLimit"
          render={({ field }) => (
            <MoneyInput
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              autoFocus
              echo
              {...fieldA11y("credit-limit", errors.creditLimit?.message, true)}
            />
          )}
        />
      </FormField>
      <FormField
        id="credit-termDays"
        label={`Số ngày được nợ (0–${CREDIT_TERM_DAYS_MAX})`}
        error={errors.creditTermDays?.message}
      >
        <Input
          {...form.register("creditTermDays")}
          {...fieldA11y("credit-termDays", errors.creditTermDays?.message)}
          inputMode="numeric"
          className={`${FORM_INPUT_CLASS} w-28 tabular-nums`}
        />
      </FormField>
      <FormField id="credit-note" label="Ghi chú" error={errors.note?.message}>
        <Textarea
          {...form.register("note")}
          {...fieldA11y("credit-note", errors.note?.message)}
          maxLength={CREDIT_NOTE_MAX}
          rows={3}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
    </FormDialogBody>
  );
}

/** Cấp / sửa hạn mức công nợ (AUTH-6). Mở khi đã tải hồ sơ hiện tại (để gửi đúng `expectedVersion`). */
export function CreditProfileDialog({
  customerId,
  profile,
  open,
  onOpenChange,
}: {
  customerId: string;
  profile: CreditProfile | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open && profile != null} onOpenChange={onOpenChange}>
      {open && profile && (
        <CreditProfileForm
          customerId={customerId}
          profile={profile}
          onClose={() => onOpenChange(false)}
        />
      )}
    </FormDialog>
  );
}
