import type { z } from "zod";

import type { UnloadReasonCode } from "@/constants";

import type {
  carrierBookingSchema,
  handoverWarningSchema,
  pendingUnloadSchema,
} from "./ftl-schemas";
import type { carrierInputSchema } from "./carrier-schemas";
import type {
  bookingInputSchema,
  cancelBookingInputSchema,
  deliveryOutcomeInputSchema,
  handoverInputSchema,
  scanPackageInputSchema,
  waybillInputSchema,
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
  beWaybillChangeSchema,
  beWaybillImportLineSchema,
  beWaybillImportRowSchema,
  beWaybillImportSchema,
} from "./waybill-schemas";
import type {
  beCarrierConnectionSchema,
  beCarrierSchema,
  beShipmentParcelSchema,
  beShipmentRowSchema,
  beShipmentSchema,
  beShipmentStepSchema,
} from "./schemas";

export type Carrier = z.infer<typeof beCarrierSchema>;
export type CarrierConnection = z.infer<typeof beCarrierConnectionSchema>;
export type ShipmentRow = z.infer<typeof beShipmentRowSchema>;
export type Shipment = z.infer<typeof beShipmentSchema>;
export type ShipmentParcel = z.infer<typeof beShipmentParcelSchema>;
export type ShipmentStep = z.infer<typeof beShipmentStepSchema>;

export type Load = z.infer<typeof beLoadSchema>;
export type LoadRow = z.infer<typeof beLoadRowSchema>;
export type LoadShipment = z.infer<typeof beLoadShipmentSchema>;
export type LoadParcel = z.infer<typeof beLoadParcelSchema>;
export type HandoverWarning = z.infer<typeof handoverWarningSchema>;
export type CarrierBooking = z.infer<typeof carrierBookingSchema>;
export type PendingUnload = z.infer<typeof pendingUnloadSchema>;
export type Manifest = z.infer<typeof beManifestSchema>;
export type ManifestShipment = z.infer<typeof beManifestShipmentSchema>;
export type WaybillChange = z.infer<typeof beWaybillChangeSchema>;
export type WaybillImport = z.infer<typeof beWaybillImportSchema>;
export type WaybillImportLine = z.infer<typeof beWaybillImportLineSchema>;
export type WaybillImportRow = z.infer<typeof beWaybillImportRowSchema>;

/** Trạng thái chuyến BE gửi — gồm "UNKNOWN" khi BE thêm giá trị mới. */
export type LoadApiStatus = Load["status"];
export type ShipmentApiStatusValue = ShipmentRow["status"];

export type HandoverFormInput = z.input<ReturnType<typeof handoverInputSchema>>;
export type HandoverValues = z.output<ReturnType<typeof handoverInputSchema>>;
export type WaybillFormInput = z.input<ReturnType<typeof waybillInputSchema>>;
export type WaybillValues = z.output<ReturnType<typeof waybillInputSchema>>;
export type CarrierFormInput = z.input<ReturnType<typeof carrierInputSchema>>;
export type CarrierValues = z.output<ReturnType<typeof carrierInputSchema>>;
export type BookingFormInput = z.input<typeof bookingInputSchema>;
export type BookingValues = z.output<typeof bookingInputSchema>;
export type CancelBookingValues = z.output<typeof cancelBookingInputSchema>;
export type ScanPackageValues = z.output<typeof scanPackageInputSchema>;
export type DeliveryOutcomeFormInput = z.input<typeof deliveryOutcomeInputSchema>;
export type DeliveryOutcomeValues = z.output<typeof deliveryOutcomeInputSchema>;

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

export interface HandoverLoadInput {
  loadId: string;
  /** `version` của chuyến trên màn hai bên ký — 409 OPTIMISTIC_LOCK nếu đã đổi. */
  version: number;
  values: Omit<HandoverValues, "driverName">;
}

export interface RecordOutcomeInput {
  shipmentId: string;
  values: DeliveryOutcomeValues;
}

/**
 * Thân `POST loads/{id}/booking` (BE `BookingRequest`). Hãng thường: biển số / tài xế / mã vận đơn nếu đã có. Hãng tích
 * hợp API đặt xe (BR-29): CHỈ `pickupAt` + `stopShipmentIds` — gửi thêm biển số / tài xế / mã là 400 VALIDATION_FAILED.
 */
export interface BookingRequestBody {
  carrierId: string;
  vehiclePlate?: string;
  driverName?: string;
  driverPhone?: string;
  waybillNo?: string;
  /** Instant ISO (UTC). */
  pickupAt?: string;
  stopShipmentIds?: readonly string[];
}

/** Đặt xe / sửa thông tin đặt xe của một xe trong kế hoạch. */
export interface BookLoadInput {
  loadId: string;
  values: BookingRequestBody;
}

/** Nhập tay mã vận đơn của chuyến (BE `WaybillRequest`); sau khi rời kho là sửa mã, kèm `reason`. */
export interface RecordWaybillInput {
  loadId: string;
  values: WaybillValues;
}

/** Nhập file mã vận đơn: file CSV theo mẫu + số dòng ghi đè đã được xác nhận (BR-25). */
export interface WaybillImportFileInput {
  file: File;
  overwriteLines: readonly number[];
}

/** Thân tạo / sửa hãng (BE `CarrierRequest`). `connection` vắng = giữ nguyên cấu hình kết nối hiện có. */
export interface SaveCarrierInput {
  code: string;
  name: string;
  contactName?: string;
  contactPhone?: string;
  status: Carrier["status"];
  connection?: { connectionType: "MANUAL" | "WEBHOOK_LOAD"; webhookSecret?: string };
  /** Bắt buộc khi sửa: phiên bản đã đọc. */
  version?: number;
}

export interface CancelBookingInput {
  loadId: string;
  reason: string;
}

export interface StartLoadingInput {
  loadId: string;
}

/** Dỡ một kiện của đơn đã huỷ khỏi xe: mã in trên nhãn. */
export interface UnloadPackageInput {
  loadId: string;
  packageCode: string;
}

/** Huỷ có kiểm soát MỘT xe đang xếp hàng (SCRUM-474 UNLOAD-DESIGN): mã lý do + ghi chú. */
export interface ControlledCancelLoadInput {
  loadId: string;
  reasonCode: UnloadReasonCode;
  note: string;
}

/** Xác nhận dỡ một kiện không cần quét vì nhãn hỏng (quản lý kho): chọn theo `packageId`, ghi chú không bắt buộc. */
export interface OverrideUnloadInput {
  loadId: string;
  packageId: string;
  note?: string;
}

/** Kết quả huỷ có kiểm soát một xe: chuyến đã huỷ và chuyến thay thế (Chưa đặt xe, cùng sơ đồ). */
export interface ControlledCancelResult {
  cancelled: Load;
  replacement: Load | null;
}
