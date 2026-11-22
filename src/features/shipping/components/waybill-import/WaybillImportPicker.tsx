"use client";

import Link from "next/link";
import { Download, FileUp } from "lucide-react";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { FilePickerField } from "@/components/shared/FilePickerField";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { WAYBILL_IMPORT_ACCEPT } from "@/features/shipping/waybill-import-file";

import { ImportWarehouseSelect } from "./ImportWarehouseSelect";

import type { RefObject } from "react";

const I = UI_LABELS.shipping.waybill.import;

/**
 * Khối chọn file của màn nhập mã vận đơn: mô tả, tải file mẫu (`fulfillment-waybill-imports:READ`), chọn file CSV / Excel (.xlsx) và "Xem
 * trước" — hai thao tác sau cần `:CREATE` (`canCreate`), thiếu quyền thì chỉ có file mẫu và một dòng giải thích.
 */
export function WaybillImportPicker({
  canCreate,
  warehouseId,
  onWarehouse,
  input,
  fileName,
  canPreview,
  previewing,
  onChoose,
  onTemplate,
  onPreview,
}: {
  canCreate: boolean;
  /** Kho chọn trước khi chọn file (bắt buộc); chỉ chuyến của kho này được nhận. */
  warehouseId: string;
  onWarehouse: (warehouseId: string) => void;
  input: RefObject<HTMLInputElement | null>;
  /** Tên file đang chọn (rỗng = chưa chọn). */
  fileName: string | null;
  canPreview: boolean;
  previewing: boolean;
  onChoose: (file: File | null) => void;
  onTemplate: () => void;
  onPreview: () => void;
}) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{I.title}</h2>
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.loads.list}>{I.back}</Link>
        </Button>
      </div>
      <p className="text-ink-secondary mb-3 text-[0.8125rem]">{I.description}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onTemplate}>
          <Download className="size-3.5" /> {I.template}
        </Button>
        {canCreate && (
          <>
            <div className="w-56">
              <Label
                htmlFor="waybill-import-warehouse"
                className="text-ink-secondary mb-1 block text-xs font-medium"
              >
                {I.warehouseLabel}
              </Label>
              <ImportWarehouseSelect
                id="waybill-import-warehouse"
                value={warehouseId}
                onChange={onWarehouse}
              />
            </div>
            <div>
              <Label
                htmlFor="waybill-import-file"
                className="text-ink-secondary mb-1 block text-xs font-medium"
              >
                {I.fileLabel}
              </Label>
              <FilePickerField
                inputRef={input}
                id="waybill-import-file"
                disabled={!warehouseId}
                accept={WAYBILL_IMPORT_ACCEPT}
                fileName={fileName}
                onChange={onChoose}
              />
            </div>
            <Button type="button" size="sm" disabled={!canPreview} onClick={onPreview}>
              <FileUp className="size-3.5" /> {previewing ? I.previewing : I.preview}
            </Button>
          </>
        )}
      </div>
      <p className="text-ink-tertiary mt-2 text-xs">{I.fileHint}</p>
      {canCreate && !warehouseId && (
        <p className="text-ink-secondary mt-1 text-xs">{I.warehouseRequired}</p>
      )}
      {!canCreate && <p className="text-ink-secondary mt-2 text-xs">{I.noPermission}</p>}
    </section>
  );
}
