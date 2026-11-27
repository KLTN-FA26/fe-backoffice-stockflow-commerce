"use client";

import { useWatch } from "react-hook-form";

import { PICK_LINE_LABELS, PICK_LINE_LIMITS } from "@/constants";
import { ScanInput } from "@/components/backoffice/ScanInput";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { PickLineTarget } from "./PickLineTarget";
import { useLocationScan } from "./useLocationScan";
import { usePickLineConfirm } from "./usePickLineConfirm";

import type { ScanFeedback } from "@/components/backoffice/ScanInput";
import type { PickLine } from "@/features/fulfillment/types";
import type { ReactNode } from "react";

const L = PICK_LINE_LABELS;

const FIELD_IDS = { locationCode: "pick-location", lpn: "pick-lpn" } as const;

/**
 * Xác nhận một dòng lấy hàng: quét vị trí → quét LPN của thùng (docs 07 §4.2 bước 5). Đầu thẻ nói rõ phải đến vị trí nào
 * và lấy thùng nào (LPN); không có số lượng vì mỗi dòng là một thùng (BR-04). Cả hai là ô quét lớn (`ScanInput`, 48px):
 * máy quét gửi Enter sau mã, gõ tay thì Enter hoặc nút "Xác nhận" — không danh sách chọn, không quét bằng camera. Vị trí
 * quét sai thì báo ngay tại ô (so với vị trí của dòng, như BE `PICK_LOCATION_MISMATCH`), không cho sang bước LPN; LPN
 * SKU, mã vạch hay LPN của thùng khác (kể cả đơn khác) đều bị BE từ chối (BR-10) và lỗi nêu đúng LPN của dòng. Thẻ được
 * dựng lại theo từng dòng (`key`), nên form + key idempotency thuộc riêng dòng đó.
 */
export function PickLineConfirmCard({
  taskId,
  line,
  onConfirmed,
  extraActions,
}: {
  taskId: string;
  line: PickLine;
  onConfirmed: (line: PickLine) => void;
  /** Thao tác phụ dưới ô quét (vd báo thiếu thùng). */
  extraActions?: ReactNode;
}) {
  const { form, submit, pending, banner, errorSeq } = usePickLineConfirm({
    taskId,
    line,
    onConfirmed,
  });
  const { errors } = form.formState;
  const confirmedLocation = useWatch({ control: form.control, name: "locationCode" });
  const location = useLocationScan({
    expected: line.locationCode,
    current: confirmedLocation,
    accept: (code) => {
      form.clearErrors();
      form.setValue("locationCode", code);
    },
    serverMessage: errors.locationCode?.message,
    serverSeq: errorSeq,
  });
  const onScanLpn = (code: string) => {
    form.setValue("lpn", code.trim());
    form.clearErrors("lpn");
    void submit();
  };

  const lpnFeedback: ScanFeedback | null = errors.lpn?.message
    ? { tone: "danger", message: errors.lpn.message, seq: errorSeq }
    : null;

  return (
    <section className="border-border-default bg-bg-surface space-y-4 rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
      <PickLineTarget line={line} />
      {!line.lpn && (
        <Alert tone="warning" title={L.noLpn}>
          {null}
        </Alert>
      )}
      {banner && (
        <Alert tone="danger" title={banner}>
          {null}
        </Alert>
      )}
      <ScanInput
        id={FIELD_IDS.locationCode}
        label={L.scanLocation}
        placeholder={L.scanLocationPlaceholder}
        hint={L.scanLocationHint(line.locationCode)}
        maxLength={PICK_LINE_LIMITS.codeMax}
        disabled={!!confirmedLocation}
        feedback={location.feedback}
        submitLabel={confirmedLocation ? undefined : L.scanLocationConfirm}
        onScan={location.onScan}
      />
      {confirmedLocation && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            form.setValue("locationCode", "");
            form.setValue("lpn", "");
            form.clearErrors();
          }}
          className="border-border-default h-11 rounded-[var(--r-sm)] px-4 text-sm"
        >
          {L.rescanLocation}
        </Button>
      )}
      <ScanInput
        id={FIELD_IDS.lpn}
        label={L.scanLpn}
        placeholder={L.scanLpnPlaceholder}
        hint={confirmedLocation ? L.lpnHint : L.scanLpnWaiting}
        maxLength={PICK_LINE_LIMITS.lpnMax}
        disabled={!confirmedLocation}
        pending={pending}
        feedback={lpnFeedback}
        submitLabel={confirmedLocation ? L.scanLpnConfirm : undefined}
        onScan={onScanLpn}
      />
      {extraActions}
    </section>
  );
}
