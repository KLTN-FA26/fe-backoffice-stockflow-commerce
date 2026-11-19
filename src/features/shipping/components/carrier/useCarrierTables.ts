import { useMemo } from "react";

import {
  failureReasonRowsFromMap,
  failureReasonSignature,
  validateFailureReasonRows,
} from "@/features/shipping/carrier-failure-rows";
import {
  pickupPointRowsFrom,
  pickupPointSignature,
  validatePickupPointRows,
} from "@/features/shipping/carrier-pickup-rows";
import { hasRowErrors } from "@/features/shipping/carrier-row-core";
import {
  serviceCodeRowsFrom,
  serviceCodeSignature,
  validateServiceCodeRows,
} from "@/features/shipping/carrier-service-code-rows";
import { usePickupPoints, useServiceCodes } from "@/features/shipping/carrier-config-queries";

import { useRowsEditor, useStaticRowsEditor } from "./useRowsEditor";

import type { Carrier } from "@/features/shipping/types";

/**
 * Ba bảng cấu hình của hộp thoại hãng: lý do giao thất bại (kiểu có webhook), mã dịch vụ và điểm lấy hàng (kiểu API đặt xe).
 * `carrierId` là hãng đã lưu ở BE (vắng = hãng mới). Bảng chỉ tính vào việc lưu khi kiểu kết nối hiện tại dùng nó.
 */
export function useCarrierTables(options: {
  initialCarrier: Carrier | null;
  carrierId: string | undefined;
  /** Kiểu kết nối đang chọn có gửi webhook (WEBHOOK_LOAD / API_BOOKING) → có bảng lý do giao thất bại. */
  usesFailureReasons: boolean;
  /** Kiểu API đặt xe đang chọn → có bảng mã dịch vụ và điểm lấy hàng. */
  api: boolean;
}) {
  const { initialCarrier, carrierId, usesFailureReasons, api } = options;
  const failureReasons = useStaticRowsEditor(
    () => failureReasonRowsFromMap(initialCarrier?.connection?.failureReasonMap),
    failureReasonSignature,
  );
  const serviceCodes = useRowsEditor({
    carrierId,
    enabled: api,
    query: useServiceCodes(carrierId, api),
    toRows: serviceCodeRowsFrom,
    signature: serviceCodeSignature,
  });
  const pickupPoints = useRowsEditor({
    carrierId,
    enabled: api,
    query: usePickupPoints(carrierId, api),
    toRows: pickupPointRowsFrom,
    signature: pickupPointSignature,
  });
  const failureErrors = useMemo(
    () => validateFailureReasonRows(failureReasons.rows),
    [failureReasons.rows],
  );
  const serviceErrors = useMemo(
    () => validateServiceCodeRows(serviceCodes.rows),
    [serviceCodes.rows],
  );
  const pickupErrors = useMemo(
    () => validatePickupPointRows(pickupPoints.rows),
    [pickupPoints.rows],
  );
  const invalid =
    (usesFailureReasons && hasRowErrors(failureErrors)) ||
    (api && (hasRowErrors(serviceErrors) || hasRowErrors(pickupErrors)));
  return {
    failureReasons,
    serviceCodes,
    pickupPoints,
    failureErrors,
    serviceErrors,
    pickupErrors,
    invalid,
  };
}

export type CarrierTables = ReturnType<typeof useCarrierTables>;
