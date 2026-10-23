"use client";

import { useFormContext } from "react-hook-form";

import { TextField } from "@/components/shared/TextField";

import { toggleValue, warehouseBoundRoles } from "../selectors";
import { useReferenceData } from "../use-reference-data";

import { Checklist } from "./Checklist";

import type { CreateUserFormValues } from "../types";

/** Các ô của form tạo người dùng; đọc form qua `FormProvider` của hộp thoại. */
export function CreateUserFields() {
  const form = useFormContext<CreateUserFormValues>();
  const refs = useReferenceData();
  const { errors } = form.formState;
  const roles = form.watch("roles");
  const warehouseIds = form.watch("warehouseIds");
  const needsWarehouse =
    warehouseBoundRoles(roles, refs.roles).length > 0 && warehouseIds.length === 0;
  const fieldMessage = (name: keyof CreateUserFormValues) =>
    errors[name]?.message as string | undefined;
  const set = (name: "roles" | "warehouseIds", value: string[]) =>
    form.setValue(name, value, { shouldValidate: true, shouldDirty: true });

  return (
    <>
      <TextField
        label="Tên đăng nhập"
        required
        autoComplete="off"
        error={fieldMessage("username")}
        {...form.register("username")}
      />
      <TextField
        label="Email"
        type="text"
        inputMode="email"
        required
        autoComplete="off"
        error={fieldMessage("email")}
        {...form.register("email")}
      />
      <TextField
        label="Họ tên"
        autoComplete="off"
        error={fieldMessage("fullName")}
        {...form.register("fullName")}
      />
      <TextField
        label="Mật khẩu ban đầu"
        type="password"
        autoComplete="new-password"
        hint="Tuỳ chọn. 10–72 ký tự, gồm chữ hoa, chữ thường và chữ số."
        error={fieldMessage("password")}
        {...form.register("password")}
      />
      <Checklist
        legend="Vai trò *"
        items={refs.roleItems}
        selected={roles}
        onToggle={(code) => set("roles", toggleValue(roles, code))}
        emptyText={
          refs.canReadRoles
            ? "Đang tải vai trò…"
            : "Bạn không có quyền xem danh sách vai trò nên chưa thể chọn vai trò."
        }
        error={fieldMessage("roles")}
      />
      {refs.canReadWarehouses && (
        <Checklist
          legend="Kho làm việc"
          items={refs.warehouseItems}
          selected={warehouseIds}
          onToggle={(id) => set("warehouseIds", toggleValue(warehouseIds, id))}
          emptyText="Chưa có kho nào."
        />
      )}
      {needsWarehouse && (
        <p role="status" className="text-warning text-xs">
          Vai trò đã chọn chỉ thấy dữ liệu theo kho được gán — chưa gán kho thì người dùng không
          truy cập được dữ liệu kho nào.
        </p>
      )}
    </>
  );
}
