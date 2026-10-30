"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { AREA_TYPE_LABELS, AREA_TYPES, UI_LABELS } from "@/constants";

import {
  areaCreateSchema,
  EMPTY_AREA_FORM,
  isStorageArea,
} from "@/features/warehouse-map/input-schemas-layout";
import { useCreateArea } from "@/features/warehouse-map/mutations";

import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { FormText } from "../../shared/FormText";
import { optionsOf, SelectField } from "../../shared/SelectField";
import { LocationFields } from "./LocationFields";
import { PlacementFields } from "./PlacementFields";
import { useEditorError } from "./useEditorSubmit";

import type {
  AreaCreateInput,
  AreaCreateValues,
  WarehouseLayout,
} from "@/features/warehouse-map/types";

const E = UI_LABELS.warehouseMap.editor;

/**
 * Đặt khu vực trên sàn (docs 06 §4.1 bước 4): khu chứa hàng có thêm thuộc tính vị trí và được hệ thống
 * cấp mã `PREFIX-MÃKHU` (BR-10); khu `NON_STORAGE` không phải vị trí tồn kho (BR-11).
 */
export function AreaDialog({ layout, onClose }: { layout: WarehouseLayout; onClose: () => void }) {
  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()}>
      <AreaForm layout={layout} onClose={onClose} />
    </FormDialog>
  );
}

function AreaForm({ layout, onClose }: { layout: WarehouseLayout; onClose: () => void }) {
  const create = useCreateArea();
  const form = useForm<AreaCreateInput, unknown, AreaCreateValues>({
    resolver: zodResolver(areaCreateSchema(layout)),
    mode: "onChange",
    defaultValues: EMPTY_AREA_FORM,
  });
  const error = useEditorError(form);
  const storage = isStorageArea(useWatch({ control: form.control, name: "type" }));
  const submit = form.handleSubmit((values) => {
    error.clear();
    create.mutate(
      { warehouseId: layout.warehouse.id, values },
      { onSuccess: onClose, onError: error.onError },
    );
  });

  return (
    <FormDialogBody
      title={E.areaTitle}
      description={layout.warehouse.name}
      submitLabel={E.submit}
      canSubmit={form.formState.isValid}
      isPending={create.isPending}
      error={error.serverError}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <DialogScrollArea>
        <div className="grid grid-cols-2 gap-3">
          <FormText
            form={form}
            name="code"
            id="area-code"
            label={E.code}
            required
            kind="code"
            autoFocus
          />
          <SelectField
            control={form.control}
            name="type"
            id="area-type"
            label={E.type}
            options={optionsOf(AREA_TYPES, AREA_TYPE_LABELS)}
          />
        </div>
        <FormText form={form} name="name" id="area-name" label={E.name} required />
        <PlacementFields form={form} idPrefix="area" />
        {storage && <LocationFields form={form} idPrefix="area" storageClassName="storageClass" />}
      </DialogScrollArea>
    </FormDialogBody>
  );
}
