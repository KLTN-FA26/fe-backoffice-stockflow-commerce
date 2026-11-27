import { describe, expect, it } from "vitest";

import { CREDIT_REQUEST_PERMISSIONS } from "@/constants/credit-request";

import { allowedCreditRequestActions, CREDIT_REQUEST_TRANSITIONS } from "../lifecycle";
import { creditRequestDtoSchema } from "../schemas";
import { pendingApproval, submitted } from "./fixtures";

const P = CREDIT_REQUEST_PERMISSIONS;
const role =
  (...codes: string[]) =>
  (code: string) =>
    codes.includes(code);
const sales = role(P.viewPage, P.read, P.create, P.update);
const accountant = role(P.viewPage, P.read, P.approve);
const readOnly = role(P.viewPage, P.read);
const ACCOUNTANT_ID = "acc-1";
const parse = (raw: unknown) => creditRequestDtoSchema.parse(raw);

describe("CREDIT_REQUEST_TRANSITIONS (15 §4.3 bước 9–11a)", () => {
  it("SUBMITTED → PENDING_APPROVAL / WITHDRAWN; PENDING_APPROVAL → APPROVED / REJECTED / WITHDRAWN", () => {
    expect(CREDIT_REQUEST_TRANSITIONS.SUBMITTED).toEqual(["PENDING_APPROVAL", "WITHDRAWN"]);
    expect(CREDIT_REQUEST_TRANSITIONS.PENDING_APPROVAL).toEqual([
      "APPROVED",
      "REJECTED",
      "WITHDRAWN",
    ]);
  });
  it("APPROVED / REJECTED / WITHDRAWN / UNKNOWN là trạng thái cuối", () => {
    for (const s of ["APPROVED", "REJECTED", "WITHDRAWN", "UNKNOWN"] as const)
      expect(CREDIT_REQUEST_TRANSITIONS[s]).toEqual([]);
  });
  it("trạng thái lạ từ BE → UNKNOWN, không nút nào", () => {
    const request = parse({ ...submitted, status: "ARCHIVED" });
    expect(request.status).toBe("UNKNOWN");
    expect(allowedCreditRequestActions(request, sales, "u")).toEqual([]);
  });
});

describe("allowedCreditRequestActions — 3 vai", () => {
  it("Sale: SUBMITTED → Ghi ý kiến + tải giấy tờ; PENDING_APPROVAL → không duyệt được", () => {
    expect(allowedCreditRequestActions(parse(submitted), sales, "sale-1")).toEqual([
      "recommend",
      "attach",
    ]);
    expect(allowedCreditRequestActions(parse(pendingApproval), sales, "sale-1")).toEqual([
      "attach",
    ]);
  });
  it("Sale đã gửi thay khách → có Rút đề nghị", () => {
    const filed = parse({ ...pendingApproval, source: "SALES", submittedBy: "sale-1" });
    expect(allowedCreditRequestActions(filed, sales, "sale-1")).toContain("withdraw");
  });
  it("Kế toán: PENDING_APPROVAL → Duyệt / Từ chối; SUBMITTED → chưa", () => {
    expect(allowedCreditRequestActions(parse(pendingApproval), accountant, ACCOUNTANT_ID)).toEqual([
      "approve",
      "reject",
    ]);
    expect(allowedCreditRequestActions(parse(submitted), accountant, ACCOUNTANT_ID)).toEqual([]);
  });
  it("BE withdrawByStaff: đề nghị khách tự gửi (PORTAL) thì Sale không rút được", () => {
    const portal = parse({ ...pendingApproval, source: "PORTAL", submittedBy: "sale-1" });
    expect(allowedCreditRequestActions(portal, sales, "sale-1")).not.toContain("withdraw");
  });
  it("BE CREDIT_REQUEST_SELF_DECISION: người ghi ý kiến không tự quyết", () => {
    const own = parse({ ...pendingApproval, recommendedBy: ACCOUNTANT_ID });
    expect(allowedCreditRequestActions(own, accountant, ACCOUNTANT_ID)).toEqual([]);
  });
  it("chỉ READ / đề nghị đã quyết → không nút mutating", () => {
    expect(allowedCreditRequestActions(parse(pendingApproval), readOnly, "x")).toEqual([]);
    const approved = parse({ ...pendingApproval, status: "APPROVED" });
    expect(allowedCreditRequestActions(approved, sales, "sale-1")).toEqual([]);
    expect(allowedCreditRequestActions(approved, accountant, ACCOUNTANT_ID)).toEqual([]);
  });
});
