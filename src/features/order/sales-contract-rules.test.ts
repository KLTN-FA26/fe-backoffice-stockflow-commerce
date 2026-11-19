import { describe, expect, it } from "vitest";

import { SALES_CONTRACT_PERMISSIONS } from "@/constants";

import { contractDraft } from "./__fixtures__/contract";
import { contractFieldPath } from "./components/contract/useContractEditor";
import { toContractDraftBody, toContractForm, contractFormSchema } from "./sales-contract-form";
import {
  CONTRACT_TRANSITIONS,
  allowedContractActions,
  cartonGaps,
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
