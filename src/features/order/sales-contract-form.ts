/**
 * Editor hợp đồng nháp — form ↔ body BE `SalesContractRequests.Draft` (origin/develop 438fe6fb).
 * Kiểm ở FE chỉ để báo sớm; quy tắc tổng (Σ thùng, Σ đợt = tổng đơn) BE kiểm lại và trả `fieldErrors`
 * (`DELIVERY_SCHEDULE_INVALID`, `PAYMENT_PLAN_INVALID`).
 */

import { z } from "zod";

import { CONTRACT_MILESTONES } from "@/constants";

import type { SalesContract } from "./sales-contract-schemas";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INT = /^\d+$/;
const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;

const batchLineSchema = z.object({ orderLineId: z.string(), cartons: z.string().trim() });
const batchSchema = z.object({
  windowStart: z.string().trim(),
  windowEnd: z.string().trim(),
  lines: z.array(batchLineSchema),
});
const installmentSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên đợt").max(100, "Tối đa 100 ký tự"),
  milestone: z.enum(CONTRACT_MILESTONES),
  /** Số tiền hoặc % — chọn một (BE `Installment`: amount / percent). */
  mode: z.enum(["amount", "percent"]),
  value: z.string().trim(),
  dueDays: z.string().trim(),
  /** Số thứ tự đợt giao gắn kèm; "" = không gắn. ON_SIGNING không gắn. */
  deliveryBatchSeq: z.string().trim(),
});

export const contractFormSchema = z
  .object({
    freeSampleRounds: z.string().trim().regex(INT, "Số nguyên ≥ 0"),
    returnWindowDays: z
      .string()
      .trim()
      .refine((v) => INT.test(v) && Number(v) >= 1 && Number(v) <= 365, "Từ 1 đến 365 ngày"),
    deliverySchedule: z
      .array(batchSchema)
      .min(1, "Cần ít nhất một đợt giao")
      .max(20, "Tối đa 20 đợt"),
    paymentPlan: z
      .array(installmentSchema)
      .min(1, "Cần ít nhất một đợt thanh toán")
      .max(20, "Tối đa 20 đợt"),
  })
  .superRefine((form, ctx) => {
    let previousStart = "";
    form.deliverySchedule.forEach((batch, i) => {
      const path = ["deliverySchedule", i];
      // BE: cửa sổ giao nhập đủ cả hai ngày hoặc bỏ trống cả hai; ngày kết thúc không trước ngày bắt đầu.
      if (!!batch.windowStart !== !!batch.windowEnd)
        ctx.addIssue({
          code: "custom",
          path: [...path, "windowEnd"],
          message: "Nhập đủ từ ngày – đến ngày",
        });
      if (batch.windowStart && !DAY.test(batch.windowStart))
        ctx.addIssue({
          code: "custom",
          path: [...path, "windowStart"],
          message: "Ngày không hợp lệ",
        });
      if (batch.windowStart && batch.windowEnd && batch.windowEnd < batch.windowStart)
        ctx.addIssue({
          code: "custom",
          path: [...path, "windowEnd"],
          message: "Đến ngày không trước từ ngày",
        });
      // Đợt sau bắt đầu không sớm hơn đợt trước.
      if (batch.windowStart && previousStart && batch.windowStart < previousStart)
        ctx.addIssue({
          code: "custom",
          path: [...path, "windowStart"],
          message: "Đợt sau không bắt đầu sớm hơn đợt trước",
        });
      if (batch.windowStart) previousStart = batch.windowStart;
      batch.lines.forEach((line, j) => {
        if (line.cartons && !INT.test(line.cartons))
          ctx.addIssue({
            code: "custom",
            path: [...path, "lines", j, "cartons"],
            message: "Số nguyên ≥ 0",
          });
      });
      if (!batch.lines.some((line) => Number(line.cartons) > 0))
        ctx.addIssue({
          code: "custom",
          path: [...path, "lines"],
          message: "Đợt giao cần ít nhất một dòng có thùng",
        });
    });
    form.paymentPlan.forEach((entry, i) => {
      const path = ["paymentPlan", i];
      const valid =
        entry.mode === "percent"
          ? PERCENT.test(entry.value) && Number(entry.value) <= 100
          : INT.test(entry.value);
      if (!valid || Number(entry.value) <= 0)
        ctx.addIssue({
          code: "custom",
          path: [...path, "value"],
          message:
            entry.mode === "percent" ? "% từ 0,01 đến 100 (2 số lẻ)" : "Số tiền nguyên VND > 0",
        });
      // 14 §4.3: BEFORE_DELIVERY không có số ngày; ON_SIGNING / AFTER_DELIVERY 0–365.
      if (
        entry.milestone !== "BEFORE_DELIVERY" &&
        entry.dueDays &&
        (!INT.test(entry.dueDays) || Number(entry.dueDays) > 365)
      )
        ctx.addIssue({ code: "custom", path: [...path, "dueDays"], message: "Từ 0 đến 365 ngày" });
      if (entry.deliveryBatchSeq && Number(entry.deliveryBatchSeq) > form.deliverySchedule.length)
        ctx.addIssue({
          code: "custom",
          path: [...path, "deliveryBatchSeq"],
          message: "Đợt giao không tồn tại",
        });
    });
  });

