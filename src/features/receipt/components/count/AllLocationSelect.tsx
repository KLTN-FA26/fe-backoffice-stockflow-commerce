"use client";

import { useFormContext, useWatch } from "react-hook-form";

import { RECEIPT_COUNT_LABELS } from "@/constants";
import { FormSelect } from "@/components/shared/FormSelect";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { Label } from "@/components/ui/label";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { AreaOption } from "@/lib/references/warehouse-layout";
import type { ReceiptCountFormValues } from "@/features/receipt/types";

const C = RECEIPT_COUNT_LABELS.count;

/**
 * "Khu nhận cho cả phiếu": chọn một lần áp cho mọi dòng (sửa riêng từng dòng ở cột Khu nhận). Các dòng đã khác nhau thì
 * hiện "Mỗi dòng một khu". Chỉ hiện khi phiếu có nhiều dòng và kho có nhiều khu nhận hàng.
 */
export function AllLocationSelect({ areas }: { areas: readonly AreaOption[] }) {
  const { control, setValue } = useFormContext<ReceiptCountFormValues>();
  const rows = useWatch({ control, name: "rows" });
  // Một khu nhận cho cả phiếu: chọn một lần áp cho mọi dòng; các dòng đã khác nhau thì hiện "Mỗi dòng một khu"
  const firstLocation = rows[0]?.locationCode ?? "";
  const sharedLocation = rows.every((row) => row.locationCode === firstLocation)
    ? firstLocation
    : "";
  const applyLocationToAll = (code: string) =>
    rows.forEach((_, index) => setValue(`rows.${index}.locationCode`, code, { shouldDirty: true }));
  return (
    <div className="max-w-sm space-y-1">
      <Label htmlFor="count-all-location" className="text-ink-primary text-[0.8125rem]">
        {C.allLocation}
      </Label>
      <FormSelect value={sharedLocation} onValueChange={applyLocationToAll}>
        <SelectTrigger id="count-all-location" className={FORM_SELECT_CLASS}>
          <SelectValue
            placeholder={
              rows.length > 0 && sharedLocation === "" && firstLocation !== ""
                ? C.allLocationMixed
                : C.allLocationPlaceholder
            }
          />
        </SelectTrigger>
        <SelectContent>
          {areas.map((area) => (
            <SelectItem key={area.locationCode} value={area.locationCode}>
              {area.label}
            </SelectItem>
          ))}
        </SelectContent>
      </FormSelect>
      <p className="text-ink-tertiary text-xs">{C.allLocationHint}</p>
    </div>
  );
}
