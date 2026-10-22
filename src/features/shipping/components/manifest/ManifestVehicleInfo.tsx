import { UI_LABELS } from "@/constants";

import { InfoItem } from "../primitives";

import type { Manifest } from "@/features/shipping/types";

const F = UI_LABELS.shipping.ftl;

/**
 * Chuyến nguyên xe: biên bản của riêng một xe trong kế hoạch (BR-15) — mã kế hoạch, số xe, loại xe và ghi
 * chú chỉ gồm kiện kế hoạch xếp lên xe này, COD luôn 0. Chuyến gửi kiện không có phần này.
 */
export function ManifestVehicleInfo({ manifest }: { manifest: Manifest }) {
  if (manifest.mode !== "FULL_TRUCKLOAD") return null;
  return (
    <>
      <InfoItem
        label={F.manifest.vehicle}
        value={F.manifest.vehicleValue(manifest.loadPlanCode, manifest.vehicleSeq)}
        mono
      />
      <InfoItem label={F.manifest.vehicleType} value={manifest.vehicleTypeCode ?? "—"} mono />
    </>
  );
}

/** Dòng ghi chú dưới tiêu đề biên bản của chuyến nguyên xe. */
export function ManifestVehicleNote({ manifest }: { manifest: Manifest }) {
  if (manifest.mode !== "FULL_TRUCKLOAD") return null;
  return <p className="text-ink-secondary text-center text-xs">{F.manifest.perVehicleNote}</p>;
}
