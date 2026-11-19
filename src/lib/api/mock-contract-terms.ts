/**
 * BE `ContractTerms` (origin/develop) cho mock hợp đồng: lịch giao và lịch thanh toán kiểm với đơn (kltn-docs 14 §4.3 bước
 * 11–12, BR-13, BR-23; 15 BR-12, BR-18). Thuần — không đổi đơn hay hợp đồng. Mọi luật vi phạm được gom thành `fieldErrors`
 * (`DELIVERY_SCHEDULE_INVALID` / `PAYMENT_PLAN_INVALID`, 409), thông báo nguyên văn `refusal.contract.*` của messages_vi.
 */

import { grossOf, orderTotal } from "./mock-contract-orders";
import { mulDivHalfUp, percentOf, viNumber } from "./mock-quote-money";
import { refuse } from "./mock-quote-refusal";

import type { ContractMilestone } from "@/constants";
import type { Wf02Order } from "./mock-contract-orders";
import type { MockFieldError } from "./mock-quote-refusal";

/** Số đợt giao / đợt thanh toán tối đa (BE `ContractTerms.MAX_ROWS`). */
export const MAX_ROWS = 20;

export interface MockBatch {
  seq: number;
  windowStart: string | null;
  windowEnd: string | null;
  lines: { orderLineId: string; cartons: number }[];
}

export interface MockPlannedInstallment {
  seq: number;
  name: string;
  milestone: ContractMilestone;
  percent: number | null;
  amount: number;
  dueDays: number | null;
  deliveryBatchSeq: number | null;
}

/** Đợt giao Sale nhập (null = phần tử null trong mảng). */
export type BatchEntry = {
  windowStart: string | null;
  windowEnd: string | null;
  lines: ({ orderLineId: string | null; cartons: number | null } | null)[];
} | null;

/** Đợt thanh toán Sale nhập: số tiền HOẶC % tổng có thuế. */
export type InstallmentEntry = {
  name: string | null;
  milestone: ContractMilestone | null;
  amount: number | null;
  percent: number | null;
  dueDays: number | null;
  deliveryBatchSeq: number | null;
} | null;

function invalidSchedule(errors: MockFieldError[]): never {
  return refuse(
    409,
    "DELIVERY_SCHEDULE_INVALID",
    `Lịch giao chưa hợp lệ (${errors.length} lỗi); xem chi tiết từng trường.`,
    errors,
  );
}

function invalidPlan(errors: MockFieldError[]): never {
  return refuse(
    409,
    "PAYMENT_PLAN_INVALID",
    `Lịch thanh toán chưa hợp lệ (${errors.length} lỗi); xem chi tiết từng trường.`,
    errors,
  );
}

const rule = (field: string, message: string): MockFieldError => ({
  field,
  message,
  code: "BR-23",
});

/** 14 §4.3 bước 11: một đợt giao toàn bộ số thùng, cửa sổ = ngày giao khách yêu cầu (không có thì để trống). */
export function defaultSchedule(order: Wf02Order): MockBatch[] {
  const asked =
    order.lines
      .map((line) => line.requestedDeliveryDate)
      .filter((day): day is string => day !== null)
      .sort()[0] ?? null;
  return [
    {
      seq: 1,
      windowStart: asked,
      windowEnd: asked,
      lines: order.lines.map((line) => ({ orderLineId: line.lineId, cartons: line.cartons })),
    },
  ];
}

