import { useRef, useState } from "react";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { downloadWaybillTemplate } from "@/features/shipping/waybill-api";
import {
  useImportWaybillFile,
  usePreviewWaybillImport,
} from "@/features/shipping/waybill-mutations";

import type { WaybillImport } from "@/features/shipping/types";

const I = UI_LABELS.shipping.waybill.import;

/** Dòng áp dụng được ở xem trước: mới, hoặc ghi đè đã được tick (BE chỉ áp dòng ghi đè nằm trong `overwriteLines`). */
export function applicableCount(preview: WaybillImport, overwrite: ReadonlySet<number>): number {
  return preview.lines.filter(
    (line) => line.outcome === "NEW" || (line.outcome === "OVERWRITE" && overwrite.has(line.line)),
  ).length;
}

/**
 * State của màn nhập mã vận đơn từ file (docs 09 §4.4): file đã chọn → xem trước → tick ghi đè → nhập → kết quả. Đổi file thì
 * bỏ bản xem trước cũ; file > 1 MB bị từ chối ngay ở máy (BE cũng từ chối). Lỗi hiện inline (không toast).
 */
export function useWaybillImport() {
  const preview = usePreviewWaybillImport();
  const importFile = useImportWaybillFile();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewed, setPreviewed] = useState<WaybillImport | null>(null);
  const [result, setResult] = useState<WaybillImport | null>(null);
  const [overwrite, setOverwrite] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    setPreviewed(null);
    setResult(null);
    setOverwrite(new Set());
  };

  return {
    input,
    file,
    previewed,
    result,
    overwrite,
    error,
    previewing: preview.isPending,
    importing: importFile.isPending,
    toApply: previewed ? applicableCount(previewed, overwrite) : 0,
    choose: (next: File | null) => {
      clear();
      if (next && next.size > SHIPPING_LIMITS.waybillImportMaxBytes) {
        setFile(null);
        setError(I.fileTooLarge);
        return;
      }
      setFile(next);
      setError(null);
    },
    reset: () => {
      clear();
      setFile(null);
      setError(null);
      if (input.current) input.current.value = "";
    },
    downloadTemplate: async () => {
      setError(null);
      try {
        const blob = await downloadWaybillTemplate();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = I.templateFileName;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch {
        setError(I.templateFailed);
      }
    },
    runPreview: () => {
      if (!file) return;
      setError(null);
      preview.mutate(file, {
        onSuccess: (data) => {
          setPreviewed(data);
          setOverwrite(new Set());
        },
        onError: (e) => setError(shippingErrorMessage(e)),
      });
    },
    runImport: () => {
      if (!file || !previewed) return;
      setError(null);
      importFile.mutate(
        { file, overwriteLines: [...overwrite].sort((a, b) => a - b) },
        { onSuccess: setResult, onError: (e) => setError(shippingErrorMessage(e)) },
      );
    },
    toggleOverwrite: (line: number) =>
      setOverwrite((current) => {
        const next = new Set(current);
        if (next.has(line)) next.delete(line);
        else next.add(line);
        return next;
      }),
  };
}
