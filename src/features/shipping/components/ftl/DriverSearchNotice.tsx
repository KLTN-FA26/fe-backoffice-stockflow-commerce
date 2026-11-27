import { LOAD_STATUS, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { isApiBookedLoad } from "@/features/shipping/ftl-selectors";

import type { Load } from "@/features/shipping/types";

const B = UI_LABELS.shipping.ftl.booking;

/** Hãng đã nhận lại chuyến từ tài xế: nói rõ lần huỷ gần nhất và bước tiếp theo. */
export function DriverSearchNotice({ load }: { load: Load }) {
  const waiting =
    isApiBookedLoad(load) &&
    (load.status === LOAD_STATUS.VEHICLE_BOOKED || load.status === LOAD_STATUS.LOADING) &&
    !load.driverName;
  if (!waiting) return null;
  const at = load.driverReleasedAt;
  return (
    <p role="status" className="text-ink-secondary mt-3 text-[0.8125rem]">
      {at ? B.driverReleased(formatDateTime(at)) : B.findingDriver}
    </p>
  );
}
