import { beforeEach, describe, expect, it, vi } from "vitest";

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";
import { api } from "@/lib/api/client";

import { listWarehouseStock } from "./api-draft";

vi.mock("@/lib/api/client", () => ({ api: { get: vi.fn() } }));

/** Trang BE `PageResponse` với `count` dòng tồn, mã vị trí đánh số liên tiếp. */
const page = (index: number, count: number, total: number) => ({
  data: {
    items: Array.from({ length: count }, (_, i) => ({
      locationCode: `HCM-A01-1-${index * 1000 + i}`,
      sku: "SKU-1",
      onHand: 5,
    })),
    page: index,
    size: LIMITS.warehouseStockPageSize,
    totalElements: total,
    totalPages: Math.ceil(total / LIMITS.warehouseStockPageSize),
    hasNext: (index + 1) * LIMITS.warehouseStockPageSize < total,
    hasPrevious: index > 0,
  },
});

beforeEach(() => vi.mocked(api.get).mockReset());

describe("listWarehouseStock — tồn cả kho cho toàn cảnh 3D", () => {
  it("đọc lần lượt mọi trang theo tiền tố mã kho, gộp đủ dòng", async () => {
    const size = LIMITS.warehouseStockPageSize;
    vi.mocked(api.get)
      .mockResolvedValueOnce(page(0, size, size + 3))
      .mockResolvedValueOnce(page(1, 3, size + 3));
    const result = await listWarehouseStock({ warehouseId: "wh-hcm", prefix: "HCM" });
    expect(result).toMatchObject({ total: size + 3, truncated: false });
    expect(result.rows).toHaveLength(size + 3);
    expect(vi.mocked(api.get).mock.calls.map((call) => call[1]?.params)).toEqual([
      { location: "HCM-", page: 0, size },
      { location: "HCM-", page: 1, size },
    ]);
  });

  it("kho vượt trần → dừng ở trần và báo truncated (UI hiện 'một phần'), không đọc mãi", async () => {
    const size = LIMITS.warehouseStockPageSize;
    const total = LIMITS.warehouseStockMaxRows + 500;
    vi.mocked(api.get).mockImplementation(async (_url, config) => {
      const params = (config?.params ?? {}) as { page: number };
      return page(params.page, size, total);
    });
    const result = await listWarehouseStock({ warehouseId: "wh-hcm", prefix: "HCM" });
    expect(result.rows).toHaveLength(LIMITS.warehouseStockMaxRows);
    expect(result).toMatchObject({ total, truncated: true });
    expect(api.get).toHaveBeenCalledTimes(LIMITS.warehouseStockMaxRows / size);
  });

  it("kho chưa có tồn → không dòng nào, không truncated", async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page(0, 0, 0));
    await expect(listWarehouseStock({ warehouseId: "wh-hcm", prefix: "HCM" })).resolves.toEqual({
      rows: [],
      total: 0,
      truncated: false,
    });
  });
});
