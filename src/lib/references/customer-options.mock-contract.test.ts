/**
 * Contract test: mock `GET /customers` + `GET /customers/{id}` nói đúng hợp đồng BE `CustomerController`
 * (`CustomerSearchRepository.search`, `SortWhitelist`, `Pages`, `CustomerWebMapper`) để
 * `customer-options.ts` chạy y hệt trên mock và BE thật. Gọi qua mock adapter thật.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { mockCustomerId, resetCustomerMockStore } from "@/lib/api/mock-customer-store";
import { bePageSchema } from "@/lib/api/page-schema";

import { customerOptionSchema, fetchCustomerOptions, fetchCustomerRef } from "./customer-options";

// Mỗi request mock trễ ~350ms (Math.random = 0.5 → không có lỗi 500 ngẫu nhiên).
vi.setConfig({ testTimeout: 30_000 });

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  activateMockAdapter();
});
beforeEach(() => resetCustomerMockStore());
afterAll(() => vi.restoreAllMocks());

const TOTAL = 45;
const pageSchema = bePageSchema(customerOptionSchema.passthrough());

async function rawPage(params: Record<string, string>) {
  const { data } = await api.get<unknown>("/customers", { params: new URLSearchParams(params) });
  return pageSchema.parse(data);
}
async function apiError(p: Promise<unknown>): Promise<ApiError> {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  if (!(e instanceof ApiError)) throw new Error(`expected ApiError, got ${String(e)}`);
  return e;
}

describe("GET /customers (mock)", () => {
  it("1 + 12 mặc định: trang 0, 20 khách, envelope chuẩn; mặc định BE sắp createdAt giảm dần", async () => {
    const first = await fetchCustomerOptions("");
    expect(first).toMatchObject({ page: 0, hasMore: true, totalElements: TOTAL });
    expect(first.items).toHaveLength(20);
    const byDefault = await rawPage({});
    expect(byDefault.items[0]?.customerId).toBe(mockCustomerId(TOTAL));
    expect(byDefault).toMatchObject({ size: 20, totalPages: 3, hasPrevious: false });
  });

  it("2 tìm theo tên — không phân biệt hoa thường, chứa chuỗi", async () => {
    const { items } = await fetchCustomerOptions("  MINH PHÁT ");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((c) => c.fullName.toLowerCase().includes("minh phát"))).toBe(true);
  });

  it("3 tìm theo email", async () => {
    const { items } = await fetchCustomerOptions("khach7@");
    expect(items.map((c) => c.customerId)).toEqual([mockCustomerId(7)]);
  });

  it("4 tìm theo điện thoại; mã số thuế chỉ khớp ĐÚNG cả mã, không khớp một phần", async () => {
    const two = await fetchCustomerRef(mockCustomerId(2));
    const byPhone = await fetchCustomerOptions(two.phone ?? "missing");
    expect(byPhone.items.map((c) => c.customerId)).toContain(mockCustomerId(2));
    const { data } = await api.get<{ taxCode: string }>(`/customers/${mockCustomerId(1)}`);
    const whole = await fetchCustomerOptions(data.taxCode);
    expect(whole.items.map((c) => c.customerId)).toContain(mockCustomerId(1));
    const partial = await fetchCustomerOptions(data.taxCode.slice(0, 8));
    expect(partial.items.map((c) => c.customerId)).not.toContain(mockCustomerId(1));
  });

  it("5 phân trang từ 0: các trang không trùng, trang cuối hết hasNext", async () => {
    const p0 = await rawPage({ page: "0", size: "20", sort: "fullName,asc" });
    const p1 = await rawPage({ page: "1", size: "20", sort: "fullName,asc" });
    const p2 = await rawPage({ page: "2", size: "20", sort: "fullName,asc" });
    const ids = [...p0.items, ...p1.items, ...p2.items].map((c) => c.customerId);
    expect(new Set(ids).size).toBe(TOTAL);
    expect(p2).toMatchObject({ hasNext: false, hasPrevious: true });
    expect(p2.items).toHaveLength(TOTAL - 40);
  });

  it("6 cỡ trang tối đa 200; 201 / 0 / trang âm / trang không phải số → 400 UNSUPPORTED_PARAMETER", async () => {
    expect((await rawPage({ size: "200" })).items).toHaveLength(TOTAL);
    const invalid: Record<string, string>[] = [
      { size: "201" },
      { size: "0" },
      { page: "-1" },
      { page: "abc" },
    ];
    for (const params of invalid) {
      expect((await apiError(rawPage(params))).code).toBe("UNSUPPORTED_PARAMETER");
    }
  });

  it("7 sắp theo tên ổn định giữa các lần gọi; khách trùng tên theo customerId", async () => {
    const a = await rawPage({ size: "200", sort: "fullName,asc" });
    const b = await rawPage({ size: "200", sort: "fullName,asc" });
    expect(a.items.map((c) => c.customerId)).toEqual(b.items.map((c) => c.customerId));
    const twins = a.items
      .filter((c) => c.fullName === "Công ty TNHH In Ấn Sài Gòn")
      .map((c) => c.customerId);
    expect(twins).toEqual([mockCustomerId(1), mockCustomerId(10), mockCustomerId(19)]);
    expect((await apiError(rawPage({ sort: "taxCode,asc" }))).code).toBe("UNSUPPORTED_PARAMETER");
  });

  it("8 lọc trạng thái khi có yêu cầu; trạng thái lạ → UNSUPPORTED_PARAMETER", async () => {
    const blocked = await rawPage({ size: "200", status: "BLOCKED" });
    expect(blocked.items.length).toBeGreaterThan(0);
    expect(blocked.items.every((c) => c.status === "BLOCKED")).toBe(true);
    expect((await apiError(rawPage({ status: "blocked" }))).code).toBe("UNSUPPORTED_PARAMETER");
  });

  it("9 không lọc thì giữ mọi trạng thái (không tự bỏ INACTIVE / BLOCKED)", async () => {
    const all = await rawPage({ size: "200" });
    expect(new Set(all.items.map((c) => c.status))).toEqual(
      new Set(["PENDING_ACTIVATION", "ACTIVE", "INACTIVE", "BLOCKED"]),
    );
  });

  it("lọc nhóm khách theo segmentId; segmentId sai dạng → UNSUPPORTED_PARAMETER", async () => {
    const all = await rawPage({ size: "200" });
    const segment = all.items.find((c) => c.segmentId !== null)?.segmentId ?? "";
    const inSegment = await rawPage({ size: "200", segmentId: segment });
    expect(inSegment.items.every((c) => c.segmentId === segment)).toBe(true);
    expect((await apiError(rawPage({ segmentId: "dai-ly" }))).code).toBe("UNSUPPORTED_PARAMETER");
  });

  it("danh sách che mã số thuế, chi tiết trả nguyên (BE toMaskedResponse / toResponse)", async () => {
    const list = await api.get<{ items: { customerId: string; taxCode?: string }[] }>(
      "/customers",
      {
        params: new URLSearchParams({ q: "khach1@" }),
      },
    );
    expect(list.data.items[0]?.taxCode).toBe("031****001");
    const { data } = await api.get<{ taxCode: string }>(`/customers/${mockCustomerId(1)}`);
    expect(data.taxCode).toBe("0310000001");
  });
});

describe("GET /customers/{customerId} (mock)", () => {
  it("10 + 12 đúng khách, cùng hình DTO với danh sách", async () => {
    const ref = await fetchCustomerRef(mockCustomerId(3));
    const fromList = (await fetchCustomerOptions("khach3@")).items[0];
    expect(ref).toEqual(fromList);
    expect(ref).not.toHaveProperty("customerCode");
    expect(ref).not.toHaveProperty("type");
  });

  it("11 khách không có → 404 CUSTOMER_NOT_FOUND; id không phải UUID → UNSUPPORTED_PARAMETER", async () => {
    const missing = await apiError(fetchCustomerRef("c0de9999-0000-4000-8000-000000009999"));
    expect([missing.status, missing.code]).toEqual([404, "CUSTOMER_NOT_FOUND"]);
    const bad = await apiError(fetchCustomerRef("CUS-0012"));
    expect([bad.status, bad.code]).toEqual([400, "UNSUPPORTED_PARAMETER"]);
  });
});
