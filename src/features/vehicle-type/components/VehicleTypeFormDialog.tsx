"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { UI_LABELS, VEHICLE_TYPE_KIND, VEHICLE_TYPE_STATUS } from "@/constants";

import { ApiError } from "@/lib/api/error";

import { isStaleVehicleTypeError, vehicleTypeErrorMessage } from "@/features/vehicle-type/errors";
import { vehicleTypeFormSchema } from "@/features/vehicle-type/input-schemas";
import { useCreateVehicleType, useUpdateVehicleType } from "@/features/vehicle-type/mutations";
import { useVehicleType } from "@/features/vehicle-type/queries";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { VehicleTypeFields } from "./VehicleTypeFields";

import type {
  VehicleType,
  VehicleTypeFormInput,
  VehicleTypeFormValues,
} from "@/features/vehicle-type/types";

const F = UI_LABELS.vehicleType.form;
const SERVER_FIELDS = [
  "name",
  "kind",
  "innerLengthMm",
  "innerWidthMm",
  "innerHeightMm",
  "gussetMm",
  "maxPayloadKg",
  "availableCount",
  "rentalPrice",
  "status",
] as const;

const EMPTY: VehicleTypeFormInput = {
  code: "",
  name: "",
  kind: VEHICLE_TYPE_KIND.TRUCK,
  innerLengthMm: "",
  innerWidthMm: "",
  innerHeightMm: "",
  gussetMm: "",
  maxPayloadKg: "",
  availableCount: "1",
  rentalPrice: "",
  status: VEHICLE_TYPE_STATUS.ACTIVE,
};

const valuesOf = (row: VehicleType): VehicleTypeFormInput => ({
  code: row.code,
  name: row.name,
  kind: row.kind,
  innerLengthMm: String(row.innerLengthMm),
  innerWidthMm: String(row.innerWidthMm),
  innerHeightMm: String(row.innerHeightMm),
  gussetMm: String(row.gussetMm),
  maxPayloadKg: String(row.maxPayloadKg),
  availableCount: String(row.availableCount),
  rentalPrice: row.rentalPrice == null ? "" : String(row.rentalPrice),
  status: row.status,
});

/**
 * Thêm hoặc sửa loại xe (BE `POST` / `PUT /fulfillment/vehicle-types`). Mã khoá khi sửa. Sửa gửi `version`
 * của lần đọc; gặp OPTIMISTIC_LOCK mutation tải lại chi tiết và form nạp lại bản mới (key = version).
 */
export function VehicleTypeFormDialog({
  vehicleType,
  onClose,
}: {
  /** Có = sửa loại xe này; không = thêm mới. */
  vehicleType?: VehicleType;
  onClose: () => void;
}) {
  // Bản mới nhất của dòng: người khác sửa → version đổi → form nạp lại (key) thay vì gửi version cũ
  const detail = useVehicleType(vehicleType?.vehicleTypeId);
  const current = detail.data ?? vehicleType;
  const staleError = detail.isError && isStaleVehicleTypeError(detail.error);
  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()}>
      <Form
        key={current?.version ?? "new"}
        vehicleType={current}
        reloaded={Boolean(vehicleType && current && current.version !== vehicleType.version)}
        loadError={staleError ? vehicleTypeErrorMessage(detail.error) : null}
        onClose={onClose}
      />
    </FormDialog>
  );
}

function Form({
  vehicleType,
  reloaded,
  loadError,
  onClose,
}: {
  vehicleType?: VehicleType;
  reloaded: boolean;
  loadError: string | null;
  onClose: () => void;
}) {
  const create = useCreateVehicleType();
  const update = useUpdateVehicleType();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<VehicleTypeFormInput, unknown, VehicleTypeFormValues>({
    resolver: zodResolver(vehicleTypeFormSchema),
    mode: "onChange",
    defaultValues: vehicleType ? valuesOf(vehicleType) : EMPTY,
  });

  const submit = form.handleSubmit((body) => {
    setServerError(null);
    const handlers = {
      onSuccess: () => onClose(),
      onError: (error: unknown) => {
        setServerError(vehicleTypeErrorMessage(error));
        if (!(error instanceof ApiError)) return;
        for (const name of SERVER_FIELDS) {
          const message = error.fieldErrors?.[name];
          if (message) form.setError(name, { type: "server", message });
        }
      },
    };
    if (vehicleType)
      update.mutate(
        { vehicleTypeId: vehicleType.vehicleTypeId, version: vehicleType.version, body },
        handlers,
      );
    else create.mutate(body, handlers);
  });

  return (
    <FormDialogBody
      title={vehicleType ? `${F.editTitle} ${vehicleType.code}` : F.createTitle}
      description={vehicleType ? F.editDescription : F.createDescription}
      submitLabel={vehicleType ? F.submitEdit : F.submitCreate}
      canSubmit={form.formState.isValid}
      isPending={create.isPending || update.isPending}
      error={serverError ?? loadError ?? (reloaded ? F.reloaded : null)}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <VehicleTypeFields form={form} editing={Boolean(vehicleType)} />
    </FormDialogBody>
  );
}
