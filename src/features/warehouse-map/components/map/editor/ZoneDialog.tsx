"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { UI_LABELS } from "@/constants";

import { zoneCreateSchema } from "@/features/warehouse-map/input-schemas";
import { useCreateZone } from "@/features/warehouse-map/mutations";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { FormText } from "../../shared/FormText";
import { useEditorError } from "./useEditorSubmit";

import type {
  WarehouseLayout,
  ZoneCreateBody,
  ZoneCreateInput,
} from "@/features/warehouse-map/types";

const E = UI_LABELS.warehouseMap.editor;

/** Thêm zone (docs 06 §4.1 bước 2): nhóm kệ tuỳ chọn, tên duy nhất trong kho, màu `#RRGGBB` tuỳ chọn. */
export function ZoneDialog({ layout, onClose }: { layout: WarehouseLayout; onClose: () => void }) {
  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()}>
      <ZoneForm layout={layout} onClose={onClose} />
    </FormDialog>
  );
}

function ZoneForm({ layout, onClose }: { layout: WarehouseLayout; onClose: () => void }) {
  const create = useCreateZone();
  const form = useForm<ZoneCreateInput, unknown, ZoneCreateBody>({
    resolver: zodResolver(zoneCreateSchema(layout.zones.map((zone) => zone.name))),
    mode: "onChange",
    defaultValues: { name: "", color: "" },
  });
  const error = useEditorError(form);
  const submit = form.handleSubmit((body) => {
    error.clear();
    create.mutate(
      { warehouseId: layout.warehouse.id, body },
      { onSuccess: onClose, onError: error.onError },
    );
  });

  return (
    <FormDialogBody
      title={E.zoneTitle}
      description={layout.warehouse.name}
      submitLabel={E.submit}
      canSubmit={form.formState.isValid}
      isPending={create.isPending}
      error={error.serverError}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <FormText form={form} name="name" id="zone-name" label={E.zoneName} required autoFocus />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <FormText form={form} name="color" id="zone-color" label={E.zoneColor} kind="code" />
        {/* Bảng chọn màu của trình duyệt — giá trị là DỮ LIỆU zone, ghi vào ô chữ bên cạnh */}
        <input
          type="color"
          aria-label={E.zoneColor}
          onChange={(event) =>
            form.setValue("color", event.target.value.toUpperCase(), { shouldValidate: true })
          }
          className="border-border-default mb-px h-9 w-12 cursor-pointer rounded-(--r-sm) border"
        />
      </div>
    </FormDialogBody>
  );
}
