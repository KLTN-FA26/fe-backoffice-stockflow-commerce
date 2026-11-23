/**
 * Trả hàng — DTO của BE (order module: `ReturnRequestController`, `ReturnResolutionController`; procurement:
 * `ReturnReceiptController`). Jackson `non_null` bỏ trường chưa đặt → `.nullish()`; tiền là `BigDecimal` → number.
 * Schema nhập liệu: `input-schemas.ts`. Docs 17 §4.10, 03 §4.2, 15 §4.5.
 */

import { z } from "zod";

import {
  RETURN_API_STATUSES,
  RETURN_CHANNELS,
  RETURN_OUTCOMES,
  RETURN_REASONS,
  RETURN_RECEIPT_API_STATUSES,
  RETURN_REFUSAL_REASONS,
  RETURN_UNKNOWN,
} from "@/constants/returns";
import { bePageSchema } from "@/lib/api/page-schema";

/**
 * Enum của BE đọc khoan dung (WF-05 BO-11, audit C-32): BE gửi chuỗi, giá trị mới tiếp tục được thêm — một giá trị FE chưa
 * biết đọc thành `UNKNOWN` (hiển thị "Không rõ", không mở thao tác nào) thay vì làm hỏng cả màn.
 */
function tolerantEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum([...values, RETURN_UNKNOWN]).catch(RETURN_UNKNOWN);
}

const status = tolerantEnum(RETURN_API_STATUSES);
const reason = tolerantEnum(RETURN_REASONS);
const channel = tolerantEnum(RETURN_CHANNELS);

/* ── Yêu cầu trả hàng: bản của back-office (BE `ReturnRequestResponse`) ─────────────────── */

export const returnLineDtoSchema = z.object({
  id: z.string(),
  orderLineId: z.string(),
  sku: z.string(),
  customPrinted: z.boolean(),
  unitPrice: z.number(),
  requestedQuantity: z.number().int(),
  approvedQuantity: z.number().int().nullish(),
  receivedQuantity: z.number().int().nullish(),
  refundQuantity: z.number().int(),
  refundAmount: z.number().nullish(),
});

export const returnEvidenceDtoSchema = z.object({
  id: z.string(),
  stage: z.string(),
  originalName: z.string().nullish(),
  contentType: z.string().nullish(),
  sizeBytes: z.number().nullish(),
  uploadedBy: z.string().nullish(),
  uploadedAt: z.string(),
  /** Link ảnh nhỏ có hạn ngắn, chỉ có ở chi tiết. */
  thumbnailUrl: z.string().nullish(),
  /**
   * WF-05 Q-11 (BE G4, stage `CUSTODY`): biên nhận giữ hộ — hàng về mà phiếu nhập không nhận (SKU không duyệt, vượt số
   * duyệt, kiện về sau khi đã chốt tiền). Không nhập tồn, không hoàn, không điều chỉnh hoá đơn.
   */
  custody: z
    .object({
      sku: z.string().nullish(),
      lpn: z.string().nullish(),
      quantity: z.number().int(),
      note: z.string().nullish(),
    })
    .nullish(),
});

export const returnReviewDtoSchema = z.object({
  decidedBy: z.string().nullish(),
  decidedAt: z.string().nullish(),
  note: z.string().nullish(),
  rejectionReason: z.string().nullish(),
  returnRequired: z.boolean().nullish(),
  returnDeadline: z.string().nullish(),
});

/** Một lần hàng về (WF-05 TH-3): mỗi phiếu nhập hàng hoàn đã xác nhận mang hàng của yêu cầu, lần đầu trước. */
export const returnParcelDtoSchema = z.object({
  parcel: z.number().int(),
  goodsReceiptId: z.string().nullish(),
  receiptNumber: z.string().nullish(),
  locationCode: z.string().nullish(),
  receivedBy: z.string().nullish(),
  receivedAt: z.string().nullish(),
});

/** `goodsReceiptId` = phiếu đầu tiên (không đổi); người / lúc / khu theo lần về gần nhất. */
export const returnReceiptRefDtoSchema = z.object({
  receivedBy: z.string().nullish(),
  receivedAt: z.string().nullish(),
  locationCode: z.string().nullish(),
  goodsReceiptId: z.string().nullish(),
  parcels: z.array(returnParcelDtoSchema).nullish(),
});

