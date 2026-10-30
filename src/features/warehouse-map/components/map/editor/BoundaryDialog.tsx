"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  BOUNDARY_TYPE,
  BOUNDARY_TYPE_LABELS,
  BOUNDARY_TYPES,
  DOOR_STATUS_LABELS,
  DOOR_STATUSES,
  UI_LABELS,
} from "@/constants";

import { boundaryCreateSchema } from "@/features/warehouse-map/input-schemas";
import { useCreateBoundary } from "@/features/warehouse-map/mutations";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { FormCheck } from "../../shared/FormCheck";
import { FormText } from "../../shared/FormText";
import { optionsOf, SelectField } from "../../shared/SelectField";
import { useEditorError } from "./useEditorSubmit";

import type {
  BoundaryCreateBody,
  BoundaryCreateInput,
  WarehouseLayout,
} from "@/features/warehouse-map/types";

const E = UI_LABELS.warehouseMap.editor;
type PointKey = "startX" | "startY" | "endX" | "endY";

/**
 * Vẽ tường / cửa bằng hai đầu mút (docs 06 §4.1 bước 3). Tường luôn không đi qua được, không có
 * trạng thái; cửa có "đi qua được" và Mở / Đóng. Hai đầu nằm trong khung (BR-06).
 */
export function BoundaryDialog({
  layout,
  onClose,
}: {
  layout: WarehouseLayout;
  onClose: () => void;
}) {
  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()}>
      <BoundaryForm layout={layout} onClose={onClose} />
    </FormDialog>
  );
}

function BoundaryForm({ layout, onClose }: { layout: WarehouseLayout; onClose: () => void }) {
  const create = useCreateBoundary();
  const form = useForm<BoundaryCreateInput, unknown, BoundaryCreateBody>({
    resolver: zodResolver(boundaryCreateSchema(layout.warehouse)),
    mode: "onChange",
    defaultValues: {
      type: BOUNDARY_TYPE.WALL,
      startX: "",
      startY: "",
      endX: "",
      endY: "",
      passable: true,
      operationalStatus: "OPEN",
    },
  });
  const error = useEditorError(form);
  const door = useWatch({ control: form.control, name: "type" }) === BOUNDARY_TYPE.DOOR;
  const submit = form.handleSubmit((body) => {
    error.clear();
    create.mutate(
      { warehouseId: layout.warehouse.id, body },
      { onSuccess: onClose, onError: error.onError },
    );
  });
  const point = (key: PointKey) => (
    <FormText form={form} name={key} id={`bd-${key}`} label={E[key]} required kind="numeric" />
  );

  return (
    <FormDialogBody
      title={E.boundaryTitle}
      description={layout.warehouse.name}
      submitLabel={E.submit}
      canSubmit={form.formState.isValid}
      isPending={create.isPending}
      error={error.serverError}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <SelectField
        control={form.control}
        name="type"
        id="bd-type"
        label={E.type}
        options={optionsOf(BOUNDARY_TYPES, BOUNDARY_TYPE_LABELS)}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {point("startX")}
        {point("startY")}
        {point("endX")}
        {point("endY")}
      </div>
      {door && (
        <div className="grid grid-cols-2 items-end gap-3">
          <SelectField
            control={form.control}
            name="operationalStatus"
            id="bd-door-status"
            label={E.doorStatus}
            options={optionsOf(DOOR_STATUSES, DOOR_STATUS_LABELS)}
          />
          <FormCheck control={form.control} name="passable" label={E.passable} className="pb-2" />
        </div>
      )}
    </FormDialogBody>
  );
}
