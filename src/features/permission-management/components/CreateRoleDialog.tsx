"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm } from "react-hook-form";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { TextField } from "@/components/shared/TextField";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { identityErrorMessage, identityFieldErrors } from "@/lib/api/identity-errors";

import { ROLE_ADMIN } from "../role-admin-constants";
import { useCreateRole } from "../role-mutations";
import { createRoleFormSchema } from "../schemas";

import { RoleFormFields } from "./RoleFormFields";

import type { CreateRoleFormValues, RoleResponse } from "../types";

const NONE = "__none__";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateForm({
  roles,
  onCancel,
  onCreated,
}: {
  roles: readonly RoleResponse[];
  onCancel: () => void;
  onCreated: (role: RoleResponse) => void;
}) {
  const form = useForm<CreateRoleFormValues>({
    resolver: zodResolver(createRoleFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      copyPermissionsFrom: "",
      dataScope: "ALL",
    },
  });
  const mutation = useCreateRole();
  const fieldErrors = mutation.error ? identityFieldErrors(mutation.error) : [];
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) => mutation.mutate(values, { onSuccess: onCreated }));
  return (
    <FormProvider {...form}>
      <FormDialogBody
        title={ROLE_ADMIN.create}
        description="Vai trò mới chưa có quyền nào (trừ khi sao chép). Sau khi tạo, tick quyền bằng ma trận ngay bên dưới."
        submitLabel={ROLE_ADMIN.create}
        canSubmit
        isPending={mutation.isPending}
        error={
          mutation.error && fieldErrors.every((item) => item.field !== "code")
            ? identityErrorMessage(mutation.error)
            : null
        }
        onSubmit={() => void submit()}
        onCancel={onCancel}
      >
        <TextField
          label="Mã vai trò"
          required
          autoComplete="off"
          hint="Chữ cái, số, gạch dưới; bắt đầu bằng chữ cái. Không đổi được sau khi tạo."
          error={errors.code?.message ?? fieldErrors.find((item) => item.field === "code")?.message}
          {...form.register("code")}
        />
        <RoleFormFields />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role-copy" className="text-ink-secondary text-xs font-medium">
            Sao chép quyền từ
          </Label>
          <Controller
            control={form.control}
            name="copyPermissionsFrom"
            render={({ field }) => (
              <Select
                value={field.value || NONE}
                onValueChange={(value) => field.onChange(value === NONE ? "" : value)}
              >
                <SelectTrigger id="role-copy" className={FORM_SELECT_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <TitledSelectContent title="Vai trò nguồn">
                  <SelectItem value={NONE}>{ROLE_ADMIN.copyNone}</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.code} value={role.code}>
                      {role.name}
                    </SelectItem>
                  ))}
                </TitledSelectContent>
              </Select>
            )}
          />
        </div>
      </FormDialogBody>
    </FormProvider>
  );
}

export function CreateRoleDialog({
  open,
  onOpenChange,
  roles,
  onCreated,
}: DialogProps & { roles: readonly RoleResponse[]; onCreated: (role: RoleResponse) => void }) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      <CreateForm roles={roles} onCancel={() => onOpenChange(false)} onCreated={onCreated} />
    </FormDialog>
  );
}
