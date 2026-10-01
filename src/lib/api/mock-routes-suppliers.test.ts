import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { activateMockAdapter } from "./mock-adapter";
import { resetSupplierMockStore } from "./mock-routes-suppliers";
import { api } from "./client";
import { ApiError } from "./error";

activateMockAdapter();

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (e: unknown) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error("expected request to fail");
}

const validBody = {
  code: "SUP-NEW",
  name: "NCC mới",
  status: "ACTIVE",
  paymentTermDays: 30,
  leadTimeDays: 7,
  communicationChannel: "EMAIL",
  email: "a@b.vn",
};

beforeEach(() => {
  resetSupplierMockStore();
  // Tắt "lỗi ngẫu nhiên 5%" của mock adapter để test xác định (giống mock-routes.test.ts)
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});

afterEach(() => vi.restoreAllMocks());

describe("mock /suppliers — đúng hợp đồng BE PR #36", () => {
  it("GET list trả PageResponse 0-based, status ACTIVE/INACTIVE, không có field ngoài hợp đồng", async () => {
    const { data } = await api.get("/suppliers", {
      params: new URLSearchParams({ page: "0", size: "2" }),
    });
    expect(data).toMatchObject({ page: 0, size: 2, hasPrevious: false });
    expect(data.items).toHaveLength(2);
    expect(["ACTIVE", "INACTIVE"]).toContain(data.items[0].status);
    expect(data.items[0]).not.toHaveProperty("active");
    expect(data.items[0]).not.toHaveProperty("address");
    expect(data.items[0]).not.toHaveProperty("currency");
  });

  it("size > 200 → 400; sort ngoài whitelist → 400", async () => {
    expect(
      (await errorOf(api.get("/suppliers", { params: new URLSearchParams({ size: "201" }) })))
        .status,
    ).toBe(400);
    expect(
      (
        await errorOf(
          api.get("/suppliers", { params: new URLSearchParams({ sort: "taxCode,asc" }) }),
        )
      ).status,
    ).toBe(400);
  });

  it("POST trùng mã → 409 SUPPLIER_CODE_ALREADY_EXISTS", async () => {
    await api.post("/suppliers", validBody);
    const err = await errorOf(api.post("/suppliers", { ...validBody, email: "c@d.vn" }));
    expect(err.status).toBe(409);
    expect(err.code).toBe("SUPPLIER_CODE_ALREADY_EXISTS");
  });

  it("kênh EMAIL thiếu email → 400 với fieldErrors deliveryContactValid", async () => {
    const err = await errorOf(api.post("/suppliers", { ...validBody, email: "" }));
    expect(err.status).toBe(400);
    expect(err.fieldErrors).toHaveProperty("deliveryContactValid");
  });

  it("PUT đổi mã → 409 CONFLICT (mã không đổi được)", async () => {
    await api.post("/suppliers", validBody);
    const err = await errorOf(api.put("/suppliers/SUP-NEW", { ...validBody, code: "SUP-OTHER" }));
    expect(err.code).toBe("CONFLICT");
  });

  it("DELETE = ngừng hợp tác (chuyển INACTIVE, vẫn giữ bản ghi)", async () => {
    await api.post("/suppliers", validBody);
    await api.delete("/suppliers/SUP-NEW");
    const { data } = await api.get("/suppliers/SUP-NEW");
    expect(data.status).toBe("INACTIVE");
  });
});
