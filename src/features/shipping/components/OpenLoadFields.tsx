"use client";

import { Controller } from "react-hook-form";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { CarrierSelect } from "./CarrierSelect";
import { FieldError, MONO, fieldClass } from "./primitives";
import { WarehouseSelect } from "./WarehouseSelect";

import type { UseFormReturn } from "react-hook-form";
import type { OpenLoadFormInput, OpenLoadValues, ShipmentRow } from "@/features/shipping/types";

const D = UI_LABELS.shipping.openDialog;
export const OPEN_LOAD_SERVER_FIELDS = ["vehiclePlate", "driverName", "driverPhone"] as const;

/** Các ô của hộp thoại mở chuyến: lô đưa lên, kho, hãng (khoá theo các lô đã chọn), xe, tài xế. */
export function OpenLoadFields({
  form,
  shipments,
  lockedWarehouse,
  lockedCarrier,
}: {
  form: UseFormReturn<OpenLoadFormInput, unknown, OpenLoadValues>;
  shipments: readonly ShipmentRow[];
  lockedWarehouse: boolean;
  lockedCarrier: boolean;
}) {
  const errors = form.formState.errors;
  const text = (
    name: (typeof OPEN_LOAD_SERVER_FIELDS)[number],
    label: string,
    max: number,
    mono = false,
  ) => (
    <div>
      <Label htmlFor={`open-${name}`} className="text-ink-secondary mb-1 block text-xs font-medium">
        {label}
      </Label>
      <Input
        id={`open-${name}`}
        maxLength={max}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `open-${name}-error` : undefined}
        className={`${fieldClass(!!errors[name])} ${mono ? MONO : ""}`}
        {...form.register(name)}
      />
      <FieldError id={`open-${name}-error`}>{errors[name]?.message}</FieldError>
    </div>
  );

  return (
    <>
      <div>
        <div className="text-ink-secondary mb-1 text-xs font-medium">{D.shipmentsLabel}</div>
        <p className={`text-ink-primary text-[0.8125rem] ${MONO}`}>
          {shipments.length > 0 ? shipments.map((row) => row.code).join(", ") : D.shipmentsAuto}
        </p>
      </div>
      <div>
        <Label
          htmlFor="open-warehouse"
          className="text-ink-secondary mb-1 block text-xs font-medium"
        >
          {D.warehouse} <span className="text-danger">*</span>
        </Label>
        <Controller
          control={form.control}
          name="warehouseId"
          render={({ field }) => (
            <WarehouseSelect
              id="open-warehouse"
              value={field.value}
              onChange={field.onChange}
              disabled={lockedWarehouse}
            />
          )}
        />
        <FieldError>{errors.warehouseId?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="open-carrier" className="text-ink-secondary mb-1 block text-xs font-medium">
          {D.carrier} <span className="text-danger">*</span>
        </Label>
        <Controller
          control={form.control}
          name="carrierId"
          render={({ field }) => (
            <CarrierSelect
              id="open-carrier"
              value={field.value || null}
              onChange={(carrierId) => field.onChange(carrierId ?? "")}
              disabled={lockedCarrier}
            />
          )}
        />
        <FieldError>{errors.carrierId?.message}</FieldError>
      </div>
      {text("vehiclePlate", D.vehiclePlate, SHIPPING_LIMITS.vehiclePlateMax, true)}
      {text("driverName", D.driverName, SHIPPING_LIMITS.driverNameMax)}
      {text("driverPhone", D.driverPhone, SHIPPING_LIMITS.driverPhoneMax, true)}
    </>
  );
}
