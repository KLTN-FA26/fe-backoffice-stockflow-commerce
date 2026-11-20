"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { legalProfileErrorMessage } from "@/features/customer/errors";
import { useSaveLegalProfile } from "@/features/customer/mutations";
import { legalProfileInputSchema } from "@/features/customer/schemas";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import type { LegalProfile, LegalProfileValues } from "@/features/customer/types";

const MONO_INPUT = `${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)] tabular-nums`;

function defaultsOf(profile: LegalProfile | null): LegalProfileValues {
  return {
    registeredAddress: profile?.registeredAddress ?? "",
    representativeName: profile?.representativeName ?? "",
    representativeTitle: profile?.representativeTitle ?? "",
    invoiceEmail: profile?.invoiceEmail ?? "",
    accountNumber: profile?.bankAccount?.accountNumber ?? "",
    bankName: profile?.bankAccount?.bankName ?? "",
    accountHolder: profile?.bankAccount?.accountHolder ?? "",
  };
}

function LegalProfileForm({
  customerId,
  profile,
  onClose,
}: {
  customerId: string;
  profile: LegalProfile | null;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LegalProfileValues>({
    resolver: zodResolver(legalProfileInputSchema),
    defaultValues: defaultsOf(profile),
  });
  const { errors } = form.formState;
  const save = useSaveLegalProfile();
  const field = (name: keyof LegalProfileValues) => ({
    ...form.register(name),
    ...fieldA11y(`legal-${name}`, errors[name]?.message),
  });

  const submit = form.handleSubmit((values) => {
    setError(null);
    // Lần đầu gửi `version: null`; đã có hồ sơ thì gửi version đang xem (người khác vừa sửa → 409, đã tải lại).
    save.mutate(
      { id: customerId, version: profile?.version ?? null, values },
      { onSuccess: onClose, onError: (failure) => setError(legalProfileErrorMessage(failure)) },
    );
  });

  return (
    <FormDialogBody
      title={profile ? "Sửa thông tin pháp lý" : "Nhập thông tin pháp lý"}
      description="Dùng để lập hợp đồng và hoá đơn. Tên công ty và mã số thuế lấy từ hồ sơ khách."
      submitLabel="Lưu"
      canSubmit
      isPending={save.isPending}
      error={error}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <FormField
        id="legal-registeredAddress"
        label="Địa chỉ đăng ký kinh doanh"
        required
        error={errors.registeredAddress?.message}
      >
        <Input {...field("registeredAddress")} autoFocus className={FORM_INPUT_CLASS} />
      </FormField>
      <FormField
        id="legal-representativeName"
        label="Người đại diện theo pháp luật"
        required
        error={errors.representativeName?.message}
      >
        <Input {...field("representativeName")} className={FORM_INPUT_CLASS} />
      </FormField>
      <FormField
        id="legal-representativeTitle"
        label="Chức vụ"
        required
        error={errors.representativeTitle?.message}
      >
        <Input {...field("representativeTitle")} className={FORM_INPUT_CLASS} />
      </FormField>
      <FormField
        id="legal-invoiceEmail"
        label="Email nhận hoá đơn (để trống = email liên hệ)"
        error={errors.invoiceEmail?.message}
      >
        <Input {...field("invoiceEmail")} type="email" className={FORM_INPUT_CLASS} />
      </FormField>
      <FormField
        id="legal-accountNumber"
        label="Số tài khoản"
        error={errors.accountNumber?.message}
        hint="Bỏ trống cả ba ô ngân hàng nếu khách chưa có tài khoản."
      >
        <Input {...field("accountNumber")} className={MONO_INPUT} />
      </FormField>
      <FormField id="legal-bankName" label="Ngân hàng" error={errors.bankName?.message}>
        <Input {...field("bankName")} className={FORM_INPUT_CLASS} />
      </FormField>
      <FormField
        id="legal-accountHolder"
        label="Chủ tài khoản"
        error={errors.accountHolder?.message}
      >
        <Input {...field("accountHolder")} className={FORM_INPUT_CLASS} />
      </FormField>
    </FormDialogBody>
  );
}

/** Nhập / sửa hồ sơ pháp lý. Mở khi đã biết hồ sơ hiện có (để gửi đúng `version`). */
export function LegalProfileDialog({
  customerId,
  profile,
  open,
  onOpenChange,
}: {
  customerId: string;
  profile: LegalProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <LegalProfileForm
          customerId={customerId}
          profile={profile}
          onClose={() => onOpenChange(false)}
        />
      )}
    </FormDialog>
  );
}
