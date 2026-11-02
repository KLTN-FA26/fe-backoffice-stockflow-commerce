import { cn } from "cn";
import { Boxes, Printer } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { isLabelOutdated, kitOf } from "@/features/shipping/ftl-selectors";

import type { KitPart, LoadParcel } from "@/features/shipping/types";

const P = UI_LABELS.shipping.ftl.parcel;
const BADGE =
  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[0.6875rem] font-medium";

/** "Bộ x/N": kiện là một phần của bộ nhiều kiện — mọi kiện của bộ phải lên cùng xe. */
export function KitBadge({ kit }: { kit: KitPart }) {
  return (
    <span className={cn(BADGE, "border-info/40 text-info")} title={P.kitTitle}>
      <Boxes className="size-3" aria-hidden /> {P.kit(kit.partNo, kit.partCount)}
    </span>
  );
}

/** "Cần in lại nhãn": nhãn kiện ghi lô / số kiện cũ (kiện đã chuyển lô) — in lại ở trạm đóng gói trước khi quét. */
export function LabelOutdatedBadge() {
  return (
    <span className={cn(BADGE, "border-warning/50 text-warning")} title={P.labelOutdatedTitle}>
      <Printer className="size-3" aria-hidden /> {P.labelOutdated}
    </span>
  );
}

/** Các nhãn phụ của một kiện (bộ, nhãn cũ); không có gì thì không vẽ gì. */
export function ParcelBadges({ parcel }: { parcel: Pick<LoadParcel, "kit" | "labelOutdated"> }) {
  const kit = kitOf(parcel);
  if (!kit && !isLabelOutdated(parcel)) return null;
  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle">
      {kit && <KitBadge kit={kit} />}
      {isLabelOutdated(parcel) && <LabelOutdatedBadge />}
    </span>
  );
}
