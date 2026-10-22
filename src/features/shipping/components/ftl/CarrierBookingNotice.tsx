import { UI_LABELS } from "@/constants";
import { isAutoCancelled, needsCarrierBookingCancel } from "@/features/shipping/ftl-selectors";
import { Alert } from "@/components/shared/Alert";

import type { Load } from "@/features/shipping/types";

const N = UI_LABELS.shipping.ftl.bookingToCancel;
const F = UI_LABELS.shipping.field;

/**
 * Chuyến nguyên xe đã huỷ sau khi đã đặt xe (kế hoạch mở lại / huỷ, hoặc hệ thống tự huỷ vì xe không còn gì
 * để chở): đặt xe ở ngoài hệ thống vẫn còn → nhắc điều phối huỷ với nhà xe (BE `carrierBookingToCancel`).
 */
export function CarrierBookingNotice({ load }: { load: Load }) {
  if (!needsCarrierBookingCancel(load)) return null;
  const carrier = load.carrierName ? `${load.carrierCode ?? ""} ${load.carrierName}`.trim() : null;
  const details = [
    carrier && `${F.carrier}: ${carrier}`,
    load.vehiclePlate && `${F.vehiclePlate}: ${load.vehiclePlate}`,
    load.driverName && `${F.driverName}: ${load.driverName}`,
    load.driverPhone && `${F.driverPhone}: ${load.driverPhone}`,
  ].filter(Boolean);
  return (
    <Alert tone="warning" title={N.title}>
      <p>{N.body}</p>
      {details.length > 0 && <p className="mt-1">{details.join(" · ")}</p>}
      {load.cancelReason && (
        <p className="mt-1">
          {isAutoCancelled(load) ? N.autoCancelled : N.reason} {load.cancelReason}
        </p>
      )}
    </Alert>
  );
}
