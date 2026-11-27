/**
 * Mock của Sale phụ trách khách (BO-2): người phụ trách theo quy tắc điền dữ liệu của BE, khách có thể trùng, việc đang
 * phụ trách của một Sale — qua axios thật + lớp api của từng màn, để màn mock hiện đúng. Một store chung: cùng một khách
 * có cùng một người phụ trách ở thẻ khách, danh sách và các màn chế độ chặt.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { listCustomers } from "@/features/customer/api";
import { findCustomerDuplicates } from "@/features/customer/duplicates";
import { fetchHandoverSummary } from "@/features/user-management/handover-summary";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";
import { getSalesOwnerDetail } from "@/lib/references/sales-owner";
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
  it("a WF-02 seed customer is owned by the Sales who sent its documents (backfill rule)", async () => {
    expect(await fetchSalesOwner(CHAT_SEED.demoCustomer)).toMatchObject({
      salesOwnerId: CHAT_SEED.sales,
      state: "ASSIGNED",
      active: true,
    });
  });

  it("one owner per customer: the strict-mode read, the owner card and the list row agree", async () => {
    const page = await listCustomers({ page: 0, size: 50 });
    for (const id of [mockCustomerId(1), mockCustomerId(9), mockCustomerId(11)]) {
      const row = page.items.find((c) => c.customerId === id);
      const access = await fetchSalesOwner(id);
      const card = await getSalesOwnerDetail(id);
      expect(access.salesOwnerId ?? null).toBe(row?.salesOwnerId ?? null);
      expect(access.state).toBe(row?.salesOwnerState);
      expect(card?.salesOwnerId ?? null).toBe(access.salesOwnerId ?? null);
    }
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
    const owned = await listCustomers({
      page: 0,
      size: 50,
      salesOwnerId: CHAT_SEED.sales,
      salesOwnerState: "ASSIGNED",
    });
    // Hai khách seed WF-02 (không nằm trong `/customers`) + khách của danh sách
    expect(summary.customers).toBe(owned.totalElements + 2);
    expect(summary.openConversations).not.toBeNull();
  });
});
