/**
 * Mock hồ sơ pháp lý của khách — đúng hợp đồng BE `CustomerLegalProfileController` (qua axios thật + lớp api của
 * `features/customer`): 404 khi chưa có, lần đầu `version: null`, lệch version → 409, lỗi dữ liệu 400 không kèm fieldErrors.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getLegalProfile, saveLegalProfile } from "@/features/customer/api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import { activateMockAdapter } from "./mock-adapter";
import { mockCustomerId } from "./mock-customer-store";
import { resetLegalProfileMockStore } from "./mock-legal-profile-store";
import { WF02_DEMO_CUSTOMER_ID } from "./mock-quote-seed";

import type { LegalProfileValues } from "@/features/customer/types";

const originalAdapter = api.defaults.adapter;
const NEW_CUSTOMER = mockCustomerId(1);

const values: LegalProfileValues = {
  registeredAddress: "12 Nguyễn Huệ, Quận 1",
  representativeName: "Nguyễn Văn An",
  representativeTitle: "Giám đốc",
  invoiceEmail: "KeToan@Xanh.vn",
  accountNumber: "0123 456.789",
  bankName: "Vietcombank",
  accountHolder: "Cty Bao Bì Xanh",
};

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected request to fail");
}

beforeAll(() => {
  // Giảm độ trễ ngẫu nhiên của mock adapter để không chạm hạn 5 giây khi máy bận.
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
beforeEach(resetLegalProfileMockStore);
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("GET / PUT /customers/{id}/legal-profile", () => {
  it("a seeded WF-02 customer already has a profile (version 0)", async () => {
    const profile = await getLegalProfile(WF02_DEMO_CUSTOMER_ID);
    expect(profile).toMatchObject({ companyName: "Khách hàng demo", version: 0 });
  });

  it("a customer without a profile → null; first save sends version null and bumps nothing", async () => {
    expect(await getLegalProfile(NEW_CUSTOMER)).toBeNull();
    const saved = await saveLegalProfile({ id: NEW_CUSTOMER, version: null, values });
    expect(saved).toMatchObject({
      version: 0,
      invoiceEmail: "ketoan@xanh.vn",
      bankAccount: { accountNumber: "0123 456.789", bankName: "Vietcombank" },
    });
    expect(await getLegalProfile(NEW_CUSTOMER)).toMatchObject({
      registeredAddress: values.registeredAddress,
    });
  });

  it("stale or missing version → 409 OPTIMISTIC_LOCK; matching version bumps it", async () => {
    await saveLegalProfile({ id: NEW_CUSTOMER, version: null, values });
    expect(
      (await errorOf(saveLegalProfile({ id: NEW_CUSTOMER, version: null, values }))).code,
    ).toBe("OPTIMISTIC_LOCK");
    expect((await errorOf(saveLegalProfile({ id: NEW_CUSTOMER, version: 5, values }))).code).toBe(
      "OPTIMISTIC_LOCK",
    );
    expect((await saveLegalProfile({ id: NEW_CUSTOMER, version: 0, values })).version).toBe(1);
  });

  it("no profile yet but a version is sent → 409", async () => {
    expect((await errorOf(saveLegalProfile({ id: NEW_CUSTOMER, version: 2, values }))).code).toBe(
      "OPTIMISTIC_LOCK",
    );
  });

  it("bad data → 400 VALIDATION_FAILED with no fieldErrors", async () => {
    const failure = await errorOf(
      api.put(`/customers/${NEW_CUSTOMER}/legal-profile`, {
        ...values,
        registeredAddress: "",
        version: null,
      }),
    );
    expect(failure.code).toBe("VALIDATION_FAILED");
    expect(failure.fieldErrors ?? {}).toEqual({});
  });
});
