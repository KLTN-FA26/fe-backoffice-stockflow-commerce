/**
 * Vòng mẫu in của Đơn sản xuất, phía back-office (kltn-docs 17 §4.3 bước 9, BR-24; BE `ProductionSampleRoundController`).
 * Mỗi vòng: số vòng, ảnh / video, ngày gửi mẫu vật, kết quả khách trả lời, ghi chú khách, lý do in lại.
 */

import { z } from "zod";

import { PRODUCTION_LABELS, REPRINT_REASONS, SAMPLE_ROUND_RESULTS } from "@/constants";
import { todayIso } from "@/lib/date-range";

import { productionOrderStatusSchema } from "./schemas";

const S = PRODUCTION_LABELS.sample;

/** BE `SampleMedia` — byte xem qua `.../view-url`. */
export const sampleMediaDto = z.object({
  id: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
  video: z.boolean(),
  uploadedAt: z.string(),
});

/** BE `SampleRound`. `result` vắng khi vòng còn chờ khách. */
export const sampleRoundDto = z.object({
  id: z.string(),
  roundNo: z.number().int(),
  reprintReason: z.enum(REPRINT_REASONS).nullish(),
  /** Tính vào số lần in mẫu miễn phí (không phải PRINT_DEFECT). */
  counted: z.boolean(),
  physicalSampleSentOn: z.string().nullish(),
  openedBy: z.string(),
  openedAt: z.string(),
  result: z.enum(SAMPLE_ROUND_RESULTS).nullish(),
  customerNote: z.string().nullish(),
  answeredBy: z.string().nullish(),
  answeredAt: z.string().nullish(),
  media: z.array(sampleMediaDto).default([]),
});

/** BE `SampleRounds`: các vòng + số lần miễn phí của hợp đồng (14 BR-18) so với số vòng đã tính. */
export const sampleRoundsDto = z.object({
  productionOrderId: z.string(),
  code: z.string(),
  status: productionOrderStatusSchema,
  sampleApprovalRequired: z.boolean(),
  version: z.number().int(),
  /** Vắng khi hợp đồng không còn. */
  freeSampleRounds: z.number().int().nullish(),
  countedRounds: z.number().int(),
  /** Vượt số lần miễn phí → cảnh báo Điều phối sản xuất và Sale, không chặn (BR-24). */
  freeRoundsExceeded: z.boolean(),
  waitingRoundId: z.string().nullish(),
  rounds: z.array(sampleRoundDto).default([]),
});

export const sampleMediaLinkDto = z.object({ url: z.string(), expiresAt: z.string().nullish() });

/**
 * Form mở vòng (BE `OpenSampleRoundRequest`): vòng 1 không có lý do in lại; vòng sau bắt buộc lý do (BR-24 — Điều
 * phối sản xuất phân loại). Ngày gửi mẫu vật tuỳ chọn, không sau hôm nay.
 */
export function openRoundInput(reprint: boolean) {
  return z.object({
    reprintReason: z
      .enum(REPRINT_REASONS)
      .nullable()
      .refine((reason) => !reprint || reason !== null, S.reasonRequired),
    physicalSampleSentOn: z
      .string()
      .refine(
        (value) => value === "" || value <= todayIso(),
        PRODUCTION_LABELS.sample.physicalFuture,
      ),
  });
}

/** Ngày gửi mẫu vật của vòng đang chờ — bắt buộc, không sau hôm nay. */
export const physicalSampleInput = z.object({
  sentOn: z
    .string()
    .min(1, S.sentOnRequired)
    .refine((value) => value <= todayIso(), PRODUCTION_LABELS.sample.physicalFuture),
});

export type SampleMedia = z.infer<typeof sampleMediaDto>;
export type SampleRound = z.infer<typeof sampleRoundDto>;
export type SampleRounds = z.infer<typeof sampleRoundsDto>;
export type OpenRoundValues = z.infer<ReturnType<typeof openRoundInput>>;
export type PhysicalSampleValues = z.infer<typeof physicalSampleInput>;
