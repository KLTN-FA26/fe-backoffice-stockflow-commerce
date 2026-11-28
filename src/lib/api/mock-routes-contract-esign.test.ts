import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import { getSalesContract } from "@/features/order/sales-contract-api";
import {
  getContractRevisions,
  getContractSignatures,
  getSalesContractSummary,
  listSalesContracts,
  updateContractEsign,
} from "@/features/order/sales-contract-esign-api";

import { activateMockAdapter } from "./mock-adapter";
import { contractEsignState } from "./mock-contract-esign";
import { WF02_SEED_ORDERS, resetWf02OrderMockStore } from "./mock-contract-orders";
import { liveContractOf, resetContractMockStore } from "./mock-contract-store";
import { resetPaymentMockStore } from "./mock-payment-store";

const originalAdapter = api.defaults.adapter;
const DEMO = WF02_SEED_ORDERS.demo.orderId;
const TSM = WF02_SEED_ORDERS.tsm.orderId;

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(() => {
  resetContractMockStore();
  resetWf02OrderMockStore();
  resetPaymentMockStore();
  useAuthStore.setState({
    user: {
      userId: "USER-ADMIN-01",
      fullName: "T",
      email: "t@t.vn",
      username: "t",
      roles: [],
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    status: "authenticated",
    isAuthenticated: true,
  });
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("new contract mock endpoints", () => {
  it("lists existing seeded contracts, filters on server, and returns derived counts", async () => {
    const page = await listSalesContracts({ page: 0, size: 1 });
    expect(page?.items).toHaveLength(1);
    expect(page?.hasNext).toBe(true);
    const filtered = await listSalesContracts({ page: 0, size: 15, status: ["SENT"], q: "900001" });
    expect(filtered?.items.map((row) => row.orderId)).toEqual([DEMO]);
    expect(await getSalesContractSummary()).toMatchObject({
      byStatus: { DRAFT: 1, SENT: 1 },
      awaitingCompanySignature: 0,
      termsReviewPending: 0,
    });
    expect(await getContractRevisions(DEMO)).toMatchObject([
      { revision: 1, documentAvailable: true },
    ]);
  });
  it("reviews, rejects with a note, resubmits, approves and withdraws without changing order status", async () => {
    const contract = liveContractOf(TSM);
    if (!contract) throw new Error("Missing seeded contract");
    contractEsignState(contract).specialTerms = "Điều khoản riêng";
    await updateContractEsign({ orderId: TSM, version: contract.version, action: "review" });
    expect((await getSalesContract(TSM))?.termsReview).toBe("PENDING");
    await expect(
      updateContractEsign({ orderId: TSM, version: contract.version, action: "reject", note: "" }),
    ).rejects.toMatchObject({ status: 400 });
    await updateContractEsign({
      orderId: TSM,
      version: contract.version,
      action: "reject",
      note: "Cần sửa",
    });
    expect((await getSalesContract(TSM))?.termsReviewDetail?.note).toBe("Cần sửa");
    await updateContractEsign({ orderId: TSM, version: contract.version, action: "review" });
    await updateContractEsign({ orderId: TSM, version: contract.version, action: "approve" });
    expect((await getSalesContract(TSM))?.termsReview).toBe("APPROVED");
  });
  it("refuses standard terms review and stale versions", async () => {
    const contract = liveContractOf(TSM);
    if (!contract) throw new Error("Missing seeded contract");
    await expect(
      updateContractEsign({ orderId: TSM, version: contract.version, action: "review" }),
    ).rejects.toMatchObject({ code: "CONTRACT_TERMS_REVIEW_NOT_NEEDED" });
    await expect(
      updateContractEsign({ orderId: TSM, version: contract.version + 1, action: "review" }),
    ).rejects.toMatchObject({ code: "OPTIMISTIC_LOCK" });
  });
  it("company signing transitions the existing customer-signed contract and exposes the test certificate", async () => {
    const contract = liveContractOf(DEMO);
    if (!contract) throw new Error("Missing seeded contract");
    contract.status = "CUSTOMER_SIGNED";
    await updateContractEsign({
      orderId: DEMO,
      version: contract.version,
      action: "companySign",
      signerName: contract.seller.representative ?? "",
    });
    expect((await getSalesContract(DEMO))?.status).toBe("SIGNED");
    expect(await getContractSignatures(DEMO)).toMatchObject({
      company: { method: "SYSTEM", testCertificate: true },
    });
  });
  it("refuses a scan for the company digital-signature upload", async () => {
    const contract = liveContractOf(DEMO);
    if (!contract) throw new Error("Missing seeded contract");
    contract.status = "CUSTOMER_SIGNED";
    await expect(
      updateContractEsign({
        orderId: DEMO,
        version: contract.version,
        action: "upload",
        file: new File(["%PDF-1.4 scan"], "scan.pdf", { type: "application/pdf" }),
      }),
    ).rejects.toMatchObject({
      code: "CONTRACT_SIGNED_FILE_REJECTED",
      details: { reason: "NO_DIGITAL_SIGNATURE" },
    });
    expect(contract.status).toBe("CUSTOMER_SIGNED");
  });
});