/** Hoàn tiền: `settlementAmount` = `offsetAmount` (cấn trừ đợt còn nợ) + `refundedAmount` (đã trả, phải chuyển lại). */
export const returnResolutionDtoSchema = z.object({
  moneyMode: z.string().nullish(),
  settlementAmount: z.number().nullish(),
  proposedBy: z.string().nullish(),
  proposedAt: z.string().nullish(),
  note: z.string().nullish(),
  settledBy: z.string().nullish(),
  settledAt: z.string().nullish(),
  offsetAmount: z.number().nullish(),
  refundedAmount: z.number().nullish(),
  vatAdjustmentRequired: z.boolean().nullish(),
});

export const returnDiscrepancyDtoSchema = z.object({
  id: z.string(),
  lineId: z.string().nullish(),
  kind: z.string(),
  sku: z.string().nullish(),
  quantity: z.number().int(),
  note: z.string().nullish(),
  recordedAt: z.string().nullish(),
});

export const returnHistoryDtoSchema = z.object({
  from: z.string().nullish(),
  to: z.string(),
  reason: z.string().nullish(),
  actorId: z.string().nullish(),
  occurredAt: z.string(),
});

export const returnRequestDtoSchema = z.object({
  id: z.string(),
  rmaNumber: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string(),
  /** Lô giao đã giao mà hàng trả thuộc về (WF-05 TH-1); null với đơn giao không qua lô. */
  shipmentId: z.string().nullish(),
  status,
  reasonCode: reason,
  description: z.string().nullish(),
  requestedResolution: z.string().nullish(),
  channel,
  requestedBy: z.string().nullish(),
  requestedAt: z.string(),
  lateClaimReason: z.string().nullish(),
  currency: z.string(),
  review: returnReviewDtoSchema.nullish(),
  receipt: returnReceiptRefDtoSchema.nullish(),
  resolution: returnResolutionDtoSchema.nullish(),
  cancelledBy: z.string().nullish(),
  cancellationReason: z.string().nullish(),
  closedAt: z.string().nullish(),
  lines: z.array(returnLineDtoSchema),
  evidence: z.array(returnEvidenceDtoSchema).nullish(),
  discrepancies: z.array(returnDiscrepancyDtoSchema).nullish(),
  history: z.array(returnHistoryDtoSchema).nullish(),
  /**
   * WF-05 F-20 (BE G4): kết quả khi đã xử lý xong — REFUNDED / REFUSED (0 đồng có lý do, Q-4) / NOTHING_TO_REFUND (TH-4);
   * null khi chưa xong hoặc BE cũ.
   */
  outcome: tolerantEnum(RETURN_OUTCOMES).nullish(),
  /**
   * Lý do giữ lại đơn vị đã về (danh sách cố định, Q-4): bắt buộc khi đề xuất 0 đơn vị, tuỳ chọn khi giữ lại một phần.
   */
  refusalReason: tolerantEnum(RETURN_REFUSAL_REASONS).nullish(),
  /** Ghi chú công khai kèm lý do không hoàn — khách đọc được (BE G4 `refusalNote`). */
  refusalNote: z.string().nullish(),
  /** BE-13 / Q-11: kho lập được phiếu nhập hàng hoàn cho yêu cầu này (BE tự tính — FE không suy lại). */
  receiptOpenable: z.boolean().nullish(),
  /** BE-23: đang có phiếu nhập hàng hoàn NHÁP của yêu cầu — chưa chốt "Đã nhận đủ hàng" được. */
  receiptDraftOpen: z.boolean().nullish(),
  version: z.number().int(),
});

/** Một dòng của hàng đợi (BE `ReturnRequestRowResponse`). */
export const returnRowDtoSchema = z.object({
  id: z.string(),
  rmaNumber: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string(),
  shipmentId: z.string().nullish(),
  status,
  reasonCode: reason,
  requestedResolution: z.string().nullish(),
  channel,
  requestedAt: z.string(),
  returnDeadline: z.string().nullish(),
  settlementAmount: z.number().nullish(),
  refundedAmount: z.number().nullish(),
  offsetAmount: z.number().nullish(),
  currency: z.string(),
  vatAdjustmentRequired: z.boolean(),
  closedAt: z.string().nullish(),
  /** Như `ReturnRequestResponse` khi BE kèm ở dòng (nguồn lập phiếu); vắng = dùng trạng thái dự phòng. */
  receiptOpenable: z.boolean().nullish(),
  outcome: tolerantEnum(RETURN_OUTCOMES).nullish(),
  version: z.number().int(),
});
export const returnPageDtoSchema = bePageSchema(returnRowDtoSchema);

export const evidenceLinkDtoSchema = z.object({ url: z.string() });

