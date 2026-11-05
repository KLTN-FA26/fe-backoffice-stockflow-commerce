import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { apiPage, apiSupplier, supplier, validFormValues } from "./__fixtures__/supplier";
import {
  activateSupplier,
  blacklistSupplier,
  deactivateSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from "./api";

afterEach(() => vi.restoreAllMocks());

describe("supplier API — hợp đồng BE PR #36", () => {
  it("list gửi page 0-based, size, search, sort và đổi status sang ACTIVE/INACTIVE", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: apiPage() });

    const result = await listSuppliers({
      page: 2,
      size: 20,
      search: "  thành công  ",
      status: ["Inactive"],
      sort: "name,desc",
    });

    const [path, config] = get.mock.calls[0] ?? [];
    const params = config?.params as URLSearchParams;
    expect(path).toBe("/suppliers");
    expect(params.get("page")).toBe("2");
    expect(params.get("size")).toBe("20");
    expect(params.get("search")).toBe("thành công");
    expect(params.get("status")).toBe("INACTIVE");
    expect(params.get("sort")).toBe("name,desc");
    expect(result.items[0]?.status).toBe("Active");
    expect(result.totalElements).toBe(1);
  });

  it("chọn cả hai trạng thái thì không gửi status (BE chỉ nhận một giá trị)", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: apiPage() });
    await listSuppliers({ status: ["Active", "Inactive"] });
    const params = get.mock.calls[0]?.[1]?.params as URLSearchParams;
    expect(params.has("status")).toBe(false);
  });

  it("detail không bịa field ngoài hợp đồng (address/rating/currency)", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: apiSupplier });
    const dto = await getSupplier(apiSupplier.supplierId);
    expect(dto).not.toHaveProperty("address");
    expect(dto).not.toHaveProperty("rating");
    expect(dto).not.toHaveProperty("currency");
    expect(dto.status).toBe("Active");
  });

  it("sửa = PUT đủ field (thay toàn bộ), giữ status hiện tại", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValueOnce({ data: apiSupplier });
    await updateSupplier({ id: supplier.supplierId, values: validFormValues, status: "Inactive" });
    const [path, body] = put.mock.calls[0] ?? [];
    expect(path).toBe(`/suppliers/${supplier.supplierId}`);
    expect(body).toEqual({
      code: "SUP-009",
      name: "Công ty A",
      contactName: "Nguyễn Văn B",
      email: "b@a.vn",
      phone: "0901234567",
      taxCode: "0301234567",
      status: "INACTIVE",
      paymentTermDays: 30,
      leadTimeDays: 7,
      communicationChannel: "EMAIL",
      apiEndpoint: null,
      overReceiptTolerancePercent: null,
      printSubcontractor: false,
      lossTolerancePercent: null,
    });
  });

  it("PUT luôn gửi lại dung sai + NCC in gia công (BE PR #71 thay toàn bộ, thiếu = bị xoá)", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValueOnce({ data: apiSupplier });
    await updateSupplier({
      id: supplier.supplierId,
      values: {
        ...validFormValues,
        overReceiptTolerancePercent: 5,
        printSubcontractor: true,
        lossTolerancePercent: 2.5,
      },
      status: "Active",
    });
    expect(put.mock.calls[0]?.[1]).toMatchObject({
      overReceiptTolerancePercent: 5,
      printSubcontractor: true,
      lossTolerancePercent: 2.5,
    });
  });

  it("đưa vào danh sách đen = PUT với status BLACKLISTED, giữ nguyên các field khác", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValueOnce({
      data: { ...apiSupplier, status: "BLACKLISTED" },
    });
    const result = await blacklistSupplier(supplier);
    expect(put.mock.calls[0]?.[1]).toMatchObject({ code: "SUP-001", status: "BLACKLISTED" });
    expect(result.status).toBe("Blacklisted");
  });

  it("kích hoạt lại = PUT với status ACTIVE (không dùng PATCH /status)", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValueOnce({ data: apiSupplier });
    await activateSupplier({ ...supplier, status: "Inactive" });
    expect(put.mock.calls[0]?.[1]).toMatchObject({ code: "SUP-001", status: "ACTIVE" });
  });

  it("ngừng hợp tác = DELETE", async () => {
    const del = vi.spyOn(api, "delete").mockResolvedValueOnce({ data: null });
    await deactivateSupplier(supplier);
    expect(del).toHaveBeenCalledWith(`/suppliers/${supplier.supplierId}`);
  });
});
