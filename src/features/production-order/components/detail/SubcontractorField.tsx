"use client";

import { SUPPLIER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { usePrintSubcontractorOptions } from "@/lib/references/supplier-options";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";

import type { UseFormRegisterReturn } from "react-hook-form";

/**
 * Nhà gia công cho phần LSX tách ra (SCRUM-441). BR-PRD-11: chỉ NCC là nhà gia công in —
 * `GET /suppliers?printSubcontractor=true` (BE PR #109; WAREHOUSE_MANAGER có `procurement-suppliers:READ` từ
 * V20261017000800). Không có ô nhập mã NCC.
 */
export function SubcontractorField({
  registration,
  error,
}: {
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  const canList = useCan(SUPPLIER_PERMISSIONS.read);
  const suppliers = usePrintSubcontractorOptions(canList);
  const options = suppliers.data ?? [];
  let hint = "Chỉ hiện NCC đang hoạt động được đánh dấu là nhà gia công in.";
  if (!canList) hint = "Tài khoản chưa được cấp quyền xem danh sách NCC — chưa tách gia công được.";
  else if (suppliers.isPending) hint = "Đang tải nhà gia công…";
  else if (suppliers.isError)
    hint = "Không tải được danh sách nhà gia công. Đóng và mở lại hộp thoại để thử lại.";
  else if (options.length === 0) hint = "Chưa có NCC nào được đánh dấu là nhà gia công in.";

  return (
    <FormField id="split-supplier" label="Nhà gia công" required error={error} hint={hint}>
      <select
        {...registration}
        {...fieldA11y("split-supplier", error, true)}
        disabled={options.length === 0}
        className={`${FORM_INPUT_CLASS} border px-2`}
      >
        <option value="">— Chọn nhà gia công —</option>
        {options.map((supplier) => (
          <option key={supplier.supplierId} value={supplier.supplierId}>
            {supplier.code} — {supplier.name}
          </option>
        ))}
      </select>
    </FormField>
  );
}
