/**
 * Schema nhập liệu của các form trả hàng — tách khỏi DTO của BE (`schemas.ts`, api-conventions §3.1).
 * Số lượng là số trong ô nhập (`valueAsNumber`); giới hạn theo BE `ReturnRequests`, `CreateReturnReceiptRequest`.
 */

import { z } from "zod";

import {
  RETURN_LIMITS,
  RETURN_NAMED_FAULTS,
  RETURN_OPENABLE_REASONS,
  RETURN_REFUSAL_REASONS,
} from "@/constants/returns";

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

type ProposedLine = { quantity: number; cap: number };
const proposedTotal = (lines: readonly ProposedLine[]) =>
  lines.reduce((sum, line) => sum + (Number.isFinite(line.quantity) ? line.quantity : 0), 0);
const refundableTotal = (lines: readonly ProposedLine[]) =>
  lines.reduce((sum, line) => sum + line.cap, 0);

/** Mọi dòng của đề xuất đều 0 trong khi còn đơn vị hoàn được — tức là đề xuất không hoàn tiền (WF-05 Q-4). */
export const refusesRefund = (lines: readonly ProposedLine[]): boolean =>
  proposedTotal(lines) === 0 && refundableTotal(lines) > 0;

/**
 * Đề xuất giữ lại ít nhất một đơn vị đã về (hoàn ít hơn số hoàn được) — chỉ khi đó mới có lý do không hoàn (BE G4
 * `ReturnRequest.proposeRefund`: lý do bị từ chối khi hoàn đủ mọi đơn vị).
 */
export const withholdsUnits = (lines: readonly ProposedLine[]): boolean =>
  proposedTotal(lines) < refundableTotal(lines);

/**
 * Đề xuất hoàn tiền: mỗi dòng 0..min(duyệt, đã về) (BE `ReturnRequest.proposeRefund`, docs 17 §4.10 bước 40). WF-05 Q-4
 * (BE-12), luật của BE G4:
 * - để 0 mọi dòng là đề xuất không hoàn tiền — bắt buộc chọn lý do trong danh sách cố định
 *   (`RETURN_REFUSAL_REASON_REQUIRED`);
 * - giữ lại một phần thì lý do tuỳ chọn; hoàn đủ thì không có lý do (BE từ chối);
 * - lý do "Khác" phải có ghi chú gửi khách; ghi chú gửi khách chỉ đi kèm lý do (≤ 500 ký tự).
 * Kế toán duyệt như mọi đề xuất (bốn mắt, nút "Duyệt hoàn tiền").
 */
export const proposeInputSchema = z
  .object({
    lines: z.array(cappedLine),
    note: z.string().trim().max(L.noteMax, max(L.noteMax)),
    /** "" = chưa chọn. */
    refusalReason: z.union([z.enum(RETURN_REFUSAL_REASONS), z.literal("")]),
    refusalNote: z.string().trim().max(L.refusalNoteMax, max(L.refusalNoteMax)),
  })
  .superRefine((v, ctx) => {
    if (refusesRefund(v.lines) && v.refusalReason === "")
      ctx.addIssue({
        code: "custom",
        message: "Mọi dòng đều 0 — chọn lý do không hoàn (khách đọc được).",
        path: ["refusalReason"],
      });
    if (withholdsUnits(v.lines) && v.refusalReason === "OTHER" && v.refusalNote === "")
      ctx.addIssue({
        code: "custom",
        message: "Lý do khác — ghi rõ cho khách lý do không hoàn.",
        path: ["refusalNote"],
      });
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

/**
 * Hàng lẻ không nhãn trên phiếu nhập hàng hoàn (WF-05 TH-4; BE `RecordLooseUnitsRequest`): SKU bắt buộc ≤ 64, lô ≤ 64,
 * số lượng ≥ 1. SKU phải là SKU của đơn — BE kiểm (`VALIDATION_FAILED`).
 */
export const looseLineInputSchema = z.object({
  sku: z.string().trim().min(1, "Nhập SKU").max(L.skuMax, max(L.skuMax)),
  lotNumber: z.string().trim().max(L.lotMax, max(L.lotMax)),
  quantity: z
    .number({ error: "Nhập số lượng" })
    .int("Số lượng là số nguyên")
    .min(1, "Số lượng ≥ 1"),
});

/**
 * Biên nhận giữ hộ (WF-05 Q-11, BE G4 `ReturnEvidence.Custody`): hàng về mà phiếu nhập không nhận — nêu SKU hoặc LPN (ít
 * nhất một), số lượng ≥ 1, ghi chú tuỳ chọn (lựa chọn của khách: gửi trả / mở yêu cầu bổ sung / huỷ hộ có biên bản).
 */
export const custodyInputSchema = z
  .object({
    sku: z.string().trim().max(L.custodySkuMax, max(L.custodySkuMax)),
    lpn: z.string().trim().max(L.custodyLpnMax, max(L.custodyLpnMax)),
    quantity: z
      .number({ error: "Nhập số lượng" })
      .int("Số lượng là số nguyên")
      .min(1, "Số lượng ≥ 1"),
    note: z.string().trim().max(L.custodyNoteMax, max(L.custodyNoteMax)),
  })
  .refine((v) => v.sku !== "" || v.lpn !== "", {
    message: "Nhập SKU hoặc LPN của hàng giữ hộ",
    path: ["sku"],
  });