/** BR-23: mỗi SKU Σ thùng các đợt = thùng của dòng đơn; cửa sổ đủ hai ngày; đợt sau không bắt đầu sớm hơn đợt trước. */
export function schedule(order: Wf02Order, entries: readonly BatchEntry[]): MockBatch[] {
  if (entries.length === 0 || entries.length > MAX_ROWS)
    invalidSchedule([rule("deliverySchedule", `Lịch giao có từ 1 đến ${MAX_ROWS} đợt giao.`)]);
  const errors: MockFieldError[] = [];
  const planned = new Map<string, number>();
  const batches: MockBatch[] = [];
  let previousStart: string | null = null;
  entries.forEach((entry, i) => {
    const field = `deliverySchedule[${i}]`;
    const n = i + 1;
    if (entry === null) {
      errors.push({ field, message: "Thiếu một đợt giao.", code: "NotNull" });
      return;
    }
    if ((entry.windowStart === null) !== (entry.windowEnd === null))
      errors.push(
        rule(
          `${field}.windowEnd`,
          `Đợt giao ${n}: cửa sổ giao cần đủ cả ngày bắt đầu và ngày kết thúc, hoặc để trống cả hai.`,
        ),
      );
    else if (
      entry.windowStart !== null &&
      entry.windowEnd !== null &&
      entry.windowStart > entry.windowEnd
    )
      errors.push(
        rule(`${field}.windowEnd`, `Đợt giao ${n}: ngày kết thúc không được trước ngày bắt đầu.`),
      );
    if (entry.windowStart !== null && previousStart !== null && entry.windowStart < previousStart)
      errors.push(
        rule(`${field}.windowStart`, `Đợt giao ${n} không được bắt đầu sớm hơn đợt trước.`),
      );
    if (entry.windowStart !== null) previousStart = entry.windowStart;
    if (entry.lines.length === 0)
      errors.push(rule(`${field}.lines`, `Đợt giao ${n} phải có ít nhất một thùng.`));
    const seen = new Set<string>();
    const lines: MockBatch["lines"] = [];
    entry.lines.forEach((line, j) => {
      const lineField = `${field}.lines[${j}]`;
      const id = line?.orderLineId ?? null;
      if (id === null || !order.lines.some((l) => l.lineId === id)) {
        errors.push(
          rule(
            `${lineField}.orderLineId`,
            `Đợt giao ${n}: có dòng không thuộc đơn ${order.orderNumber}.`,
          ),
        );
        return;
      }
      if (seen.has(id)) {
        errors.push(
          rule(`${lineField}.orderLineId`, `Đợt giao ${n}: mỗi dòng đơn chỉ xuất hiện một lần.`),
        );
        return;
      }
      seen.add(id);
      const cartons = line?.cartons ?? null;
      if (cartons === null || !Number.isInteger(cartons) || cartons < 1) {
        errors.push(
          rule(`${lineField}.cartons`, `Đợt giao ${n}: số thùng là số nguyên, ít nhất 1.`),
        );
        return;
      }
      planned.set(id, (planned.get(id) ?? 0) + cartons);
      lines.push({ orderLineId: id, cartons });
    });
    if (errors.length === 0)
      batches.push({ seq: n, windowStart: entry.windowStart, windowEnd: entry.windowEnd, lines });
  });
  for (const line of order.lines) {
    const over = planned.get(line.lineId) ?? 0;
    if (over !== line.cartons)
      errors.push(
        rule(
          "deliverySchedule",
          `${line.sku}: tổng số thùng qua các đợt giao là ${viNumber(over)}, khác số thùng của dòng đơn là ${viNumber(line.cartons)}.`,
        ),
      );
  }
  if (errors.length > 0) invalidSchedule(errors);
  return batches;
}

/** BR-23: gửi hợp đồng khi mọi đợt có cửa sổ giao, không ở quá khứ. */
export function requireWindows(batches: readonly MockBatch[], today: string): void {
  const errors: MockFieldError[] = [];
  for (const batch of batches) {
    const field = `deliverySchedule[${batch.seq - 1}].windowStart`;
    if (batch.windowStart === null || batch.windowEnd === null)
      errors.push(rule(field, `Đợt giao ${batch.seq}: nhập cửa sổ giao trước khi gửi hợp đồng.`));
    else if (batch.windowStart < today)
      errors.push(
        rule(field, `Đợt giao ${batch.seq}: cửa sổ giao không được ở quá khứ khi gửi hợp đồng.`),
      );
  }
  if (errors.length > 0) invalidSchedule(errors);
}

const planRule = (field: string, message: string): MockFieldError => ({
  field,
  message,
  code: "BR-13",
});

/** Phần trăm hợp lệ: > 0, ≤ 100, tối đa 2 số lẻ. */
const validPercent = (p: number) =>
  p > 0 && p <= 100 && Math.abs(Math.round(p * 100) - p * 100) < 1e-9;

/**
 * BR-13, 15 BR-18: lịch thanh toán. % quy ra tiền (HALF_UP); lệch tổng chỉ do làm tròn các % (≤ số đợt % / 2 đồng) thì
 * đợt cuối nhận phần lệch; Σ đợt phải = tổng đơn có thuế. AFTER_DELIVERY cần hạn mức kế toán duyệt (15 BR-12).
 */
