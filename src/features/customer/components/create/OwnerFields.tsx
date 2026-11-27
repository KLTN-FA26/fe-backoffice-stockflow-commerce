"use client";

import { Controller } from "react-hook-form";

import { CUSTOMER_CREATE_OWNER_LABELS as L } from "@/constants";
import { useAssignableSales } from "@/lib/references/sales-agents";
import { salesOptionLabel } from "@/components/backoffice/SalesPickerField";
import { Card } from "@/components/shared/Card";
import { FormField } from "@/components/shared/FormField";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";

import type { UseFormReturn } from "react-hook-form";
import type { CustomerCreateFormValues } from "@/features/customer/types";

/** Mục "để trống" của ô chọn (SelectItem không nhận value rỗng). */
const NONE = "__none__";

/**
 * Sale phụ trách của khách mới:
 * - tạo từ khách tiềm năng (`fromLead`) → người được giao lead (§10.7), không chọn;
 * - Sales Manager (`isManager`) → chọn một Sale giao được (D42: SALES_STAFF đang làm, `useAssignableSales`), hoặc để
 *   trống (BR-S02, tình huống 2);
 * - Sale → chính họ (BR-S02, tình huống 1), chỉ nói khi tính năng có (`ownerKnown`).
 * UI-only — Backend phải re-check (422 SALES_OWNER_NOT_ASSIGNABLE).
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
  // Không tải được danh sách Sale → không có ô chọn (khách tạo ra chưa có người phụ trách, Manager giao sau).
  if (!sales.options) return null;
  const options = [...sales.options].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return (
    <Card className="grid gap-4 sm:grid-cols-2">
      <h2 className="text-ink-primary text-sm font-semibold sm:col-span-2">{L.ownerSection}</h2>
      <FormField id="customer-salesOwnerId" label={L.ownerLabel} hint={L.ownerHint} error={error}>
        <Controller
          control={form.control}
          name="salesOwnerId"
          render={({ field }) => (
            <Select
              value={field.value ? field.value : NONE}
              onValueChange={(next) => field.onChange(next === NONE ? "" : next)}
            >
              <SelectTrigger
                id="customer-salesOwnerId"
                className={FORM_SELECT_CLASS}
                aria-describedby="customer-salesOwnerId-hint"
              >
                <SelectValue />
              </SelectTrigger>
              <TitledSelectContent title={L.ownerLabel}>
                <SelectItem value={NONE}>{L.ownerNone}</SelectItem>
                {options.map((option) => (
                  <SelectItem key={option.userId} value={option.userId}>
                    {salesOptionLabel(option)}
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </Select>
          )}
        />
      </FormField>
    </Card>
  );
}
