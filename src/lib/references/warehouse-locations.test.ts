import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { fetchWarehouseLocations } from "./warehouse-locations";

afterEach(() => vi.restoreAllMocks());

describe("fetchWarehouseLocations — BE GET /warehouses/{id}/layout", () => {
  it("tách bin / khu chứa, bỏ chỗ không có mã, usable vắng = false, sắp theo mã, bỏ trùng", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        shelves: [
          {
            levels: [
              { bins: [{ locationCode: "HN-B-02", usable: true }, { locationCode: "HN-A-01" }] },
              { bins: [{ locationCode: "HN-B-02", usable: true }] },
            ],
          },
        ],
        // Khu NON_STORAGE không có mã vị trí
        areas: [{ locationCode: "HN-STAGE", usable: true }, {}],
      },
    });
    expect(await fetchWarehouseLocations("WH-1")).toEqual([
      { locationCode: "HN-A-01", kind: "BIN", usable: false },
      { locationCode: "HN-B-02", kind: "BIN", usable: true },
      { locationCode: "HN-STAGE", kind: "AREA", usable: true },
    ]);
    expect(get.mock.calls[0]?.[0]).toBe("/warehouses/WH-1/layout");
  });
});