export function plan(
  order: Wf02Order,
  batchCount: number,
  entries: readonly InstallmentEntry[],
  creditApproved: boolean,
  creditTermDays: number | null,
): MockPlannedInstallment[] {
  const total = orderTotal(order);
  if (entries.length === 0 || entries.length > MAX_ROWS)
    invalidPlan([planRule("paymentPlan", `Lịch thanh toán có từ 1 đến ${MAX_ROWS} đợt.`)]);
  const errors: MockFieldError[] = [];
  const amounts: (number | null)[] = [];
  let shares = 0;
  let afterDelivery = false;
  entries.forEach((entry, i) => {
    const field = `paymentPlan[${i}]`;
    const n = i + 1;
    if (entry === null) {
      errors.push({ field, message: "Thiếu một đợt thanh toán.", code: "NotNull" });
      amounts.push(null);
      return;
    }
    if (!entry.name || entry.name.trim().length > 100)
      errors.push(planRule(`${field}.name`, `Đợt thanh toán ${n}: cần tên, tối đa 100 ký tự.`));
    if (entry.milestone === null)
      errors.push(
        planRule(
          `${field}.milestone`,
          `Đợt thanh toán ${n}: mốc phải là khi ký (ON_SIGNING), trước khi giao (BEFORE_DELIVERY) hoặc sau khi giao (AFTER_DELIVERY).`,
        ),
      );
    afterDelivery ||= entry.milestone === "AFTER_DELIVERY";
    if (entry.deliveryBatchSeq !== null) {
      if (entry.milestone === "ON_SIGNING")
        errors.push(
          planRule(
            `${field}.deliveryBatchSeq`,
            `Đợt thanh toán ${n}: đợt thanh toán khi ký không gắn với đợt giao nào.`,
          ),
        );
      else if (entry.deliveryBatchSeq < 1 || entry.deliveryBatchSeq > batchCount)
        errors.push(
          planRule(
            `${field}.deliveryBatchSeq`,
            `Đợt thanh toán ${n}: đợt giao gắn kèm phải nằm trong lịch giao, từ 1 đến ${batchCount}.`,
          ),
        );
    }
    if (entry.dueDays !== null) {
      if (entry.milestone === "BEFORE_DELIVERY")
        errors.push(
          planRule(
            `${field}.dueDays`,
            `Đợt thanh toán ${n}: đợt trước khi giao không có số ngày đến hạn; đợt này chặn bàn giao cho tới khi trả đủ.`,
          ),
        );
      else if (entry.dueDays < 0 || entry.dueDays > 365)
        errors.push(
          planRule(`${field}.dueDays`, `Đợt thanh toán ${n}: số ngày đến hạn từ 0 đến 365.`),
        );
    }
    if ((entry.amount === null) === (entry.percent === null)) {
      errors.push(
        planRule(
          field,
          `Đợt thanh toán ${n}: nhập số tiền hoặc phần trăm tổng tiền, chỉ một trong hai.`,
        ),
      );
      amounts.push(null);
    } else if (entry.amount !== null) {
      if (entry.amount <= 0 || !Number.isInteger(entry.amount)) {
        errors.push(
          planRule(`${field}.amount`, `Đợt thanh toán ${n}: số tiền là số đồng nguyên, lớn hơn 0.`),
        );
        amounts.push(null);
      } else amounts.push(entry.amount);
    } else if (entry.percent !== null && !validPercent(entry.percent)) {
      errors.push(
        planRule(
          `${field}.percent`,
          `Đợt thanh toán ${n}: phần trăm lớn hơn 0, tối đa 100, tối đa hai chữ số thập phân.`,
        ),
      );
      amounts.push(null);
    } else {
      shares += 1;
      amounts.push(percentOf(total, entry.percent ?? 0));
    }
  });
  if (afterDelivery && !creditApproved)
    refuse(
      409,
      "PAYMENT_SCHEDULE_NEEDS_CREDIT",
      `Đơn ${order.orderNumber}: đợt thanh toán sau giao là công nợ, nhưng kế toán chưa duyệt hạn mức công nợ cho khách này.`,
    );
  const sum = () => amounts.reduce<number>((acc, a) => acc + (a ?? 0), 0);
  if (errors.length === 0 && shares > 0) {
    const off = total - sum();
    const last = amounts.length - 1;
    if (off !== 0 && Math.abs(off) <= Math.floor(shares / 2)) {
      amounts[last] = (amounts[last] ?? 0) + off;
      if ((amounts[last] ?? 0) <= 0)
        errors.push(
          planRule(
            `paymentPlan[${last}]`,
            `Đợt thanh toán ${last + 1}: sau khi làm tròn, đợt cuối không còn số tiền nào.`,
          ),
        );
    }
  }
  if (errors.length === 0 && sum() !== total)
    errors.push(
      planRule(
        "paymentPlan",
        `Tổng các đợt thanh toán là ${viNumber(sum())}, khác tổng tiền đơn (có thuế) là ${viNumber(total)}.`,
      ),
    );
  if (errors.length > 0) invalidPlan(errors);
  return entries.map((entry, i) => {
    const milestone = entry?.milestone ?? "ON_SIGNING";
    const dueDays =
      milestone === "BEFORE_DELIVERY"
        ? null
        : (entry?.dueDays ?? (milestone === "AFTER_DELIVERY" ? creditTermDays : null) ?? 0);
    return {
      seq: i + 1,
      name: entry?.name?.trim() ?? "",
      milestone,
      percent: entry?.percent ?? null,
      amount: amounts[i] ?? 0,
      dueDays,
      deliveryBatchSeq: entry?.deliveryBatchSeq ?? null,
    };
  });
}

