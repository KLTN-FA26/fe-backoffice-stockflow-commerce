/**
 * Trả hàng — DTO của BE (order module: `ReturnRequestController`, `ReturnResolutionController`; procurement:
 * `ReturnReceiptController`). Jackson `non_null` bỏ trường chưa đặt → `.nullish()`; tiền là `BigDecimal` → number.
 * Schema nhập liệu: `input-schemas.ts`. Docs 17 §4.10, 03 §4.2, 15 §4.5.
 */

import { z } from "zod";

import {
  RETURN_API_STATUSES,
  RETURN_CARTON_ELIGIBILITIES,
  RETURN_CHANNELS,
  RETURN_CUSTODY_CHOICES,
  RETURN_CUSTODY_NOTE_CHOICES,
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

/**
 * Audit r3 RAD-3 (BE `ReturnRequestResponse.CustodyOutcome`, Q-11 hỏi thêm): kết cục của hàng trên một biên nhận giữ hộ —
 * lựa chọn của khách Sale ghi, và khi Quản lý kho đã làm: ai, lúc nào, biên bản. Null cho tới khi Sale ghi lựa chọn.
 */
export const custodyOutcomeDtoSchema = z.object({
  choice: tolerantEnum(RETURN_CUSTODY_NOTE_CHOICES),
  /** Biên bản lựa chọn dựa vào: huỷ hộ phải có biên bản khách đồng ý. */
  choiceNote: z.string().nullish(),
  /** TAKEN_BY_RETURN: yêu cầu trả hàng bổ sung nhận hàng này. */
  takenByReturnId: z.string().nullish(),
  takenByRmaNumber: z.string().nullish(),
  chosenBy: z.string().nullish(),
  chosenAt: z.string().nullish(),
  /** Lúc hàng đã rời kho đúng lựa chọn; null khi còn giữ. */
  endedAt: z.string().nullish(),
  endedBy: z.string().nullish(),
  /** Biên bản của việc rời kho (giao trả, huỷ, phiếu nhập của yêu cầu bổ sung). */
  endedNote: z.string().nullish(),
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
      /** Audit r3 RAD-3: kết cục của hàng giữ hộ; null / vắng (BE cũ) = chưa có lựa chọn. */
      outcome: custodyOutcomeDtoSchema.nullish(),
    })
    .nullish(),
});

/**
 * Thùng của yêu cầu giữ hộ khách (BE `ReturnRequestResponse.HeldCarton`, WF-05 Q-4; audit r3 RAD-1): khoản hoàn tiền không
 * lấy lại thùng này (SKU không hoàn, hoặc thùng nguyên vượt số được hoàn). `ownership` CUSTOMER_HELD khi đang giữ,
 * CUSTOMER_SENT_BACK / CUSTOMER_DESTROYED khi kho đã làm theo lựa chọn; chuỗi mở.
 */
export const heldCartonDtoSchema = z.object({
  lpn: z.string(),
  sku: z.string().nullish(),
  quantity: z.number().int(),
  locationCode: z.string().nullish(),
  ownership: z.string(),
  choice: tolerantEnum(RETURN_CUSTODY_CHOICES).nullish(),
  heldAt: z.string().nullish(),
  endedAt: z.string().nullish(),
});

export const returnReviewDtoSchema = z.object({
  decidedBy: z.string().nullish(),
  /** #286: tên người quyết định kèm id — BE bỏ khi null, đọc kèm fallback. */
  decidedByName: z.string().nullish(),
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
  receivedByName: z.string().nullish(),
  receivedAt: z.string().nullish(),
});

/** `goodsReceiptId` = phiếu đầu tiên (không đổi); người / lúc / khu theo lần về gần nhất. */
export const returnReceiptRefDtoSchema = z.object({
  receivedBy: z.string().nullish(),
  receivedByName: z.string().nullish(),
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
  proposedByName: z.string().nullish(),
  proposedAt: z.string().nullish(),
  note: z.string().nullish(),
  settledBy: z.string().nullish(),
  settledByName: z.string().nullish(),
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
  /** #286: tên người thực hiện bước; vắng (hệ thống / BE cũ) → không hiện người. */
  actorName: z.string().nullish(),
  occurredAt: z.string(),
});

