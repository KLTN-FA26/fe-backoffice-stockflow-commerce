"use client";

import { useWatch } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { joinVnAddress, useVnProvinces, useVnWards } from "@/lib/references/vn-divisions";

import { Alert } from "@/components/shared/Alert";

import { FormField, TextInput } from "../shared/form-parts";
import { DivisionCombobox } from "./DivisionCombobox";

import type { UseFormReturn } from "react-hook-form";
import type { WarehouseCreateBody, WarehouseCreateInput } from "@/features/warehouse-map/types";

const L = UI_LABELS.warehouseMap;
const F = L.form;

type Form = UseFormReturn<WarehouseCreateInput, unknown, WarehouseCreateBody>;
const VALIDATE = { shouldValidate: true, shouldDirty: true } as const;

/**
 * Địa chỉ kho theo đơn vị hành chính 2 cấp: chọn tỉnh / thành → phường / xã của tỉnh đó → số nhà, tên
 * đường; xem trước chuỗi sẽ lưu (BE chỉ có một trường `address`). API tỉnh / xã lỗi → nhập tay tên.
 */
export function WarehouseAddressFields({ form }: { form: Form }) {
  const [provinceCode, provinceName, wardName, street] = useWatch({
    control: form.control,
    name: ["provinceCode", "provinceName", "wardName", "street"],
  });
  const provinces = useVnProvinces();
  const wards = useVnWards(provinceCode ? Number(provinceCode) : null);
  const errors = form.formState.errors;
  const manual = provinces.isError;
  const preview = joinVnAddress(street, wardName, provinceName);

  return (
    <section className="space-y-3">
      <h3 className="text-ink-primary text-sm font-semibold">{F.sectionAddress}</h3>
      {manual && <Alert tone="warning">{F.divisionFailed}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          id="wh-province"
          label={L.field.province}
          required
          error={errors.provinceName?.message}
        >
          {manual ? (
            <TextInput
              id="wh-province"
              error={errors.provinceName?.message}
              {...form.register("provinceName")}
            />
          ) : (
            <DivisionCombobox
              id="wh-province"
              label={L.field.province}
              placeholder={F.provincePlaceholder}
              value={provinceName}
              items={provinces.data}
              loading={provinces.isPending}
              error={errors.provinceName?.message}
              onSelect={(province) => {
                form.setValue("provinceCode", String(province.code));
                form.setValue("provinceName", province.name, VALIDATE);
                // Đổi tỉnh → phường / xã cũ không còn thuộc tỉnh mới
                form.setValue("wardName", "", { shouldDirty: true });
              }}
            />
          )}
        </FormField>
        <FormField id="wh-ward" label={L.field.ward} required error={errors.wardName?.message}>
          {manual || wards.isError ? (
            <TextInput
              id="wh-ward"
              error={errors.wardName?.message}
              {...form.register("wardName")}
            />
          ) : (
            <DivisionCombobox
              id="wh-ward"
              label={L.field.ward}
              placeholder={provinceCode ? F.wardPlaceholder : F.wardNeedsProvince}
              value={wardName}
              items={wards.data}
              loading={wards.isPending}
              disabled={!provinceCode}
              error={errors.wardName?.message}
              onSelect={(ward) => form.setValue("wardName", ward.name, VALIDATE)}
            />
          )}
        </FormField>
      </div>
      <FormField id="wh-street" label={L.field.street} required error={errors.street?.message}>
        <TextInput
          id="wh-street"
          error={errors.street?.message}
          autoComplete="off"
          placeholder={F.streetPlaceholder}
          {...form.register("street")}
        />
      </FormField>
      {preview && (
        <p className="text-ink-tertiary text-xs">
          {F.addressPreview}: <span className="text-ink-secondary">{preview}</span>
        </p>
      )}
    </section>
  );
}