/** Giá trị hàng có thuế của từng đợt giao (BR-13) — phí không thuộc đợt nào. */
export function batchValues(order: Wf02Order, batches: readonly MockBatch[]): Map<number, number> {
  const values = new Map<number, number>();
  const before = new Map<string, number>();
  for (const batch of batches) {
    let value = 0;
    for (const line of order.lines) {
      const cartons = batch.lines.find((l) => l.orderLineId === line.lineId)?.cartons ?? 0;
      if (cartons === 0) continue;
      const from = before.get(line.lineId) ?? 0;
      const to = Math.min(line.quantity, from + cartons * line.unitsPerCarton);
      value += grossOf(line, to) - grossOf(line, from);
      before.set(line.lineId, to);
    }
    values.set(batch.seq, value);
  }
  return values;
}

/** Đợt đã lưu → lại thành đợt nhập: giữ % nếu nhập theo %, không thì giữ số tiền. */
export const entryOf = (i: MockPlannedInstallment): InstallmentEntry => ({
  name: i.name,
  milestone: i.milestone,
  amount: i.percent === null ? i.amount : null,
  percent: i.percent,
  dueDays: i.dueDays,
  deliveryBatchSeq: i.deliveryBatchSeq,
});

/**
 * BE `ContractTerms.suggestTied` (DS-02b): đợt gắn đợt giao nhận phần còn lại của tổng (sau các đợt không gắn) theo tỉ lệ
 * giá trị hàng của đợt giao; đợt gắn cuối nhận phần lẻ. Không đợt nào gắn → giữ nguyên.
 */
export function suggestTied(
  order: Wf02Order,
  batches: readonly MockBatch[],
  entries: readonly InstallmentEntry[],
): InstallmentEntry[] {
  const total = orderTotal(order);
  const values = batchValues(order, batches);
  const tied: number[] = [];
  const perBatch = new Map<number, number>();
  let untied = 0;
  entries.forEach((entry, i) => {
    if (entry === null) return;
    if (entry.milestone !== "ON_SIGNING" && entry.deliveryBatchSeq !== null) {
      if (!values.has(entry.deliveryBatchSeq))
        invalidPlan([
          planRule(
            `paymentPlan[${i}].deliveryBatchSeq`,
            `Đợt thanh toán ${i + 1}: đợt giao gắn kèm phải nằm trong lịch giao, từ 1 đến ${batches.length}.`,
          ),
        ]);
      tied.push(i);
      perBatch.set(entry.deliveryBatchSeq, (perBatch.get(entry.deliveryBatchSeq) ?? 0) + 1);
    } else if (entry.amount !== null) untied += entry.amount;
    else if (entry.percent !== null) untied += percentOf(total, entry.percent);
  });
  if (tied.length === 0) return [...entries];
  const shareOf = (i: number) => {
    const seq = entries[i]?.deliveryBatchSeq ?? 0;
    return (values.get(seq) ?? 0) / (perBatch.get(seq) ?? 1);
  };
  const rest = total - untied;
  const worth = tied.reduce((sum, i) => sum + shareOf(i), 0);
  if (rest <= 0 || worth <= 0)
    invalidPlan([
      planRule(
        "paymentPlan",
        `Các đợt không gắn đợt giao đã chiếm ${viNumber(untied)} trên tổng ${viNumber(total)}: không còn gì cho các đợt gắn với đợt giao.`,
      ),
    ]);
  const suggested = [...entries];
  let given = 0;
  tied.forEach((i, k) => {
    const entry = entries[i];
    if (!entry) return;
    const share = shareOf(i);
    const amount =
      k === tied.length - 1
        ? rest - given
        : Number.isInteger(share) && Number.isInteger(worth)
          ? mulDivHalfUp(rest, share, worth)
          : Math.round((rest * share) / worth);
    if (k < tied.length - 1) given += amount;
    suggested[i] = { ...entry, amount, percent: null };
  });
  return suggested;
}
