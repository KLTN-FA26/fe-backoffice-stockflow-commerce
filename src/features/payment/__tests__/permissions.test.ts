import { describe, expect, it } from "vitest";

import { EINVOICE_ROUTES } from "@/constants/einvoice";
import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_ROUTES } from "@/constants/payment";
import { mockGrantsOf } from "@/lib/api/mock-user-grants";
import { NAV_GROUPS, visibleNavGroups } from "@/components/backoffice/BackofficeShell";

import type { NavItem } from "@/components/backoffice/BackofficeShell";

/** Quyền thanh toán của một tài khoản demo — lọc theo resource `payment-*`. */
const paymentCodes = (userId: string) =>
  [...mockGrantsOf(userId)].filter((code) => code.startsWith("payment-")).sort();

describe("payment grants of the demo accounts match the BE seed (V20261108002400, V20261108003000)", () => {
  it("accountant: view installments; record + void receipts; record + void refunds", () => {
    expect(paymentCodes("USER-ACC-01")).toEqual(
      [
        "payment-installments:READ",
        "payment-installments:VIEW_PAGE",
        "payment-receipts:CREATE",
        "payment-receipts:READ",
        "payment-receipts:UPDATE",
        "payment-receipts:VIEW_PAGE",
        "payment-refunds:CREATE",
        "payment-refunds:READ",
        "payment-refunds:UPDATE",
        "payment-refunds:VIEW_PAGE",
      ].sort(),
    );
  });

  it("sales: installments and refunds read-only, no receipts", () => {
    for (const id of ["USER-SALE-01", "USER-SALE-02", "USER-SALE-03"])
      expect(paymentCodes(id)).toEqual(
        [
          "payment-installments:READ",
          "payment-installments:VIEW_PAGE",
          "payment-refunds:READ",
          "payment-refunds:VIEW_PAGE",
        ].sort(),
      );
  });

  it("warehouse, procurement, QC and planner accounts get nothing", () => {
    for (const id of ["USER-WH-01", "USER-PROC-01", "USER-QC-01", "USER-PLAN-01"])
      expect(paymentCodes(id)).toEqual([]);
  });
});

describe("sidebar group 'Thanh toán'", () => {
  const visibleFor = (userId: string) => {
    const grants = mockGrantsOf(userId);
    const canSee = (item: NavItem) => !item.permission || grants.has(item.permission);
    return visibleNavGroups(canSee).find((group) => group.title === PAYMENT_LABELS.navGroup);
  };

  it("lists installments, receipts, refunds and e-invoices for the accountant (docs 15, 21)", () => {
    expect(visibleFor("USER-ACC-01")?.items.map((item) => item.href)).toEqual([
      PAYMENT_ROUTES.installments.list,
      PAYMENT_ROUTES.receipts.list,
      PAYMENT_ROUTES.refunds.list,
      EINVOICE_ROUTES.list,
      // Kế toán đọc cấu hình hoá đơn (seed V20261120000300: einvoice-settings READ)
      EINVOICE_ROUTES.settings,
    ]);
  });

  it("shows sales installments and refunds only; hides the group from accounts without payment permissions", () => {
    expect(visibleFor("USER-SALE-01")?.items.map((item) => item.href)).toEqual([
      PAYMENT_ROUTES.installments.list,
      PAYMENT_ROUTES.refunds.list,
    ]);
    expect(visibleFor("USER-WH-01")).toBeUndefined();
  });

  it("every item is gated by a VIEW_PAGE permission code (never a role name)", () => {
    const group = NAV_GROUPS.find((g) => g.title === PAYMENT_LABELS.navGroup);
    // BE `einvoice-settings` declares no VIEW_PAGE action (READ, UPDATE only): its page opens on READ
    const pageGates = group?.items.filter((item) => item.href !== EINVOICE_ROUTES.settings);
    expect(pageGates?.every((item) => item.permission?.endsWith(":VIEW_PAGE"))).toBe(true);
    const settings = group?.items.find((item) => item.href === EINVOICE_ROUTES.settings);
    expect(settings?.permission).toBe("einvoice-settings:READ");
  });
});
