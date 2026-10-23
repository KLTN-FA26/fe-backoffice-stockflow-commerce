"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { identityErrorMessage } from "@/lib/api/identity-errors";

import { ROLE_ADMIN } from "../role-admin-constants";
import { useUpdateRole } from "../role-mutations";
import { updateRoleFormSchema } from "../schemas";

import { RoleFormFields } from "./RoleFormFields";

import type { RoleResponse, UpdateRoleFormValues } from "../types";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditForm({
  role,
  onCancel,
  onSaved,
}: {
  role: RoleResponse;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const form = useForm<UpdateRoleFormValues>({
    resolver: zodResolver(updateRoleFormSchema),
    defaultValues: {
      name: role.name,
      description: role.description ?? "",
      dataScope: role.dataScope === "TEAM" ? "ALL" : role.dataScope,
    },
  });
  const mutation = useUpdateRole();
  const submit = form.handleSubmit((values) =>
    mutation.mutate({ roleCode: role.code, values, version: role.version }, { onSuccess: onSaved }),
  );
  return (
    <FormProvider {...form}>
      <FormDialogBody
        title={`${ROLE_ADMIN.edit}: ${role.code}`}
        description="Chỉ vai trò tuỳ chỉnh đổi được. Mã vai trò không đổi."
        submitLabel="Lưu"
        canSubmit
        isPending={mutation.isPending}
        error={mutation.error ? identityErrorMessage(mutation.error) : null}
        onSubmit={() => void submit()}
        onCancel={onCancel}
      >
        <RoleFormFields />
      </FormDialogBody>
    </FormProvider>
  );
}

export function EditRoleDialog({ open, onOpenChange, role }: DialogProps & { role: RoleResponse }) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      <EditForm
        role={role}
        onCancel={() => onOpenChange(false)}
        onSaved={() => onOpenChange(false)}
      />
    </FormDialog>
  );
}
