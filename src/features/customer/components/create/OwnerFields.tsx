"use client";

import { Controller } from "react-hook-form";

import { CUSTOMER_CREATE_OWNER_LABELS as L } from "@/constants";
import { useAssignableSales } from "@/lib/references/sales-agents";
import { SalesPickerField } from "@/components/backoffice/SalesPickerField";
import { Card } from "@/components/shared/Card";

import type { UseFormReturn } from "react-hook-form";
import type { CustomerCreateFormValues } from "@/features/customer/types";

/**
 * Sale phụ trách của khách mới — khách mới luôn có người phụ trách (chốt 28/11):
 * - tạo từ khách tiềm năng (`fromLead`) → người được giao lead (§10.7), không chọn;
 * - người điều phối (`isManager`: Sales Manager, quản trị) → BẮT BUỘC chọn một Sale giao được (D42: SALES_STAFF đang làm,
 *   `useAssignableSales`); không tải được danh sách thì báo, không cho bỏ qua (BE trả 400 SALES_OWNER_REQUIRED);
 * - Sale → chính họ (BR-S02, tình huống 1), chỉ nói khi tính năng có (`ownerKnown`).
 * UI-only — Backend phải re-check (400 SALES_OWNER_REQUIRED, 422 SALES_OWNER_NOT_ASSIGNABLE).
 */
export function OwnerFields({
  form,
  isManager,
  fromLead,
  ownerKnown,
}: {
  form: UseFormReturn<CustomerCreateFormValues>;
  isManager: boolean;
  fromLead: boolean;
  ownerKnown: boolean;
}) {
  const sales = useAssignableSales(isManager && !fromLead);
  const error = form.formState.errors.salesOwnerId?.message;
  if (fromLead)
    return (
      <Card>
        <p className="text-ink-secondary text-[0.8125rem]">{L.fromLead}</p>
      </Card>
    );
  if (!isManager)
    return ownerKnown ? (
      <Card>
        <p className="text-ink-secondary text-[0.8125rem]">{L.ownerSelf}</p>
      </Card>
    ) : null;
  const options = sales.options
    ? [...sales.options].sort((a, b) => a.name.localeCompare(b.name, "vi"))
    : null;
  return (
    <Card className="grid gap-4 sm:grid-cols-2">
      <h2 className="text-ink-primary text-sm font-semibold sm:col-span-2">{L.ownerSection}</h2>
      {options ? (
        <Controller
          control={form.control}
          name="salesOwnerId"
          render={({ field }) => (
            <SalesPickerField
              id="customer-salesOwnerId"
              label={L.ownerLabel}
              required
              value={field.value ?? ""}
              onChange={field.onChange}
              options={options}
              placeholder={L.ownerPlaceholder}
              hint={L.ownerHint}
              error={error}
            />
          )}
        />
      ) : (
        <div className="space-y-1 sm:col-span-2">
          <p className="text-ink-secondary text-[0.8125rem]">
            {sales.options === undefined ? L.ownerLoading : L.ownerUnavailable}
          </p>
          {error && (
            <p role="alert" className="text-danger text-xs">
              {error}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
