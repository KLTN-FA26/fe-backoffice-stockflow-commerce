"use client";

import { CARTON_CHECK_LIMITS, UI_LABELS } from "@/constants";
import { ScanInput } from "@/components/backoffice/ScanInput";

import { Section } from "../primitives";
import { useCartonScan } from "./useCartonScan";

import type { CartonCheckSession } from "@/features/fulfillment/carton-check-types";

const S = UI_LABELS.cartonCheck.scan;

/**
 * Quét LPN từng thùng (docs 08 §4.2 bước 3). Ô quét luôn focus, Enter gửi. Chỉ hiện khi người dùng thao tác được
 * (`canWork`: có quyền kiểm thùng + là người bắt đầu phiên hoặc quản lý kho — BR-06).
 */
export function CartonScanSection({ session }: { session: CartonCheckSession }) {
  const flow = useCartonScan(session);
  return (
    <Section title={S.title}>
      <ScanInput
        id="carton-scan"
        label={S.label}
        placeholder={S.placeholder}
        hint={S.hint}
        maxLength={CARTON_CHECK_LIMITS.lpnMax}
        onScan={flow.onScan}
        pending={flow.queued > 0}
        feedback={flow.feedback}
      />
    </Section>
  );
}
