"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { UI_LABELS } from "@/constants";

import { ApiError } from "@/lib/api/error";

import { isStaleVehicleTypeError, vehicleTypeErrorMessage } from "@/features/vehicle-type/errors";
import {
  conflictsOf,
  EMPTY_VEHICLE_TYPE_FORM,
  formValuesOf,
  SERVER_FIELDS,
} from "@/features/vehicle-type/form-defaults";
import { vehicleTypeFormSchema } from "@/features/vehicle-type/input-schemas";
import { useCreateVehicleType, useUpdateVehicleType } from "@/features/vehicle-type/mutations";
import { useVehicleType } from "@/features/vehicle-type/queries";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { VehicleTypeConflictPanel } from "./VehicleTypeConflictPanel";
import { VehicleTypeFields } from "./VehicleTypeFields";

import type {
  VehicleType,
  VehicleTypeFormInput,
  VehicleTypeFormValues,
} from "@/features/vehicle-type/types";

const F = UI_LABELS.vehicleType.form;

/**
 * Thêm hoặc sửa loại xe (BE `POST` / `PUT /fulfillment/vehicle-types`). Mã khoá khi sửa (loại xe mặc định
 * khoá thêm loại). Sửa gửi `version` mới nhất đã biết. Gặp OPTIMISTIC_LOCK mutation tải lại chi tiết; form
 * KHÔNG bị nạp lại — giữ nguyên phần người dùng đã nhập, hiện các ô người khác vừa đổi cạnh giá trị của
 * mình và để người dùng chọn giữ phần mình hay nạp bản mới.
 */
export function VehicleTypeFormDialog({
  vehicleType,
  onClose,
}: {
  /** Có = sửa loại xe này; không = thêm mới. */
  vehicleType?: VehicleType;
  onClose: () => void;
}) {
  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()}>
      <Form vehicleType={vehicleType} onClose={onClose} />
    </FormDialog>
  );
}

function Form({ vehicleType, onClose }: { vehicleType?: VehicleType; onClose: () => void }) {
  const create = useCreateVehicleType();
  const update = useUpdateVehicleType();
  const [serverError, setServerError] = useState<string | null>(null);
  // Version mà form đang dựa vào; bản mới của BE có version lớn hơn = người khác đã sửa trước
  const [baseVersion, setBaseVersion] = useState(vehicleType?.version ?? 0);
  const detail = useVehicleType(vehicleType?.vehicleTypeId);
  const server = detail.data && detail.data.version > baseVersion ? detail.data : undefined;
  const loadError =
    detail.isError && isStaleVehicleTypeError(detail.error)
      ? vehicleTypeErrorMessage(detail.error)
      : null;
  const form = useForm<VehicleTypeFormInput, unknown, VehicleTypeFormValues>({
    resolver: zodResolver(vehicleTypeFormSchema),
    mode: "onChange",
    defaultValues: vehicleType ? formValuesOf(vehicleType) : EMPTY_VEHICLE_TYPE_FORM,
  });
  const mine = useWatch({ control: form.control });
  const conflicts = server ? conflictsOf(server, mine) : [];
  const context = { updatingPreset: vehicleType?.preset === true };

  const submit = form.handleSubmit((body) => {
    setServerError(null);
    const handlers = {
      onSuccess: () => onClose(),
      onError: (error: unknown) => {
        setServerError(vehicleTypeErrorMessage(error, context));
        if (!(error instanceof ApiError)) return;
        for (const name of SERVER_FIELDS) {
          const message = error.fieldErrors?.[name];
          if (message) form.setError(name, { type: "server", message });
        }
      },
    };
    if (vehicleType)
      update.mutate(
        {
          vehicleTypeId: vehicleType.vehicleTypeId,
          // Version mới nhất đã biết: sau 409 lần lưu lại gửi đúng version, phần đã nhập vẫn còn nguyên
          version: Math.max(baseVersion, server?.version ?? 0),
          body,
        },
        handlers,
      );
    else create.mutate(body, handlers);
  });

  const adopt = (latest: VehicleType, reset: boolean) => {
    if (reset) form.reset(formValuesOf(latest));
    setBaseVersion(latest.version);
    setServerError(null);
  };

  return (
    <FormDialogBody
      title={vehicleType ? `${F.editTitle} ${vehicleType.code}` : F.createTitle}
      description={vehicleType ? F.editDescription : F.createDescription}
      submitLabel={vehicleType ? F.submitEdit : F.submitCreate}
      canSubmit={form.formState.isValid}
      isPending={create.isPending || update.isPending}
      error={serverError ?? loadError}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      {server && conflicts.length > 0 && (
        <VehicleTypeConflictPanel
          conflicts={conflicts}
          onReload={() => adopt(server, true)}
          onKeep={() => adopt(server, false)}
        />
      )}
      <VehicleTypeFields form={form} editing={Boolean(vehicleType)} preset={vehicleType?.preset} />
    </FormDialogBody>
  );
}
