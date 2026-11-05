/**
 * Trạm đóng gói — Input schema (dữ liệu form gửi đi), khớp request BE PR #136.
 * Ô nhập là chuỗi (gõ tay hoặc máy quét) nên parse sang số ở đây; chấp nhận dấu phẩy thập phân kiểu VN.
 */

import { z } from "zod";

import { PACKAGE_TYPES, PACKING_FIELD_MESSAGES, PACKING_LIMITS } from "@/constants";

const MSG = PACKING_FIELD_MESSAGES;

const DECIMAL = /^\d+([.,]\d+)?$/;
const INTEGER = /^\d+$/;

function toNumber(text: string): number {
  return Number(text.replace(",", "."));
}

function decimalPlaces(text: string): number {
  return text.split(/[.,]/)[1]?.length ?? 0;
}

interface DecimalRule {
  max: number;
  scale: number;
  invalid: string;
  tooLarge: string;
  tooPrecise: string;
}

/** Số thập phân dương, không vượt `max` và số lẻ `scale` (BE `@Positive @Digits @DecimalMax`). */
function positiveDecimal(rule: DecimalRule) {
  const valid = (text: string) => DECIMAL.test(text) && toNumber(text) > 0;
  return z
    .string()
    .trim()
    .refine(valid, rule.invalid)
    .refine((text) => !valid(text) || toNumber(text) <= rule.max, rule.tooLarge)
    .refine((text) => !valid(text) || decimalPlaces(text) <= rule.scale, rule.tooPrecise)
    .transform(toNumber);
}

const dimension = () =>
  positiveDecimal({
    max: PACKING_LIMITS.dimensionCmMax,
    scale: PACKING_LIMITS.dimensionCmScale,
    invalid: MSG.dimensionInvalid,
    tooLarge: MSG.dimensionTooLarge,
    tooPrecise: MSG.dimensionScale,
  });

/** Cờ của kiện: bỏ trống = BE tính từ SKU bên trong; Có / Không = người đóng ghi đè (docs 08 bước 5, E13). */
export const FLAG_CHOICES = ["default", "yes", "no"] as const;
export type FlagChoice = (typeof FLAG_CHOICES)[number];

export const flagValue = (choice: FlagChoice): boolean | undefined =>
  choice === "default" ? undefined : choice === "yes";

/**
 * BE `SealPackageRequest`. BR-03 (docs 08 §6): kiện phải có khối lượng và kích thước thực đo —
 * thiếu một số là BE trả 400, nên form chặn trước.
 */
export const sealInputSchema = z.object({
  weightKg: positiveDecimal({
    max: PACKING_LIMITS.weightKgMax,
    scale: PACKING_LIMITS.weightKgScale,
    invalid: MSG.weightInvalid,
    tooLarge: MSG.weightTooLarge,
    tooPrecise: MSG.weightScale,
  }),
  lengthCm: dimension(),
  widthCm: dimension(),
  heightCm: dimension(),
  packageType: z.enum(PACKAGE_TYPES),
  rotatable: z.enum(FLAG_CHOICES).transform(flagValue),
  fragile: z.enum(FLAG_CHOICES).transform(flagValue),
});

export type PackingSealFormInput = z.input<typeof sealInputSchema>;
export type PackingSealValues = z.output<typeof sealInputSchema>;

/** Số nguyên dương 1..`max` (mặc định giới hạn BE của một lần quét). */
export function quantitySchema(max: number = PACKING_LIMITS.quantityMax) {
  const valid = (text: string) => INTEGER.test(text) && Number(text) >= 1;
  return z
    .string()
    .trim()
    .refine(valid, MSG.quantityRequired)
    .refine(
      (text) => !valid(text) || Number(text) <= PACKING_LIMITS.quantityMax,
      MSG.quantityTooLarge,
    )
    .refine((text) => !valid(text) || Number(text) <= max, MSG.quantityExceedsHeld)
    .transform(Number);
}

/** Số lượng của ô bên cạnh ô quét — tối đa theo BE `PackScanRequest.quantity`. */
export const scanQuantityInputSchema = quantitySchema();

export interface ScanDetailRules {
  needsLine: boolean;
  needsLot: boolean;
  needsSerial: boolean;
}

/**
 * Chi tiết bắt buộc kèm lần quét (BE `PackingSession.checkLot` / `checkSerial` / `lineFor`): dòng
 * khi mã nằm trên nhiều dòng, số lô khi dòng theo lô, serial khi dòng theo serial.
 */
export function scanDetailSchema({ needsLine, needsLot, needsSerial }: ScanDetailRules) {
  return z.object({
    orderLineId: needsLine ? z.string().min(1, MSG.lineRequired) : z.string(),
    lotNumber: needsLot
      ? z.string().trim().min(1, MSG.lotRequired).max(PACKING_LIMITS.lotMax)
      : z.string(),
    serialNumber: needsSerial
      ? z
          .string()
          .trim()
          .min(1, MSG.serialRequired)
          .max(PACKING_LIMITS.serialMax, MSG.serialTooLong)
      : z.string(),
  });
}

/**
 * BE `PackingCompletionRequest` + `PackingSession.complete`: giao một phần bắt buộc ghi lý do
 * (BE trả 400 `note`); đóng đủ thì bỏ ghi chú.
 */
export const completeInputSchema = z
  .object({
    mode: z.enum(["full", "partial"]),
    note: z.string().trim().max(PACKING_LIMITS.noteMax, MSG.noteTooLong),
  })
  .refine((value) => value.mode === "full" || value.note.length > 0, {
    message: MSG.noteRequired,
    path: ["note"],
  });

export type CompleteFormInput = z.input<typeof completeInputSchema>;