/* ── Phiếu nhập hàng hoàn (BE `ReturnReceiptService.ReturnReceiptView` / `ReturnReceiptRow`) ── */

const receiptStatus = tolerantEnum(RETURN_RECEIPT_API_STATUSES);

export const returnReceiptCartonDtoSchema = z.object({
  lpn: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  quantity: z.number().int(),
  condition: z.string().nullish(),
  scannedBy: z.string().nullish(),
  scannedAt: z.string().nullish(),
  /** WF-05 TH-4: số đếm thực trong thùng; `opened` khi ít hơn nhãn (`quantity`) — chỉ ghi giảm. */
  countedQuantity: z.number().int().nullish(),
  opened: z.boolean().nullish(),
  /**
   * WF-05 Q-18 / BE-20 (F-21): false = thùng về đã mở / rỗng, không nhập tồn (huỷ theo số đếm thật); null = phiếu chưa
   * xác nhận hoặc BE cũ.
   */
  stockEntered: z.boolean().nullish(),
  /** WF-05 Q-18: người ghi số đếm (quét hoặc đếm lại) — người xác nhận phiếu phải là người khác. */
  countedBy: z.string().nullish(),
});

/** Hàng về không nhãn thùng (WF-05 TH-4): ghi trên phiếu, không nhập tồn, vẫn tính là đã về cho RMA. */
export const returnLooseLineDtoSchema = z.object({
  id: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  quantity: z.number().int(),
  recordedBy: z.string().nullish(),
  /**
   * WF-05 Q-18 (BE G4 `LooseLineView.photoId`): ảnh hàng lẻ — một ảnh nhận hàng của chính phiếu
   * (`/goods-receipts/{id}/photos`); null ở dòng ghi trước Q-18.
   */
  photoId: z.string().nullish(),
});

export const expectedCartonDtoSchema = z.object({
  lpn: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  quantity: z.number().int(),
  scanned: z.boolean(),
});

export const returnReceiptDtoSchema = z.object({
  id: z.string(),
  number: z.string(),
  receiptType: z.string().nullish(),
  status: receiptStatus,
  warehouseId: z.string(),
  orderId: z.string().nullish(),
  orderNumber: z.string().nullish(),
  shipmentId: z.string().nullish(),
  shipmentCode: z.string().nullish(),
  returnRequestId: z.string().nullish(),
  rmaNumber: z.string().nullish(),
  quarantineLocationId: z.string().nullish(),
  quarantineLocationCode: z.string().nullish(),
  note: z.string().nullish(),
  receivedAt: z.string().nullish(),
  receivedBy: z.string().nullish(),
  confirmedAt: z.string().nullish(),
  confirmedBy: z.string().nullish(),
  closedAt: z.string().nullish(),
  cartons: z.array(returnReceiptCartonDtoSchema),
  expectedCartons: z.array(expectedCartonDtoSchema),
  looseLines: z.array(returnLooseLineDtoSchema).nullish(),
  /**
   * WF-05 Q-18 (BE G4): phiếu nháp có thùng mở hoặc hàng lẻ — chỉ Quản lý kho (khác người đếm) xác nhận được. Vắng = BE
   * cũ (FE suy từ thùng / hàng lẻ).
   */
  managerConfirmationRequired: z.boolean().nullish(),
  version: z.number().int(),
});

export const returnReceiptRowDtoSchema = z.object({
  id: z.string(),
  number: z.string(),
  receiptType: z.string().nullish(),
  status: receiptStatus,
  warehouseId: z.string(),
  orderId: z.string().nullish(),
  shipmentId: z.string().nullish(),
  returnRequestId: z.string().nullish(),
  receivedAt: z.string().nullish(),
  receivedBy: z.string().nullish(),
  closedAt: z.string().nullish(),
  cartonCount: z.number().int(),
});
export const returnReceiptPageDtoSchema = bePageSchema(returnReceiptRowDtoSchema);

/** Chuyến hãng hoàn về — chỉ những trường màn lập phiếu cần (BE `ShipmentRowResponse`, `status=RETURNED`). */
export const returnedShipmentDtoSchema = z
  .object({
    shipmentId: z.string(),
    code: z.string().nullish(),
    orderId: z.string(),
    orderNumber: z.string().nullish(),
    warehouseId: z.string(),
    status: z.string(),
    packageCount: z.number().int(),
  })
  .loose();
export const returnedShipmentPageDtoSchema = bePageSchema(returnedShipmentDtoSchema);
