"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { legalProfileErrorMessage, legalProfileFieldErrors } from "@/features/customer/errors";
import { useSaveLegalProfile } from "@/features/customer/mutations";
import { legalProfileInputSchema } from "@/features/customer/schemas";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";
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
  // Version của bản mà các ô đang hiển thị. Sau 409 BE tải lại `profile` (version mới) nhưng các ô vẫn là bản cũ:
  // gửi version mới kèm giá trị cũ sẽ ghi đè thầm lặng, nên chỉ gửi version đã mở và chờ người dùng tải bản mới.
  const [openedVersion, setOpenedVersion] = useState(profile?.version ?? null);
  const stale = (profile?.version ?? null) !== openedVersion;
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

  const reloadLatest = () => {
    form.reset(defaultsOf(profile));
    setOpenedVersion(profile?.version ?? null);
    setError(null);
  };

  const submit = form.handleSubmit((values) => {
    setError(null);
    // Lần đầu gửi `version: null`; đã có hồ sơ thì gửi version đang xem (người khác vừa sửa → 409, đã tải lại).
    save.mutate(
      { id: customerId, version: openedVersion, values },
      {
        onSuccess: onClose,
        onError: (failure) => {
          // BE-8: every wrong field comes back at once → mark them on the form; the zod rules stay a pre-check.
          const { fields, others } = legalProfileFieldErrors(failure);
          fields.forEach(({ field, message }, index) =>
            form.setError(field, { type: "server", message }, { shouldFocus: index === 0 }),
          );
          // A field the form has no input for: its message in the general line, never dropped — also when no field of
          // the form is named (then "check the fields" would point at nothing).
          if (others.length > 0) setError(others.join(" "));
          else if (fields.length === 0) setError(legalProfileErrorMessage(failure));
        },
      },
    );
  });

  return (
    <FormDialogBody
      title={profile ? "Sửa thông tin pháp lý" : "Nhập thông tin pháp lý"}
      description="Dùng để lập hợp đồng và hoá đơn. Tên công ty và mã số thuế lấy từ hồ sơ khách."
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
            Người khác vừa lưu thông tin pháp lý của khách này. Các ô bên dưới vẫn là bản cũ của
            bạn.{" "}
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
        <Input {...field("invoiceEmail")} inputMode="email" className={FORM_INPUT_CLASS} />
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
