import { UI_LABELS } from "@/constants";

import { InfoItem } from "../primitives";

import type { Manifest } from "@/features/shipping/types";

const F = UI_LABELS.shipping.ftl;

/**
 * Biên bản của riêng một xe trong kế hoạch (docs 09 BR-15): mã kế hoạch, số xe, loại xe và mã vận đơn của chuyến
 * (BR-23 — mã bắt buộc có trước khi ký; chưa có thì ô để trống cho hai bên điền đối chiếu).
 */
export function ManifestVehicleInfo({ manifest }: { manifest: Manifest }) {
  return (
    <>
      <InfoItem
        label={F.manifest.vehicle}
        value={F.manifest.vehicleValue(manifest.loadPlanCode, manifest.vehicleSeq)}
        mono
      />
      <InfoItem label={F.manifest.vehicleType} value={manifest.vehicleTypeCode ?? "—"} mono />
      <InfoItem label={F.manifest.waybill} value={manifest.waybillNo ?? "—"} mono />
    </>
  );
}

/** Dòng ghi chú dưới tiêu đề biên bản: biên bản theo xe. */
export function ManifestVehicleNote() {
  return <p className="text-ink-secondary text-center text-xs">{F.manifest.perVehicleNote}</p>;
}
