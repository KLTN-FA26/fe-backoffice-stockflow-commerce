"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { STORAGE_CLASS_LABELS, STORAGE_CLASSES, UI_LABELS } from "@/constants";

import { EMPTY_SHELF_FORM, shelfCreateSchema } from "@/features/warehouse-map/input-schemas-layout";
import { useCreateShelf } from "@/features/warehouse-map/mutations";

import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { FormCheck } from "../../shared/FormCheck";
import { FormText } from "../../shared/FormText";
import { optionsOf, SelectField } from "../../shared/SelectField";
import { PlacementFields } from "./PlacementFields";
import { ShelfBinFields } from "./ShelfBinFields";
import { useEditorError } from "./useEditorSubmit";

import type {
  ShelfCreateInput,
  ShelfCreateStep,
  ShelfCreateValues,
  WarehouseLayout,
} from "@/features/warehouse-map/types";

const L = UI_LABELS.warehouseMap;
const E = L.editor;
const FACES = ["north", "east", "south", "west"] as const;
/** Giá trị "không thuộc zone" của ô chọn (Radix Select không nhận chuỗi rỗng). */
const NO_ZONE = "none";

const stepText = (step: ShelfCreateStep | null) => {
  if (!step) return null;
  if (step.phase === "shelf") return E.progressShelf;
  if (step.phase === "levels") return E.progressLevels(step.done + 1, step.total);
  return E.progressBins;
};

/**
 * Thêm kệ (docs 06 §4.1 bước 5–7): mã (không đổi, BR-13), vị trí / kích thước / góc xoay, zone, mặt
 * lấy hàng, lớp lưu trữ mặc định, rồi tầng và tự sinh bin. Cần `warehouse-locations:CREATE`.
 */
export function ShelfDialog({ layout, onClose }: { layout: WarehouseLayout; onClose: () => void }) {
  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()}>
      <ShelfForm layout={layout} onClose={onClose} />
    </FormDialog>
  );
}

function ShelfForm({ layout, onClose }: { layout: WarehouseLayout; onClose: () => void }) {
  const create = useCreateShelf();
  const [step, setStep] = useState<ShelfCreateStep | null>(null);
  const form = useForm<ShelfCreateInput, unknown, ShelfCreateValues>({
    resolver: zodResolver(shelfCreateSchema(layout)),
    mode: "onChange",
    defaultValues: { ...EMPTY_SHELF_FORM, zoneId: NO_ZONE },
  });
  const error = useEditorError(form);
  const zoneOptions = [
    { value: NO_ZONE, label: E.none },
    ...layout.zones.map((zone) => ({ value: zone.id, label: zone.name })),
  ];
  const submit = form.handleSubmit((values) => {
    error.clear();
    create.mutate(
      {
        warehouseId: layout.warehouse.id,
        values: { ...values, zoneId: values.zoneId === NO_ZONE ? "" : values.zoneId },
        onStep: setStep,
      },
      { onSuccess: onClose, onError: error.onError, onSettled: () => setStep(null) },
    );
  });

  return (
    <FormDialogBody
      title={E.shelfTitle}
      description={stepText(step) ?? E.shelfDescription}
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
            id="shelf-code"
            label={E.code}
            required
            kind="code"
            autoFocus
          />
          <FormText form={form} name="name" id="shelf-name" label={E.name} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            control={form.control}
            name="zoneId"
            id="shelf-zone"
            label={L.panel.zone}
            options={zoneOptions}
          />
          <SelectField
            control={form.control}
            name="defaultStorageClass"
            id="shelf-storageClass"
            label={E.defaultStorageClass}
            options={optionsOf(STORAGE_CLASSES, STORAGE_CLASS_LABELS)}
          />
        </div>
        <PlacementFields form={form} idPrefix="shelf" />
        <fieldset className="space-y-1.5">
          <legend className="text-ink-secondary text-xs font-medium">{E.pickFaces}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {FACES.map((face) => (
              <FormCheck key={face} control={form.control} name={face} label={L.faces[face]} />
            ))}
          </div>
          {form.formState.errors.north?.message && (
            <p role="alert" className="text-danger text-xs">
              {form.formState.errors.north.message}
            </p>
          )}
        </fieldset>
        <ShelfBinFields form={form} />
      </DialogScrollArea>
    </FormDialogBody>
  );
}
