"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { UI_LABELS } from "@/constants";

import { zoneCreateSchema } from "@/features/warehouse-map/input-schemas";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { FormText } from "../shared/FormText";

import type { ZoneCreateBody, ZoneCreateInput } from "@/features/warehouse-map/types";

const E = UI_LABELS.warehouseMap.editor;

interface ZoneDialogProps {
  warehouseName: string;
  /** Tên zone đã có trong bản nháp (gồm zone chưa lưu) — tên duy nhất trong kho. */
  existingNames: readonly string[];
  onAdd: (zone: ZoneCreateBody) => void;
  onClose: () => void;
}

/**
 * Thêm zone vào bản nháp (docs 06 §4.1 bước 2): tên duy nhất trong kho, màu `#RRGGBB` tuỳ chọn. Chưa gọi
 * BE — zone được tạo khi bấm Lưu bản đồ, trước các kệ dùng nó.
 */
export function ZoneDialog(props: ZoneDialogProps) {
  return (
    <FormDialog open onOpenChange={(next) => !next && props.onClose()}>
      <ZoneForm {...props} />
    </FormDialog>
  );
}

function ZoneForm({ warehouseName, existingNames, onAdd, onClose }: ZoneDialogProps) {
  const form = useForm<ZoneCreateInput, unknown, ZoneCreateBody>({
    resolver: zodResolver(zoneCreateSchema(existingNames)),
    mode: "onChange",
    defaultValues: { name: "", color: "" },
  });
  const submit = form.handleSubmit((body) => {
    onAdd(body);
    onClose();
  });

  return (
    <FormDialogBody
      title={E.zoneTitle}
      description={warehouseName}
      submitLabel={E.submit}
      canSubmit={form.formState.isValid}
      isPending={false}
      error={null}
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
