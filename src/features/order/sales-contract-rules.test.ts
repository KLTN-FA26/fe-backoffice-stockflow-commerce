import { describe, expect, it } from "vitest";

import { SALES_CONTRACT_PERMISSIONS } from "@/constants";

import { contractDraft } from "./__fixtures__/contract";
import { contractFieldPath } from "./components/contract/useContractEditor";
import {
  contractFormSchema,
  toContractDraftBody,
  toContractForm,
  toInstallmentForm,
} from "./sales-contract-form";
import {
  contractFieldLabel,
  CONTRACT_TRANSITIONS,
  allowedContractActions,
  cartonGaps,
  isSignedFileTypeAllowed,
  passedBatches,
  passedBatchesText,
  planTotal,
  signOutcomeText,
} from "./sales-contract-rules";
import { salesContractDtoSchema } from "./sales-contract-schemas";

const contract = salesContractDtoSchema.parse(contractDraft);
const LINE = contract.deliverySchedule[0]?.lines[0]?.orderLineId ?? "";
const sales = () => true;
const accountant = (code: string) => code === SALES_CONTRACT_PERMISSIONS.read;
const signerOnly = (code: string) => code === SALES_CONTRACT_PERMISSIONS.approve;

describe("CONTRACT_TRANSITIONS (docs 14 §5)", () => {
  it("SIGNED → COMPLETED; COMPLETED / CANCELLED là trạng thái cuối", () => {
    expect(CONTRACT_TRANSITIONS.SIGNED).toEqual(["COMPLETED"]);
    expect(CONTRACT_TRANSITIONS.COMPLETED).toEqual([]);
    expect(CONTRACT_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe("allowedContractActions — 3 vai", () => {
  it("Sale: chưa có hợp đồng + đơn Nháp → lập; DRAFT → sửa / gửi / huỷ; SENT → ký / huỷ", () => {
    expect(allowedContractActions(null, "Draft", sales)).toEqual(["create"]);
    expect(allowedContractActions(null, "Pending Payment", sales)).toEqual([]);
    expect(allowedContractActions({ status: "DRAFT" }, "Draft", sales)).toEqual([
      "edit",
      "send",
      "cancel",
      "preview",
    ]);
    expect(allowedContractActions({ status: "SENT" }, "Pending Contract", sales)).toEqual([
      "sign",
      "cancel",
    ]);
    expect(allowedContractActions({ status: "CANCELLED" }, "Draft", sales)).toEqual(["create"]);
  });
  it("Kế toán (chỉ READ) không có nút ghi; người chỉ có APPROVE chỉ ghi nhận đã ký", () => {
    expect(allowedContractActions({ status: "DRAFT" }, "Draft", accountant)).toEqual(["preview"]);
    expect(allowedContractActions({ status: "SENT" }, "Pending Contract", signerOnly)).toEqual([
      "sign",
    ]);
  });
  it("SIGNED / COMPLETED không có nút mutating", () => {
    expect(allowedContractActions({ status: "SIGNED" }, "Confirmed", sales)).toEqual([]);
    expect(allowedContractActions({ status: "COMPLETED" }, "Completed", sales)).toEqual([]);
  });
});

describe("TC-F04-02 — đối chiếu trước khi lưu", () => {
  const form = toContractForm(contract, [LINE]);
  it("Σ thùng theo dòng: 30 + 30 = 60 khớp; 25 + 30 thiếu 5", () => {
    expect(
      cartonGaps([{ lineId: LINE, sku: "X", cartons: 60 }], form.deliverySchedule)[0]?.diff,
    ).toBe(0);
    const changed = form.deliverySchedule.map((b, i) =>
      i === 0 ? { ...b, lines: [{ orderLineId: LINE, cartons: "25" }] } : b,
    );
    expect(cartonGaps([{ lineId: LINE, sku: "X", cartons: 60 }], changed)[0]?.diff).toBe(-5);
  });
  it("Σ đợt = tổng có thuế (30% quy ra tiền)", () => {
    expect(planTotal(form.paymentPlan, contract.totals.totalAmount)).toBe(
      contract.totals.totalAmount,
    );
  });
  it("fieldErrors BE → đúng ô form (dòng đếm theo dòng đã gửi; amount/percent → ô giá trị)", () => {
    expect(contractFieldPath("deliverySchedule[1].windowStart", form)).toBe(
      "deliverySchedule.1.windowStart",
    );
    expect(contractFieldPath("deliverySchedule[0].lines[0].cartons", form)).toBe(
      "deliverySchedule.0.lines.0.cartons",
    );
    expect(contractFieldPath("paymentPlan[2].amount", form)).toBe("paymentPlan.2.value");
    expect(contractFieldPath("paymentPlan", form)).toBe("paymentPlan.root");
  });
  it("body PUT: ON_SIGNING không gắn đợt giao, BEFORE_DELIVERY không có số ngày", () => {
    const body = toContractDraftBody(contractFormSchema.parse(form));
    expect(body.paymentPlan[0]).not.toHaveProperty("deliveryBatchSeq");
    expect(body.paymentPlan[1]).not.toHaveProperty("dueDays");
    expect(body.deliverySchedule).toHaveLength(2);
  });
});

describe("TC-F04-03 — kết quả sau khi ký (3 nhánh)", () => {
  it("PENDING_PAYMENT / CONFIRMED / ON_HOLD tín dụng", () => {
    expect(signOutcomeText({ status: "Pending Payment", holdReason: null })).toMatch(
      /chờ thanh toán đợt khi ký/,
    );
    expect(signOutcomeText({ status: "Confirmed", holdReason: null })).toBe(
      "Đã ký. Đơn đã xác nhận.",
    );
    expect(signOutcomeText({ status: "On Hold", holdReason: "CREDIT" })).toMatch(
      /chờ Kế toán duyệt tín dụng/,
    );
  });
});

describe("contractFieldLabel — fieldErrors của BE theo tên đợt (WF-02 audit mục 8)", () => {
  it.each([
    ["deliverySchedule", "Lịch giao"],
    ["paymentPlan", "Lịch thanh toán"],
    ["deliverySchedule[1].windowStart", "Đợt giao 2 · Từ ngày"],
    ["deliverySchedule[0].lines[1].cartons", "Đợt giao 1 · dòng 2 · Số thùng"],
    ["paymentPlan[2].amount", "Đợt thanh toán 3 · Số tiền"],
    ["paymentPlan[0].dueDays", "Đợt thanh toán 1 · Số ngày"],
    ["paymentPlan[0]", "Đợt thanh toán 1"],
    ["freeSampleRounds", "freeSampleRounds"],
  ])("%s → %s", (field, label) => {
    expect(contractFieldLabel(field)).toBe(label);
  });
});

describe("toInstallmentForm — tên đợt mặc định tiếng Anh của BE (WF-02 audit)", () => {
  it('"On signing" của kế hoạch mặc định → "Thanh toán khi ký"; tên Sale đặt giữ nguyên', () => {
    const entry = contract.paymentPlan[0]!;
    expect(toInstallmentForm({ ...entry, name: "On signing" }).name).toBe("Thanh toán khi ký");
    expect(toInstallmentForm(entry).name).toBe(entry.name);
  });
});

describe("WF-02 mục 10 — đợt giao đã qua so với hôm nay (giờ VN)", () => {
  const schedule = (windowEnd: string | null) => ({
    deliverySchedule: [{ ...contract.deliverySchedule[0]!, seq: 1, windowEnd }],
  });
  const TODAY = "2026-11-20"; // fixed fake date

  it("windowEnd hôm qua → đã qua; hôm nay / tương lai / null → không", () => {
    expect(passedBatches(schedule("2026-11-19"), TODAY)).toEqual([
      { seq: 1, windowEnd: "2026-11-19" },
    ]);
    expect(passedBatches(schedule("2026-11-20"), TODAY)).toEqual([]);
    expect(passedBatches(schedule("2026-11-21"), TODAY)).toEqual([]);
    expect(passedBatches(schedule(null), TODAY)).toEqual([]);
  });
  it("câu cảnh báo gộp nhiều đợt, không có đợt thì không có câu", () => {
    expect(passedBatchesText([{ seq: 1 }, { seq: 2 }])).toMatch(/^Đợt giao 1, 2 đã qua/);
    expect(passedBatchesText([])).toBeNull();
  });
});

describe("WF-02 mục 29 — loại file bản ký", () => {
  it.each([
    ["a.pdf", "application/pdf", true],
    ["a.jpg", "image/jpeg", true],
    ["a.png", "image/png", true],
    ["a.docx", "", true],
    ["a.xlsx", "", true],
    ["a.webp", "image/webp", false],
    ["a.webp", "", false],
    ["a.gif", "image/gif", false],
  ])("%s (%s) → %s", (name, type, ok) => {
    expect(isSignedFileTypeAllowed({ name, type })).toBe(ok);
  });
});

describe("WF-02 N10 — đợt ON_SIGNING để trống số ngày", () => {
  const withPlan = (milestone: string, dueDays: string) => {
    const values = toContractForm(contract, [LINE]);
    values.paymentPlan = [
      { ...values.paymentPlan[0]!, milestone: milestone as "ON_SIGNING", dueDays },
    ];
    return toContractDraftBody(contractFormSchema.parse(values)).paymentPlan[0];
  };
  it("ON_SIGNING trống → 3 ngày; có số thì giữ; 0 tự nhập giữ 0; AFTER_DELIVERY trống không gửi", () => {
    expect(withPlan("ON_SIGNING", "")).toHaveProperty("dueDays", 3);
    expect(withPlan("ON_SIGNING", "5")).toHaveProperty("dueDays", 5);
    expect(withPlan("ON_SIGNING", "0")).toHaveProperty("dueDays", 0);
    expect(withPlan("AFTER_DELIVERY", "")).not.toHaveProperty("dueDays");
  });
});
