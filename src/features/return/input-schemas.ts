/**
 * Schema nhập liệu của các form trả hàng — tách khỏi DTO của BE (`schemas.ts`, api-conventions §3.1).
 * Số lượng là số trong ô nhập (`valueAsNumber`); giới hạn theo BE `ReturnRequests`, `CreateReturnReceiptRequest`.
 */

import { z } from "zod";

import { RETURN_LIMITS, RETURN_NAMED_FAULTS, RETURN_OPENABLE_REASONS } from "@/constants/returns";

const L = RETURN_LIMITS;
const max = (n: number) => `Tối đa ${n} ký tự`;

const quantity = z
  .number({ error: "Nhập số lượng" })
  .int("Số lượng là số nguyên")
  .min(0, "Không âm");

/** Một dòng có trần (số còn được duyệt / hoàn / trả) — trần đi kèm dòng để refine theo từng dòng. */
const cappedLine = z
  .object({ lineId: z.string(), quantity, cap: z.number().int() })
  .refine((line) => line.quantity <= line.cap, {
    message: "Vượt số cho phép của dòng",
    path: ["quantity"],
  });

/** Duyệt (Sale): mỗi dòng 0..số yêu cầu; ít nhất một đơn vị — duyệt 0 là từ chối (docs 17 §4.10 bước 38). */
export const approveInputSchema = z.object({
  lines: z
    .array(cappedLine)
    .refine((lines) => lines.some((line) => line.quantity > 0), "Duyệt ít nhất một đơn vị"),
  note: z.string().trim().max(L.noteMax, max(L.noteMax)),
});

export const reasonInputSchema = z.object({
  reason: z.string().trim().min(1, "Nhập lý do").max(L.reasonMax, max(L.reasonMax)),
});

export const cancelInputSchema = z.object({
  reason: z.string().trim().max(L.reasonMax, max(L.reasonMax)),
});

/** Đề xuất hoàn tiền: mỗi dòng 0..min(duyệt, đã về) (BE `ReturnRequest.proposeRefund`, docs 17 §4.10 bước 40). */
export const proposeInputSchema = z.object({
  lines: z
    .array(cappedLine)
    .refine((lines) => lines.some((line) => line.quantity > 0), "Hoàn ít nhất một đơn vị"),
  note: z.string().trim().max(L.noteMax, max(L.noteMax)),
});

/**
 * Sale mở yêu cầu thay khách (BE `ReturnRequests.Open`, `ReturnRequest.open`):
 * - `OTHER` phải mô tả vấn đề;
 * - BR-RMA-002 (docs 17 BR-08): dòng in theo thiết kế chỉ trả vì lỗi có tên — không nhận `OTHER`;
 * - số trả mỗi dòng ≤ số đã giao trên lô đã chọn (trần do màn tính, BE kiểm lại kể cả phần các yêu cầu khác đã giữ).
 */
export const openInputSchema = z
  .object({
    /** WF-05 TH-1: lô đã giao chứa hàng trả; "" = đơn chỉ một lô đã giao / giao không qua lô (BE tự chọn). */
    shipmentId: z.string(),
    /** Đơn đã giao ≥ 2 lô: phải chọn lô (BE `RETURN_SHIPMENT_REQUIRED`). */
    shipmentRequired: z.boolean(),
    reasonCode: z.enum(RETURN_OPENABLE_REASONS, { error: "Chọn lý do" }),
    description: z.string().trim().max(L.descriptionMax, max(L.descriptionMax)),
    lateClaimReason: z.string().trim().max(L.lateClaimReasonMax, max(L.lateClaimReasonMax)),
    lines: z.array(
      z
        .object({
          orderLineId: z.string(),
          quantity,
          cap: z.number().int(),
          customPrinted: z.boolean(),
        })
        .refine((line) => line.quantity <= line.cap, {
          message: "Vượt số đã giao",
          path: ["quantity"],
        }),
    ),
  })
  // WF-05 TH-1 (BE `ReturnRequest.deliveredShipment`): mỗi yêu cầu thuộc đúng một lô đã giao
  .refine((v) => !v.shipmentRequired || v.shipmentId.length > 0, {
    message: "Đơn giao nhiều lô — chọn lô chứa hàng khách trả",
    path: ["shipmentId"],
  })
  .refine((v) => v.reasonCode !== "OTHER" || v.description.length > 0, {
    message: "Mô tả vấn đề khi chọn lý do Khác",
    path: ["description"],
  })
  .refine((v) => v.lines.some((line) => line.quantity > 0), {
    message: "Chọn ít nhất một dòng với số lượng ≥ 1",
    path: ["lines"],
  })
  .refine(
    (v) =>
      (RETURN_NAMED_FAULTS as readonly string[]).includes(v.reasonCode) ||
      !v.lines.some((line) => line.customPrinted && line.quantity > 0),
    {
      message: "Hàng in theo thiết kế chỉ trả vì lỗi có tên (BR-RMA-002) — chọn lý do cụ thể",
      path: ["reasonCode"],
    },
  );

/** Lập phiếu nhập hàng hoàn: đúng một nguồn (BE `VALIDATION_FAILED` khi thiếu / thừa) + khu cách ly. */
export const createReceiptInputSchema = z
  .object({
    sourceType: z.enum(["RMA", "SHIPMENT"]),
    returnRequestId: z.string(),
    shipmentId: z.string(),
    warehouseId: z.string().min(1, "Chọn kho"),
    quarantineLocationCode: z
      .string()
      .trim()
      .min(1, "Chọn khu cách ly")
      .max(L.locationCodeMax, max(L.locationCodeMax)),
    note: z.string().trim().max(L.receiptNoteMax, max(L.receiptNoteMax)),
  })
  .refine((v) => (v.sourceType === "RMA" ? !!v.returnRequestId : !!v.shipmentId), {
    message: "Chọn nguồn hàng về",
    path: ["returnRequestId"],
  });

export const scanInputSchema = z.object({
  lpn: z.string().trim().min(1, "Quét hoặc nhập LPN").max(L.lpnMax, max(L.lpnMax)),
  condition: z.string().trim().max(L.conditionMax, max(L.conditionMax)),
});
