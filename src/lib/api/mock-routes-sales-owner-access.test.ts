/**
 * Mock của Sale phụ trách khách (BO-2): người phụ trách theo quy tắc điền dữ liệu của BE, khách có thể trùng, việc đang
 * phụ trách của một Sale — qua axios thật + lớp api của từng màn, để màn mock hiện đúng.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { findCustomerDuplicates } from "@/features/customer/duplicates";
import { fetchHandoverSummary } from "@/features/user-management/handover-summary";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";
import { fetchSalesOwner } from "@/lib/references/sales-owner-queries";

import { CHAT_SEED } from "./mock-chat-seed";
import { activateMockAdapter } from "./mock-adapter";
import { allMockCustomers, mockCustomerId } from "./mock-customer-store";

const originalAdapter = api.defaults.adapter;

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
  useAuthStore.setState({
    user: {
      userId: "USER-SALE-01",
      fullName: "T",
      email: "t@t.vn",
      roles: [],
      username: "t",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    status: "authenticated",
  });
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("mock sales owner (HOP-DONG-API BE-A)", () => {
  it("a WF-02 seed customer is owned by the Sales who sent its documents; others are unassigned", async () => {
    expect(await fetchSalesOwner(CHAT_SEED.demoCustomer)).toMatchObject({
      salesOwnerId: CHAT_SEED.sales,
      state: "ASSIGNED",
      active: true,
    });
    expect(await fetchSalesOwner(mockCustomerId(1))).toMatchObject({ state: "UNASSIGNED" });
  });

  it("BR-S14: duplicates match on email and name, never on nothing", async () => {
    const customer = allMockCustomers()[0];
    const byEmail = await findCustomerDuplicates({ email: customer.email });
    expect(byEmail[0]).toMatchObject({ customerId: customer.customerId, matchedOn: ["email"] });
    expect(await findCustomerDuplicates({ name: "khong-co-ten-nay-xyz" })).toEqual([]);
  });

  it("BR-S08: handover summary is served by the mock, not the BFF", async () => {
    const summary = await fetchHandoverSummary(
      CHAT_SEED.sales,
      false,
      new AbortController().signal,
    );
    expect(summary.customers).toBe(2);
    expect(summary.openConversations).not.toBeNull();
  });
});
