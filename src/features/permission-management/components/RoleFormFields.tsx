"use client";

import { Controller, useFormContext } from "react-hook-form";

import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { FORM_SELECT_CLASS, FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { TextField } from "@/components/shared/TextField";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { DATA_SCOPE_LABELS } from "@/constants";

import { ROLE_ADMIN } from "../role-admin-constants";

import type { UpdateRoleFormValues } from "../types";

/**
 * Ô chung của hộp thoại tạo / sửa vai trò: tên, mô tả, phạm vi dữ liệu. Đọc form qua `FormProvider`
 * của hộp thoại (form tạo là tập cha của form sửa nên các ô này có mặt ở cả hai).
 */
export function RoleFormFields({ currentScope }: { currentScope?: string }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<UpdateRoleFormValues>();
  // Phạm vi hiện tại mà BE không cho đặt mới (TEAM): vẫn hiện để chọn lại, không bị đổi ngầm
  const extraScope =
    currentScope &&
    currentScope in DATA_SCOPE_LABELS &&
    ROLE_ADMIN.scopeOptions.filter((option) => option.value === currentScope).length === 0
      ? (currentScope as keyof typeof DATA_SCOPE_LABELS)
      : null;
  return (
    <>
      <TextField
        label="Tên vai trò"
        required
        autoComplete="off"
        error={errors.name?.message}
        {...register("name")}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="role-description" className="text-ink-secondary text-xs font-medium">
          Mô tả
        </Label>
        <Textarea
          id="role-description"
          rows={2}
          className={FORM_TEXTAREA_CLASS}
          {...register("description")}
        />
        {errors.description?.message && (
          <p className="text-danger text-xs">{errors.description.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="role-scope" className="text-ink-secondary text-xs font-medium">
          Phạm vi dữ liệu
        </Label>
        <Controller
          control={control}
          name="dataScope"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="role-scope" className={FORM_SELECT_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <TitledSelectContent title="Phạm vi dữ liệu">
                {extraScope && (
                  <SelectItem value={extraScope}>
                    {DATA_SCOPE_LABELS[extraScope]} (hiện tại)
                  </SelectItem>
                )}
                {ROLE_ADMIN.scopeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </Select>
          )}
        />
      </div>
    </>
  );
}
