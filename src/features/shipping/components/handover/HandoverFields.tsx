"use client";

import { Controller } from "react-hook-form";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { isApiBookedLoad } from "@/features/shipping/ftl-selectors";
import { Checkbox } from "@/components/ui/checkbox";

import { HandoverMissingLine } from "./HandoverMissingLine";
import { HandoverOptionalFields } from "./HandoverOptionalFields";
import { HandoverTextField } from "./HandoverTextField";

import type { UseFormReturn } from "react-hook-form";
import type { HandoverFormInput, HandoverValues, Load } from "@/features/shipping/types";

const H = UI_LABELS.shipping.handover;
export const HANDOVER_SERVER_FIELDS = [
  "driverName",
  "carrierRepresentative",
  "vehiclePlate",
  "driverPhone",
  "signatureRef",
  "note",
] as const;

/**
 * Các ô của biên bản bàn giao. Bắt buộc (hiện sẵn): tên tài xế (nếu chuyến chưa có), người ký bên hãng kèm hộp kiểm
 * "Người ký là tài xế", biển số (nếu chưa có), xác nhận đã ký; ô không bắt buộc gập lại (`HandoverOptionalFields`); dòng
 * "Còn thiếu" nói ô nào còn khoá nút xác nhận (`HandoverMissingLine`).
 */
export function HandoverFields({
  form,
  load,
  signerIsDriver,
  noWaybill,
}: {
  form: UseFormReturn<HandoverFormInput, unknown, HandoverValues>;
  load: Load;
  signerIsDriver: { checked: boolean; onChange: (checked: boolean) => void };
  /** Chuyến chưa có mã vận đơn: BE từ chối ký (BR-23) — dòng "Còn thiếu" nêu mã vận đơn. */
  noWaybill: boolean;
}) {
  return (
    <>
      {!load.driverName && (
        <>
          <HandoverTextField
            form={form}
            name="driverName"
            label={H.driverName}
            max={SHIPPING_LIMITS.driverNameMax}
            required
          />
          <p className="text-ink-tertiary -mt-2 text-xs">{H.driverNameHint}</p>
        </>
      )}
      <HandoverTextField
        form={form}
        name="carrierRepresentative"
        label={H.representative}
        max={SHIPPING_LIMITS.carrierRepresentativeMax}
        required
        autoFocus
      />
      {/* Docs 09 §4.2 bước 8 (PR docs #55): chỉ khi tick, tên tài xế mới được sao chép sang ô người ký (sửa được) */}
      <label
        htmlFor="handover-signer-is-driver"
        className="-mt-1 flex items-center gap-2 text-[0.8125rem]"
      >
        <Checkbox
          id="handover-signer-is-driver"
          checked={signerIsDriver.checked}
          onCheckedChange={(checked) => signerIsDriver.onChange(checked === true)}
        />
        <span className="text-ink-primary">{H.signerIsDriver}</span>
      </label>
      <HandoverTextField
        form={form}
        name="vehiclePlate"
        label={H.vehiclePlate}
        max={SHIPPING_LIMITS.vehiclePlateMax}
        required={!load.vehiclePlate}
        mono
      />
      {load.vehiclePlate && (
        <p className="text-ink-tertiary -mt-2 text-xs">
          {isApiBookedLoad(load)
            ? UI_LABELS.shipping.ftl.booking.plateFromCarrier
            : UI_LABELS.shipping.ftl.booking.plateEnteredManually}
        </p>
      )}
      <HandoverOptionalFields form={form} load={load} />
      <Controller
        control={form.control}
        name="signed"
        render={({ field }) => (
          <label htmlFor="handover-signed" className="flex items-center gap-2 text-[0.8125rem]">
            <Checkbox
              id="handover-signed"
              aria-describedby="handover-signed-hint"
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true ? true : undefined)}
            />
            <span className="text-ink-primary">{H.signedConfirm}</span>
          </label>
        )}
      />
      {/* Nút xác nhận khoá tới khi tick — nói rõ vì sao */}
      <p id="handover-signed-hint" className="text-ink-tertiary -mt-1 pl-6 text-xs">
        {H.signedHint}
      </p>
      <HandoverMissingLine form={form} load={load} noWaybill={noWaybill} />
    </>
  );
}
