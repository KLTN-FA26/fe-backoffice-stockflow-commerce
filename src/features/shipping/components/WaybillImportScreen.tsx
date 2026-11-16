"use client";

import {
  FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { useWaybillImport } from "./waybill-import/useWaybillImport";
import { WaybillImportPicker } from "./waybill-import/WaybillImportPicker";
import { WaybillImportTable } from "./waybill-import/WaybillImportTable";
import { ShippingPermissionGate } from "./ShippingPermissionGate";

const I = UI_LABELS.shipping.waybill.import;
const CARD =
  "border-border-default bg-bg-surface space-y-3 rounded-[var(--card-radius)] border p-[var(--card-pad)]";

function ImportBody() {
  const canCreate = useCan(FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS.create);
  const {
    input,
    file,
    previewed,
    result,
    overwrite,
    error,
    previewing,
    importing,
    toApply,
    choose,
    reset,
    downloadTemplate,
    runPreview,
    runImport,
    toggleOverwrite,
  } = useWaybillImport();
  const hasOverwriteLines = previewed?.lines.some((line) => line.outcome === "OVERWRITE") ?? false;

  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{I.title}</h1>
      <div className="space-y-5">
        <WaybillImportPicker
          canCreate={canCreate}
          input={input}
          canPreview={!!file && !previewing && !importing}
          previewing={previewing}
          onChoose={choose}
          onTemplate={() => void downloadTemplate()}
          onPreview={runPreview}
        />
        {error && (
          <Alert tone="danger">
            <span role="alert">{error}</span>
          </Alert>
        )}
        {previewed && !result && (
          <section className={CARD}>
            <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{I.previewTitle}</h2>
            <p className="text-ink-secondary text-[0.8125rem]">
              {I.summary(previewed.rowsTotal, previewed.rowsApplied, previewed.rowsRejected)}
            </p>
            {hasOverwriteLines && <Alert tone="warning">{I.overwriteHint}</Alert>}
            <WaybillImportTable
              lines={previewed.lines}
              overwrite={overwrite}
              onToggleOverwrite={toggleOverwrite}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                disabled={toApply === 0 || importing}
                onClick={runImport}
              >
                {importing ? I.applying : I.apply}
              </Button>
              {toApply === 0 && <span className="text-ink-tertiary text-xs">{I.noApplicable}</span>}
            </div>
          </section>
        )}
        {result && (
          <section className={CARD}>
            <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{I.resultTitle}</h2>
            <p className="text-ink-secondary text-[0.8125rem]">
              {I.resultSummary(result.rowsApplied, result.rowsRejected)}
            </p>
            <p className="text-ink-tertiary text-xs">{I.resultHint}</p>
            <WaybillImportTable lines={result.lines} />
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              {I.another}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * Nhập mã vận đơn hàng loạt từ file (docs 09 §4.4 "Nhập hàng loạt từ file", BR-25): tải file mẫu → chọn file → xem trước từng
 * dòng (mới / không đổi / sẽ ghi đè / lỗi kèm lý do) → nhập các dòng hợp lệ; dòng ghi đè chỉ áp khi được tick xác nhận. Quyền
 * BE: `fulfillment-waybill-imports:READ` (file mẫu) và `:CREATE` (xem trước + nhập). Backend phải re-check.
 */
export function WaybillImportScreen() {
  return (
    <ShippingPermissionGate
      permissions={[SHIPMENT_PERMISSIONS.viewPage, FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS.read]}
    >
      <ImportBody />
    </ShippingPermissionGate>
  );
}
