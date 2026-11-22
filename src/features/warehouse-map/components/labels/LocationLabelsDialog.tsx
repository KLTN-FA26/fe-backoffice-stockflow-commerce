"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Printer } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { warehouseMapErrorMessage } from "@/features/warehouse-map/errors";
import {
  EMPTY_LOCATION_LABEL_FORM,
  locationLabelSchema,
} from "@/features/warehouse-map/location-label-schema";
import { usePrintLocationLabels } from "@/features/warehouse-map/mutations";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";

import { LabelScopeFields } from "./LabelScopeFields";

import type {
  LocationLabelBody,
  LocationLabelInput,
  WarehouseLayout,
} from "@/features/warehouse-map/types";

const P = UI_LABELS.warehouseMap.print;

/**
 * In nhãn vị trí (docs 06 §4.3, BR-17 — FE SCRUM-667): chọn cả kho / một kệ (tuỳ tầng) / một zone / danh sách mã + khổ
 * nhãn → BE trả PDF theo thứ tự đi → xem trước ngay trong dialog, In (hộp thoại in của trình duyệt) hoặc Tải xuống.
 * Mở từ thanh công cụ bản đồ (cấp kho) hoặc chi tiết kệ (`shelfId` — chọn sẵn phạm vi "Một kệ"); ai xem được bản đồ
 * (`warehouse-locations:READ`) đều in được — Backend phải re-check.
 */
export function LocationLabelsDialog({
  layout,
  shelfId,
  onClose,
}: {
  layout: WarehouseLayout;
  shelfId?: string;
  onClose: () => void;
}) {
  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()} className="sm:max-w-[640px]">
      <LocationLabelsForm layout={layout} shelfId={shelfId} onClose={onClose} />
    </FormDialog>
  );
}

function LocationLabelsForm({
  layout,
  shelfId,
  onClose,
}: {
  layout: WarehouseLayout;
  shelfId?: string;
  onClose: () => void;
}) {
  const print = usePrintLocationLabels();
  const [serverError, setServerError] = useState<string | null>(null);
  const [file, setFile] = useState<{ url: string; fileName: string; request: string } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  // Bố cục đổi (refetch nền) → kiểm lại mã / số nhãn trên bố cục mới
  const schema = useMemo(() => locationLabelSchema(layout), [layout]);
  const form = useForm<LocationLabelInput, unknown, LocationLabelBody>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: shelfId
      ? { ...EMPTY_LOCATION_LABEL_FORM, scope: "SHELF", shelfId }
      : EMPTY_LOCATION_LABEL_FORM,
  });

  // Một blob URL cho mỗi file; thu hồi khi tạo lại hoặc đóng
  useEffect(() => (file ? () => URL.revokeObjectURL(file.url) : undefined), [file]);
  // File gắn với lựa chọn đã gửi: đổi lựa chọn → file cũ không còn đúng, ẩn xem trước tới khi tạo lại
  const request = JSON.stringify(useWatch({ control: form.control }));
  const pdf = file?.request === request ? file : null;

  const submit = form.handleSubmit((body) => {
    setServerError(null);
    print.mutate(
      { warehouseId: layout.warehouse.id, body },
      {
        onSuccess: ({ blob, fileName }) =>
          setFile({ url: URL.createObjectURL(blob), fileName, request }),
        onError: (failure) => setServerError(warehouseMapErrorMessage(failure)),
      },
    );
  });

  return (
    <FormDialogBody
      title={P.title}
      description={P.description}
      submitLabel={pdf ? P.regenerate : P.generate}
      canSubmit={form.formState.isValid}
      isPending={print.isPending}
      error={serverError}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div className="max-h-[calc(100vh-15rem)] space-y-3 overflow-y-auto pr-1">
        <LabelScopeFields form={form} layout={layout} disabled={print.isPending} />
        {pdf && (
          // Nút In / Tải xuống đứng trên khung xem trước: màn thấp thì khung bị cuộn, nút vẫn thấy ngay
          <div className="space-y-2">
            <div className="flex justify-end gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={pdf.url} download={pdf.fileName}>
                  <Download className="size-3.5" /> {P.download}
                </a>
              </Button>
              <Button type="button" size="sm" onClick={() => frame.current?.contentWindow?.print()}>
                <Printer className="size-3.5" /> {P.printNow}
              </Button>
            </div>
            <iframe
              ref={frame}
              title={P.preview}
              src={pdf.url}
              className="border-border-default h-[360px] w-full rounded-[var(--r-sm)] border"
            />
          </div>
        )}
      </div>
    </FormDialogBody>
  );
}
