"use client";

import { Controller, useFormContext } from "react-hook-form";

import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { FORM_SELECT_CLASS, FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { TextField } from "@/components/shared/TextField";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { ROLE_ADMIN } from "../role-admin-constants";

import type { UpdateRoleFormValues } from "../types";

/**
 * Ô chung của hộp thoại tạo / sửa vai trò: tên, mô tả, phạm vi dữ liệu. Đọc form qua `FormProvider`
 * của hộp thoại (form tạo là tập cha của form sửa nên các ô này có mặt ở cả hai).
 */
export function RoleFormFields() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<UpdateRoleFormValues>();
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
