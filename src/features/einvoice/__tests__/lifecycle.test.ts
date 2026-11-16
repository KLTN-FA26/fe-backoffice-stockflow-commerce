import { describe, expect, it } from "vitest";

import { EINVOICE_PERMISSIONS, EINVOICE_STATUSES } from "@/constants/einvoice";

import type { PermissionCode } from "@/lib/auth";

import { allowedEInvoiceActions, EINVOICE_TRANSITIONS, isTerminalEInvoice } from "../lifecycle";
import {
  einvoiceStatusLabel,
  invoiceReference,
  needsAttention,
  warningMessages,
} from "../selectors";

const P = EINVOICE_PERMISSIONS;
const has =
  (codes: readonly string[]) =>
  (code: PermissionCode): boolean =>
    codes.includes(code);
const ACCOUNTANT = has(Object.values(P));
const SALES_MANAGER = has([P.viewPage, P.read]);
const NOBODY = has([]);

const gate = (over: Partial<Parameters<typeof allowedEInvoiceActions>[0]> = {}) => ({
  status: "DRAFT" as const,
  type: "ORIGINAL" as const,
  warnings: [] as string[],
  agreementRequired: false,
  adjusted: false,
  hasFiles: false,
  ...over,
});

describe("EINVOICE_TRANSITIONS (docs 21 §5.1; BE EInvoiceStatus.next)", () => {
  it("covers every BE status; VOIDED_DRAFT and REPLACED are final", () => {
    expect(Object.keys(EINVOICE_TRANSITIONS).sort()).toEqual([...EINVOICE_STATUSES].sort());
    expect(EINVOICE_TRANSITIONS.VOIDED_DRAFT).toEqual([]);
    expect(EINVOICE_TRANSITIONS.REPLACED).toEqual([]);
    expect(isTerminalEInvoice("REPLACED")).toBe(true);
    expect(isTerminalEInvoice("ISSUED")).toBe(false);
  });

  it("BR-03: an issued invoice is never edited or voided — only replaced", () => {
    expect(EINVOICE_TRANSITIONS.ISSUED).toEqual(["REPLACED"]);
  });

  it("a rejected invoice returns to a draft before it is issued again (§4.2 step 7)", () => {
    expect(EINVOICE_TRANSITIONS.REJECTED).toEqual(["DRAFT"]);
  });
});

describe("allowedEInvoiceActions — three roles (docs 21 BR-02)", () => {
  it("accountant on a draft: revise, refresh buyer, issue, void", () => {
    expect(allowedEInvoiceActions(gate(), ACCOUNTANT)).toEqual([
      "revise",
      "refreshBuyer",
      "issue",
      "void",
    ]);
  });

  it("an error correction draft asks for the agreement first", () => {
    expect(allowedEInvoiceActions(gate({ agreementRequired: true }), ACCOUNTANT)).toContain(
      "attachAgreement",
    );
  });

  it("sales manager only reads: no mutating action on any status", () => {
    for (const status of EINVOICE_STATUSES) {
      const actions = allowedEInvoiceActions(gate({ status, hasFiles: true }), SALES_MANAGER);
      expect(actions.filter((a) => a !== "downloadFiles")).toEqual([]);
    }
  });

  it("without permissions nothing at all", () => {
    expect(allowedEInvoiceActions(gate({ status: "ISSUED", hasFiles: true }), NOBODY)).toEqual([]);
  });

  it("BR-05: a submitting invoice is only looked up; resubmitted only when unknown to the provider", () => {
    expect(allowedEInvoiceActions(gate({ status: "SUBMITTING" }), ACCOUNTANT)).toEqual([
      "reconcile",
    ]);
    expect(
      allowedEInvoiceActions(
        gate({ status: "SUBMITTING", warnings: ["UNKNOWN_TO_PROVIDER"] }),
        ACCOUNTANT,
      ),
    ).toEqual(["reconcile", "resubmit"]);
  });

  it("BR-08: an adjusted invoice may be adjusted again but not replaced", () => {
    const issued = allowedEInvoiceActions(gate({ status: "ISSUED", hasFiles: true }), ACCOUNTANT);
    expect(issued).toEqual(["downloadFiles", "adjust", "replace", "notifyError"]);
    const adjusted = allowedEInvoiceActions(
      gate({ status: "ISSUED", hasFiles: true, adjusted: true }),
      ACCOUNTANT,
    );
    expect(adjusted).toContain("adjust");
    expect(adjusted).not.toContain("replace");
  });

  it("final statuses offer no mutating action", () => {
    expect(allowedEInvoiceActions(gate({ status: "VOIDED_DRAFT" }), ACCOUNTANT)).toEqual([]);
    expect(
      allowedEInvoiceActions(gate({ status: "REPLACED", hasFiles: true }), ACCOUNTANT),
    ).toEqual(["downloadFiles"]);
  });
});

describe("selectors", () => {
  it("labels statuses in Vietnamese", () => {
    expect(einvoiceStatusLabel("ISSUED")).toBe("Đã phát hành");
    expect(einvoiceStatusLabel("VOIDED_DRAFT")).toBe("Đã huỷ nháp");
  });

  it("references an issued invoice by template, symbol and number; a draft by its code", () => {
    expect(
      invoiceReference({ templateCode: "1", symbol: "C26TAA", invoiceNumber: 42, code: "HDDT-1" }),
    ).toBe("1C26TAA-0000042");
    expect(
      invoiceReference({ templateCode: null, symbol: null, invoiceNumber: null, code: "HDDT-1" }),
    ).toBe("HDDT-1");
  });

  it("explains each warning; an unknown one gets a generic line", () => {
    const lines = warningMessages({
      warnings: ["BUYER_PROFILE_INCOMPLETE", "EARLIER_INVOICE_PENDING", "SOMETHING_NEW"],
      earlierPendingInvoice: "HDDT-0007",
    });
    expect(lines[0]).toContain("BR-06");
    expect(lines[1]).toContain("HDDT-0007");
    expect(lines[2]).toContain("cảnh báo mới");
  });

  it("needs the accountant: drafts, rejected, overdue or unknown to the provider", () => {
    const row = { status: "ISSUED" as const, warnings: [] as string[], overdue: false };
    expect(needsAttention(row)).toBe(false);
    expect(needsAttention({ ...row, status: "DRAFT" })).toBe(true);
    expect(
      needsAttention({ ...row, status: "SUBMITTING", warnings: ["UNKNOWN_TO_PROVIDER"] }),
    ).toBe(true);
  });
});