export const returnRequestDtoSchema = z.object({
  id: z.string(),
  rmaNumber: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string(),
  /** #286: tên + mã khách kèm id — kế toán / kho thấy tên mà không cần quyền xem khách. */
  customerName: z.string().nullish(),
  customerCode: z.string().nullish(),
  /** Lô giao đã giao mà hàng trả thuộc về (WF-05 TH-1); null với đơn giao không qua lô. */
  shipmentId: z.string().nullish(),
  status,
  reasonCode: reason,
  description: z.string().nullish(),
  requestedResolution: z.string().nullish(),
  channel,
  requestedBy: z.string().nullish(),
  requestedByName: z.string().nullish(),
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
  /**
   * WF-05 Q-4 (audit r2 returns H1): lựa chọn của khách cho hàng giữ hộ sau một yêu cầu không hoàn tiền, Sale ghi
   * (`POST /returns/{id}/custody-choice`); null khi chưa ghi. Mã lạ → UNKNOWN.
   */
  custodyChoice: tolerantEnum(RETURN_CUSTODY_CHOICES).nullish(),
  custodyChoiceNote: z.string().nullish(),
  custodyChoiceBy: z.string().nullish(),
  custodyChoiceAt: z.string().nullish(),
  /**
   * Audit r3 RAD-1 / RAD-3: các thùng của yêu cầu giữ hộ khách (đang giữ hoặc đã xử lý) — điều `custodyChoice` nói tới. BE
   * gửi ở `GET /returns/{id}` và câu trả lời của custody-choice (rỗng khi không có); vắng ở câu trả lời khác / BE cũ = null
   * (không biết → không mở "Ghi lựa chọn").
   */
  custodyCartons: z.array(heldCartonDtoSchema).nullish(),
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
  /**
   * WF-05 BE-23 (BE fc931ff9): một kiện của yêu cầu đang được đếm trên phiếu nhập hàng hoàn NHÁP — không lập phiếu thứ
   * hai, chưa chốt "Đã nhận đủ" / đề xuất / duyệt hoàn tiền tới khi kho xác nhận hoặc huỷ phiếu đó. Vắng = BE cũ.
   */
  receiptDraftOpen: z.boolean().nullish(),
  outcome: tolerantEnum(RETURN_OUTCOMES).nullish(),
  /** Audit r2 money L-6 (BE r3c): mã lý do không hoàn (danh sách cố định), như ở chi tiết; null khi không giữ lại gì. */
  refusalReason: tolerantEnum(RETURN_REFUSAL_REASONS).nullish(),
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
  /**
   * WF-05 Q-4 (audit r2 returns H1): yêu cầu không hoàn tiền — thùng đã nhập rồi bị đảo bút toán, hàng của khách giữ hộ,
   * không phải tồn kho dù `stockEntered` nói gì. Vắng = BE cũ.
   */
  heldForCustomer: z.boolean().nullish(),
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
  /** WF-05 Q-11 / TH-3: đã về trên một phiếu khác đã xác nhận (chuyến / kiện trước) — không phải thùng thiếu. */
  receivedEarlier: z.boolean().nullish(),
});

/**
 * Tiến độ nhận theo SKU đã duyệt của yêu cầu trả hàng (BE `ReturnReceiptService.ReturnProgress`): đếm theo số lượng, không
 * theo thùng. `confirmedReceivedQuantity` = trên các phiếu khác đã xác nhận; `currentReceiptQuantity` = trên phiếu này (nháp:
 * đã ghi, chưa chính thức); `remainingQuantity` = còn được nhận (số BE dùng để chặn khi quét / ghi hàng lẻ).
 */
export const returnProgressDtoSchema = z.object({
  sku: z.string(),
  approvedQuantity: z.number().int(),
  confirmedReceivedQuantity: z.number().int(),
  currentReceiptQuantity: z.number().int(),
  remainingQuantity: z.number().int(),
});

/** Thùng của nguồn với phiếu nháp (BE `CandidateCarton`): gợi ý, không phải quyền — BE quyết lại khi quét. */
export const candidateCartonDtoSchema = z.object({
  lpn: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  quantity: z.number().int(),
  maxReceivableQuantity: z.number().int(),
  eligibility: tolerantEnum(RETURN_CARTON_ELIGIBILITIES),
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
  /** Chỉ phiếu của yêu cầu trả hàng; vắng = BE cũ (màn quay về đối chiếu theo thùng). */
  returnProgress: z.array(returnProgressDtoSchema).nullish(),
  /** Chỉ phiếu NHÁP của yêu cầu trả hàng. */
  candidateCartons: z.array(candidateCartonDtoSchema).nullish(),
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

/**
 * Thùng giữ hộ khách (BE `CustomerCustodyResponse`, WF-05 Q-4 / TH-6): ngoài sổ kho, đứng ở khu cách ly, chờ thực hiện
 * lựa chọn của khách (`choice`; null = chờ Sale ghi).
 */
export const customerCustodyDtoSchema = z.object({
  lpn: z.string(),
  sku: z.string().nullish(),
  lotNumber: z.string().nullish(),
  quantity: z.number().int(),
  locationCode: z.string().nullish(),
  returnRequestId: z.string().nullish(),
  ownership: z.string(),
  heldAt: z.string().nullish(),
  choice: tolerantEnum(RETURN_CUSTODY_CHOICES).nullish(),
  endedAt: z.string().nullish(),
  endedBy: z.string().nullish(),
  note: z.string().nullish(),
});
export const customerCustodyPageDtoSchema = bePageSchema(customerCustodyDtoSchema);

/**
 * Hàng giữ hộ trên một biên nhận (BE `CustodyNoteResponse`, `GET /returns/custody-notes`; audit r3 RAD-3, TH-6): hàng gì,
 * trên yêu cầu nào, kết cục ra sao. `choice` null = chờ Sale; `endedAt` có = đã rời kho.
 */
export const custodyNoteDtoSchema = z.object({
  evidenceId: z.string(),
  returnRequestId: z.string(),
  rmaNumber: z.string().nullish(),
  orderId: z.string().nullish(),
  orderNumber: z.string().nullish(),
  customerId: z.string().nullish(),
  warehouseId: z.string().nullish(),
  sku: z.string().nullish(),
  lpn: z.string().nullish(),
  quantity: z.number().int(),
  note: z.string().nullish(),
  keptBy: z.string().nullish(),
  keptAt: z.string().nullish(),
  choice: tolerantEnum(RETURN_CUSTODY_NOTE_CHOICES).nullish(),
  choiceNote: z.string().nullish(),
  takenByReturnId: z.string().nullish(),
  takenByRmaNumber: z.string().nullish(),
  chosenBy: z.string().nullish(),
  chosenAt: z.string().nullish(),
  endedAt: z.string().nullish(),
  endedBy: z.string().nullish(),
  endedNote: z.string().nullish(),
});
export const custodyNotePageDtoSchema = bePageSchema(custodyNoteDtoSchema);

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
