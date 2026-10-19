import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { listAllBrands, listAllCategoryNodes } from "./taxonomy-api";

afterEach(() => vi.restoreAllMocks());

const category = (code: string, path: string, depth: number) => ({
  categoryId: `c-${code}`,
  code,
  name: code,
  slug: code.toLowerCase(),
  path,
  depth,
  sortOrder: 0,
  active: true,
});

const pageOf = <T>(items: T[], page: number, totalPages: number) => ({
  items,
  page,
  size: 200,
  totalElements: totalPages * 200,
  totalPages,
  hasNext: page + 1 < totalPages,
  hasPrevious: page > 0,
});

describe("listAll* — ô chọn tải đủ các trang, không cắt ở 200 dòng đầu", () => {
  it("trang đầu cho totalPages, các trang sau tải song song; size 200; sắp thứ tự cây", async () => {
    const get = vi
      .spyOn(api, "get")
      .mockResolvedValueOnce({
        data: pageOf([category("AO", "/AO", 0), category("AO-KHOAC", "/AO-KHOAC", 0)], 0, 3),
      })
      .mockResolvedValueOnce({ data: pageOf([category("THUN", "/AO/THUN", 1)], 1, 3) })
      .mockResolvedValueOnce({ data: pageOf([category("POLO", "/AO/POLO", 1)], 2, 3) });

    const rows = await listAllCategoryNodes({ active: true, sort: "path,asc" });

    expect(rows.map((r) => r.code)).toEqual(["AO", "POLO", "THUN", "AO-KHOAC"]);
    expect(get).toHaveBeenCalledTimes(3);
    expect(get).toHaveBeenLastCalledWith(
      "/categories",
      expect.objectContaining({ params: expect.objectContaining({ page: 2, size: 200 }) }),
    );
  });

  it("khử trùng theo id khi dữ liệu dịch giữa hai trang", async () => {
    const shifted = category("AO-KHOAC", "/AO-KHOAC", 0);
    vi.spyOn(api, "get")
      .mockResolvedValueOnce({ data: pageOf([category("AO", "/AO", 0), shifted], 0, 2) })
      .mockResolvedValueOnce({ data: pageOf([shifted, category("B", "/B", 0)], 1, 2) });
    const rows = await listAllCategoryNodes({ active: true });
    expect(rows.map((r) => r.code)).toEqual(["AO", "AO-KHOAC", "B"]);
  });

  it("chặn trên số trang (không gọi vô hạn nếu BE báo quá nhiều trang)", async () => {
    const brand = { brandId: "b", code: "B", name: "B", slug: "b", active: true };
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: pageOf([brand], 0, 999) });
    await listAllBrands({ active: true, sort: "name,asc" });
    expect(get).toHaveBeenCalledTimes(25);
  });

  it("chỉ một trang (hasNext false) → một request", async () => {
    const get = vi
      .spyOn(api, "get")
      .mockResolvedValue({ data: pageOf([category("A", "/A", 0)], 0, 1) });
    await listAllCategoryNodes({});
    expect(get).toHaveBeenCalledTimes(1);
  });
});
