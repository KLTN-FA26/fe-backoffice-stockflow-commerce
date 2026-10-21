import type { z } from "zod";

import type {
  cancelLoadInputSchema,
  deliveryOutcomeInputSchema,
  handoverInputSchema,
  openLoadInputSchema,
  scanPackageInputSchema,
} from "./input-schemas";
import type {
  beLoadParcelSchema,
  beLoadRowSchema,
  beLoadSchema,
  beLoadShipmentSchema,
  beManifestSchema,
  beManifestShipmentSchema,
} from "./load-schemas";
import type {
  beCarrierSchema,
  beShipmentParcelSchema,
  beShipmentRowSchema,
  beShipmentSchema,
  beShipmentStepSchema,
} from "./schemas";

export type Carrier = z.infer<typeof beCarrierSchema>;
export type ShipmentRow = z.infer<typeof beShipmentRowSchema>;
export type Shipment = z.infer<typeof beShipmentSchema>;
export type ShipmentParcel = z.infer<typeof beShipmentParcelSchema>;
export type ShipmentStep = z.infer<typeof beShipmentStepSchema>;

export type Load = z.infer<typeof beLoadSchema>;
export type LoadRow = z.infer<typeof beLoadRowSchema>;
export type LoadShipment = z.infer<typeof beLoadShipmentSchema>;
export type LoadParcel = z.infer<typeof beLoadParcelSchema>;
export type Manifest = z.infer<typeof beManifestSchema>;
export type ManifestShipment = z.infer<typeof beManifestShipmentSchema>;

/** Trạng thái chuyến BE gửi — gồm "UNKNOWN" khi BE thêm giá trị mới. */
export type LoadApiStatus = Load["status"];
export type ShipmentApiStatusValue = ShipmentRow["status"];

export type OpenLoadFormInput = z.input<typeof openLoadInputSchema>;
export type OpenLoadValues = z.output<typeof openLoadInputSchema>;
export type HandoverFormInput = z.input<ReturnType<typeof handoverInputSchema>>;
export type HandoverValues = z.output<ReturnType<typeof handoverInputSchema>>;
export type CancelLoadValues = z.output<typeof cancelLoadInputSchema>;
export type ScanPackageValues = z.output<typeof scanPackageInputSchema>;
export type DeliveryOutcomeFormInput = z.input<typeof deliveryOutcomeInputSchema>;
export type DeliveryOutcomeValues = z.output<typeof deliveryOutcomeInputSchema>;

export interface OpenLoadInput extends OpenLoadValues {
  /** Một id cho một ý định mở chuyến — gửi lại (mất phản hồi) dùng lại id, BE trả chuyến đã mở. */
  requestId: string;
  shipmentIds?: readonly string[];
}

export interface ScanPackageInput {
  loadId: string;
  packageCode: string;
  /** Một id cho một lần quét: gửi lại cùng mã (retry) dùng lại id, BE không ghi lần quét thứ hai. */
  scanId: string;
}

export interface UnscanInput {
  loadId: string;
  packageId: string;
}

export interface LoadShipmentsInput {
  loadId: string;
  shipmentIds: readonly string[];
}

export interface RemoveLoadShipmentInput {
  loadId: string;
  shipmentId: string;
}

export interface HandoverLoadInput {
  loadId: string;
  /** `version` của chuyến trên màn hai bên ký — 409 OPTIMISTIC_LOCK nếu đã đổi. */
  version: number;
  values: HandoverValues;
}

export interface CancelLoadInput {
  loadId: string;
  reason: string;
}

export interface AssignCarrierInput {
  shipmentId: string;
  /** `null` = bỏ hãng đã chọn. */
  carrierId: string | null;
}

export interface RecordOutcomeInput {
  shipmentId: string;
  values: DeliveryOutcomeValues;
}