export type ContractFormValues = z.input<typeof contractFormSchema>;
export type ContractFormOutput = z.output<typeof contractFormSchema>;
export type InstallmentFormValues = ContractFormValues["paymentPlan"][number];

/** Body `Draft` (không gồm `version`). */
export function toContractDraftBody(values: ContractFormOutput) {
  return {
    freeSampleRounds: Number(values.freeSampleRounds),
    returnWindowDays: Number(values.returnWindowDays),
    deliverySchedule: values.deliverySchedule.map((batch) => ({
      ...(batch.windowStart ? { windowStart: batch.windowStart, windowEnd: batch.windowEnd } : {}),
      lines: batch.lines
        .filter((line) => Number(line.cartons) > 0)
        .map((line) => ({ orderLineId: line.orderLineId, cartons: Number(line.cartons) })),
    })),
    paymentPlan: values.paymentPlan.map((entry) => ({
      name: entry.name,
      milestone: entry.milestone,
      ...(entry.mode === "percent"
        ? { percent: Number(entry.value) }
        : { amount: Number(entry.value) }),
      ...(entry.milestone !== "BEFORE_DELIVERY" && entry.dueDays
        ? { dueDays: Number(entry.dueDays) }
        : {}),
      ...(entry.milestone !== "ON_SIGNING" && entry.deliveryBatchSeq
        ? { deliveryBatchSeq: Number(entry.deliveryBatchSeq) }
        : {}),
    })),
  };
}

export type ContractDraftBody = ReturnType<typeof toContractDraftBody>;

const isMilestone = (value: string): value is (typeof CONTRACT_MILESTONES)[number] =>
  (CONTRACT_MILESTONES as readonly string[]).includes(value);

/**
 * Tên đợt mặc định BE tự đặt bằng tiếng Anh (`SalesContractService#defaultPlan`: "On signing" khi khách chưa có lịch
 * thanh toán mặc định) → tên tiếng Việt trong editor, để lần lưu kế tiếp không còn chữ Anh trên hợp đồng (WF-02 audit).
 */
const BE_DEFAULT_INSTALLMENT_NAMES: Readonly<Record<string, string>> = {
  "On signing": "Thanh toán khi ký",
};

export function toInstallmentForm(
  entry: SalesContract["paymentPlan"][number],
): InstallmentFormValues {
  return {
    name: BE_DEFAULT_INSTALLMENT_NAMES[entry.name] ?? entry.name,
    milestone: isMilestone(entry.milestone) ? entry.milestone : "ON_SIGNING",
    mode: entry.percent != null ? "percent" : "amount",
    value: String(entry.percent ?? entry.amount),
    dueDays: entry.dueDays != null ? String(entry.dueDays) : "",
    deliveryBatchSeq: entry.deliveryBatchSeq != null ? String(entry.deliveryBatchSeq) : "",
  };
}

/** Hợp đồng nháp → form; mỗi đợt giao có đủ các dòng đơn (dòng không có trong đợt = 0 thùng). */
export function toContractForm(
  contract: SalesContract,
  orderLineIds: readonly string[],
): ContractFormValues {
  return {
    freeSampleRounds: String(contract.freeSampleRounds),
    returnWindowDays: String(contract.returnWindowDays ?? 7),
    deliverySchedule: contract.deliverySchedule.map((batch) => ({
      windowStart: batch.windowStart ?? "",
      windowEnd: batch.windowEnd ?? "",
      lines: orderLineIds.map((orderLineId) => ({
        orderLineId,
        cartons: String(batch.lines.find((line) => line.orderLineId === orderLineId)?.cartons ?? 0),
      })),
    })),
    paymentPlan: contract.paymentPlan.map(toInstallmentForm),
  };
}
