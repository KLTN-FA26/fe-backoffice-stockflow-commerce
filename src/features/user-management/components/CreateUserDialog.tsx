"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";

import { identityErrorMessage, identityFieldErrors } from "@/lib/api/identity-errors";

import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { createUserFormSchema } from "../schemas";
import { useCreateUser } from "../mutations";
import { useReferenceData } from "../use-reference-data";

import { CreateUserFields } from "./CreateUserFields";

import type { CreatedUser, CreateUserFormValues } from "../types";

const EMPTY: CreateUserFormValues = {
  username: "",
  email: "",
  fullName: "",
  password: "",
  roles: [],
  warehouseIds: [],
};

export function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (created: CreatedUser) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      <CreateUserForm onCancel={() => onOpenChange(false)} onCreated={onCreated} />
    </FormDialog>
  );
}

function CreateUserForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (created: CreatedUser) => void;
}) {
  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: EMPTY,
  });
  const mutation = useCreateUser();
  const refs = useReferenceData();

  const submit = form.handleSubmit((values) =>
    mutation.mutate(values, {
      onSuccess: (created) => {
        onCreated(created);
        // Mật khẩu (gõ vào và BE sinh) chỉ còn trong state của màn; bỏ khỏi MutationCache ngay
        mutation.reset();
      },
      onError: (error) => {
        for (const { field, message } of identityFieldErrors(error)) {
          if (field in EMPTY) form.setError(field as keyof CreateUserFormValues, { message });
        }
      },
    }),
  );

  return (
    <FormProvider {...form}>
      <FormDialogBody
        title="Thêm người dùng"
        description="Tạo tài khoản nhân viên. Bỏ trống mật khẩu để hệ thống tự sinh mật khẩu tạm — hiển thị đúng một lần sau khi tạo."
        submitLabel="Tạo tài khoản"
        canSubmit={refs.canReadRoles}
        isPending={mutation.isPending}
        error={
          mutation.error && !identityFieldErrors(mutation.error).length
            ? identityErrorMessage(mutation.error)
            : null
        }
        onSubmit={() => void submit()}
        onCancel={onCancel}
      >
        <DialogScrollArea>
          <CreateUserFields />
        </DialogScrollArea>
      </FormDialogBody>
    </FormProvider>
  );
}
