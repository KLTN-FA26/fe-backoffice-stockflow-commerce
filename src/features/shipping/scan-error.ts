/** Lỗi quét lên xe: ghép dữ kiện BE trả về với chuyến hiện tại và một bước xử lý cụ thể (U69). */

import { z } from "zod";

import { PACKAGE_STATUS_DISPLAY, PACK_SHIPMENT_STATUS_DISPLAY, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { statusLabelVi } from "@/lib/status-map";

import { shippingErrorMessage } from "./errors";

import type { Load } from "./types";

const S = UI_LABELS.shipping.scan;
const detailSchema = z.object({
  planCode: z.string().nullish(),
  vehicleSeq: z.union([z.string(), z.number()]).nullish(),
  loadCode: z.string().nullish(),
  packageStatus: z.string().nullish(),
  shipmentStatus: z.string().nullish(),
  shipmentCode: z.string().nullish(),
});

function statusLabel(status: string, labels: Record<string, string>): string {
  return statusLabelVi(labels[status] ?? status) ?? labels[status] ?? status;
}

export function scanErrorMessage(
  error: unknown,
  load: Pick<Load, "code" | "loadPlanCode" | "vehicleSeq">,
): string {
  const context = S.context(load.code, load.loadPlanCode, load.vehicleSeq);
  if (!(error instanceof ApiError)) return `${context}: ${shippingErrorMessage(error)}`;
  const details = detailSchema.safeParse(error.details).data;
  const targetPlan = details?.planCode ?? error.fieldErrors?.planCode;
  const targetVehicle = details?.vehicleSeq?.toString() ?? error.fieldErrors?.vehicleSeq;
  const targetLoad = details?.loadCode ?? error.fieldErrors?.loadCode;
  const target = S.target(targetPlan, targetVehicle, targetLoad);
  let message: string;
  switch (error.code) {
    case "PACKAGE_NOT_IN_LOAD":
      message = target ? S.wrongTrip(target) : S.wrongTripUnknown;
      break;
    case "PACKAGE_ALREADY_LOADED":
      message = targetLoad ? S.alreadyLoaded(targetLoad) : shippingErrorMessage(error);
      break;
    case "PACKAGE_UNLOAD_PENDING":
      message = targetLoad ? S.unloadFirst(targetLoad) : shippingErrorMessage(error);
      break;
    case "PACKAGE_NOT_READY": {
      const status = details?.packageStatus;
      const shipment = details?.shipmentStatus;
      message = [
        status
          ? S.status(statusLabel(status, PACKAGE_STATUS_DISPLAY))
          : shippingErrorMessage(error),
        shipment && details?.shipmentCode
          ? S.shipmentStatus(
              details.shipmentCode,
              statusLabel(shipment, PACK_SHIPMENT_STATUS_DISPLAY),
            )
          : null,
        status === "TO_CHECK" || status === "CHECKED"
          ? S.finishCartonCheck
          : status === "OPEN"
            ? S.finishPacking
            : S.checkShipment,
      ]
        .filter(Boolean)
        .join(" ");
      break;
    }
    case "PACKAGE_NOT_FOUND":
      message = `${shippingErrorMessage(error)} ${S.checkLabel}`;
      break;
    default:
      message = shippingErrorMessage(error);
  }
  return `${context}: ${message}`;
}
