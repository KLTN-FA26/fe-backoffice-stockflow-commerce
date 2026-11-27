/**
 * Mock `POST /customers` qua axios thật + lớp api của form tạo khách: khách mới luôn có người phụ trách (chốt 28/11) —
 * Sale tạo thì là chính họ, người điều phối phải chọn một Sale đang làm (SALES_OWNER_REQUIRED / SALES_OWNER_NOT_ASSIGNABLE),
 * từ lead thì là Sale của lead (§10.7); MST bắt buộc (BR-S14).
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createCustomer } from "@/features/customer/api";
import { listLeads } from "@/features/sales-owner/work-api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";
import { getSalesOwnerDetail } from "@/lib/references/sales-owner";

import { activateMockAdapter } from "./mock-adapter";
import { resetCustomerMockStore } from "./mock-customer-store";
import { mockActorId } from "./mock-display-names";
import { resetSalesOwnerMockStore, mockSalesRoster } from "./mock-sales-owner-store";
import { resetSalesWorkMockStore } from "./mock-routes-sales-work";

import type { CustomerCreateValues } from "@/features/customer/types";

/*
 * Các tài khoản demo của `mock-user-grants` chỉ có `customer-customers:READ` (FE chưa dùng CREATE ở mock). Ở đây thêm CREATE
 * như seed BE (SALES_STAFF, SALES_MANAGER, SYSTEM_ADMIN) để route kiểm quyền như `@RequiresPermission`.
 */
vi.mock("./mock-user-grants", async (importOriginal) => {
  const original = await importOriginal<typeof import("./mock-user-grants")>();
  return {
    ...original,
    mockGrantsOf: (userId: string) =>
      new Set([...original.mockGrantsOf(userId), "customer-customers:CREATE"]),
  };
});

const originalAdapter = api.defaults.adapter;
const MANAGER = "USER-ADMIN-01";
const SALES = "USER-SALE-01";

function actAs(userId: string) {
  useAuthStore.setState({
    user: {
      userId,
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
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  throw new Error("Expected request to fail");
}

let sequence = 0;
function values(extra: Partial<CustomerCreateValues> = {}): CustomerCreateValues {
  sequence += 1;
  return {
    companyName: `Quán Thử ${sequence}`,
    taxCode: `03${String(90_000_000 + sequence).padStart(8, "0")}`,
    contactName: "Nguyễn An",
    email: `tao-khach-${sequence}@example.com`,
    phone: "",
    taxCodeExemption: false,
    exemptionReason: "",
    salesOwnerId: "",
    leadId: "",
    ...extra,
  };
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
afterEach(() => {
  resetCustomerMockStore();
  resetSalesOwnerMockStore();
  resetSalesWorkMockStore();
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("mock POST /customers — người phụ trách (chốt 28/11)", () => {
  it("2026-11-28: a manager who names no salesperson is refused SALES_OWNER_REQUIRED", async () => {
    actAs(MANAGER);
    expect(await codeOf(createCustomer(values()))).toBe("SALES_OWNER_REQUIRED");
  });

  it("BR-S02: the salesperson a manager names owns the new customer", async () => {
    actAs(MANAGER);
    const sales = (await mockSalesRoster())[0]?.id ?? "";
    const created = await createCustomer(values({ salesOwnerId: sales }));
    expect(created.customer.status).toBe("PENDING_ACTIVATION");
    expect(await getSalesOwnerDetail(created.customer.customerId)).toMatchObject({
      salesOwnerId: sales,
      state: "ASSIGNED",
    });
  });

  it("D42: a manager naming themselves is refused SALES_OWNER_NOT_ASSIGNABLE", async () => {
    actAs(MANAGER);
    expect(await codeOf(createCustomer(values({ salesOwnerId: mockActorId(MANAGER) })))).toBe(
      "SALES_OWNER_NOT_ASSIGNABLE",
    );
  });

  it("BR-S02 / case 1: a salesperson who names nobody owns the customer", async () => {
    actAs(SALES);
    const created = await createCustomer(values());
    expect(await getSalesOwnerDetail(created.customer.customerId)).toMatchObject({
      salesOwnerId: mockActorId(SALES),
      state: "ASSIGNED",
    });
  });

  it("§10.7: a manager converting a lead names nobody; the lead's salesperson owns it", async () => {
    actAs(MANAGER);
    const lead = (await listLeads({ page: 0, size: 20, status: "ASSIGNED" })).items[0];
    expect(lead?.assignedTo).toBeTruthy();
    const created = await createCustomer(values({ leadId: lead?.id ?? "" }));
    expect(await getSalesOwnerDetail(created.customer.customerId)).toMatchObject({
      salesOwnerId: lead?.assignedTo,
      state: "ASSIGNED",
    });
    const after = await listLeads({ page: 0, size: 20 });
    expect(after.items.find((l) => l.id === lead?.id)?.status).toBe("CONVERTED");
  });

  it("P4: a salesperson creating a unit of another salesperson's company is refused, naming them", async () => {
    const other = (await mockSalesRoster()).find((p) => p.id !== mockActorId(SALES));
    expect(other).toBeTruthy();
    actAs(MANAGER);
    const company = values({ taxCode: "0398765432", salesOwnerId: other?.id ?? "" });
    await createCustomer(company);
    actAs(SALES);
    const refusal = await createCustomer(values({ taxCode: "0398765432-001" })).catch(
      (error: unknown) => error,
    );
    expect(refusal).toBeInstanceOf(ApiError);
    expect(refusal).toMatchObject({
      code: "CUSTOMER_OWNED_BY_OTHER_SALES",
      details: { salesOwnerId: other?.id, salesOwnerName: other?.name },
    });
    // Quản lý tạo đơn vị đó được (giao cho người phụ trách công ty)
    actAs(MANAGER);
    const unit = await createCustomer(
      values({ taxCode: "0398765432-001", salesOwnerId: other?.id ?? "" }),
    );
    expect(unit.customer.taxCode).toBe("0398765432-001");
  });

  it("BR-S14: no tax code and no exemption → CUSTOMER_TAX_CODE_REQUIRED", async () => {
    actAs(SALES);
    expect(await codeOf(createCustomer(values({ taxCode: "" })))).toBe(
      "CUSTOMER_TAX_CODE_REQUIRED",
    );
  });
});
