import { describe, expect, it } from "vitest";

import { CUSTOMER_API_STATUSES } from "@/constants";

import {
  CUSTOMER_TRANSITIONS,
  REASON_REQUIRED,
  allowedCustomerActions,
  canChangeCustomerStatus,
  canResendInvitation,
  canViewInvitation,
} from "../lifecycle";

import type { PermissionCode } from "@/lib/auth/me-permissions";

const has =
  (...codes: string[]) =>
  (code: PermissionCode) =>
    codes.includes(code);

describe("CUSTOMER_TRANSITIONS (BE Customer.changeStatus, docs 18 §5)", () => {
  it("covers every BE status", () => {
    expect(Object.keys(CUSTOMER_TRANSITIONS).sort()).toEqual([...CUSTOMER_API_STATUSES].sort());
  });
  it("pending activation can only be closed — nobody sets PENDING_ACTIVATION by hand", () => {
    expect(CUSTOMER_TRANSITIONS.PENDING_ACTIVATION).toEqual(["close"]);
  });
  it("closed customer can only be reopened (reason required)", () => {
    expect(CUSTOMER_TRANSITIONS.INACTIVE).toEqual(["reopen"]);
    expect(REASON_REQUIRED.has("reopen")).toBe(true);
    expect(REASON_REQUIRED.has("reactivate")).toBe(true);
  });
});

describe("customer action gating", () => {
  it("status change needs customer-status:APPROVE", () => {
    const approve = has("customer-status:APPROVE");
    expect(canChangeCustomerStatus(approve)).toBe(true);
    expect(canChangeCustomerStatus(has("customer-customers:APPROVE"))).toBe(false);
    expect(canChangeCustomerStatus(has())).toBe(false);
    expect(allowedCustomerActions("ACTIVE", false)).toEqual([]);
  });
  it("resend invitation only while pending and with CREATE", () => {
    const create = has("customer-customers:CREATE");
    expect(canResendInvitation("PENDING_ACTIVATION", create)).toBe(true);
    expect(canResendInvitation("ACTIVE", create)).toBe(false);
    expect(canResendInvitation("PENDING_ACTIVATION", has())).toBe(false);
  });
  it("invitation state requires customer READ", () => {
    expect(canViewInvitation(has("customer-customers:READ"))).toBe(true);
    expect(canViewInvitation(has())).toBe(false);
  });
});
