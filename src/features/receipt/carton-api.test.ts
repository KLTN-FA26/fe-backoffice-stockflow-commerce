import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { printCartonLabels } from "./carton-api";

afterEach(() => vi.restoreAllMocks());

const PATH = "/inventory/stock-packages/labels";
const pdf = new Blob(["%PDF-1.4"], { type: "application/pdf" });

describe("printCartonLabels — BE StockPackageController#labels (SCRUM-473)", () => {
  it("in mọi thùng của dòng: { receiptLineId, format }, nhận PDF dạng Blob + tên file từ Content-Disposition", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: pdf,
      headers: { "content-disposition": 'attachment; filename="carton-labels-20261031-2210.pdf"' },
    });
    const result = await printCartonLabels({ receiptLineId: "line-1", format: "THERMAL_ROLL" });

    expect(post).toHaveBeenCalledWith(
      PATH,
      { receiptLineId: "line-1", format: "THERMAL_ROLL" },
      { responseType: "blob", headers: { Accept: "application/pdf, application/json" } },
    );
    expect(result).toEqual({ blob: pdf, fileName: "carton-labels-20261031-2210.pdf" });
  });

  it("in lại theo LPN: { lpns, format } không kèm receiptLineId; thiếu tên file → tên mặc định", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: pdf, headers: {} });
    const result = await printCartonLabels({
      lpns: ["LPN-20261024-000002"],
      format: "A4_SHEET",
    });
    expect(post.mock.calls[0]?.[1]).toEqual({ lpns: ["LPN-20261024-000002"], format: "A4_SHEET" });
    expect(result.fileName).toBe("carton-labels.pdf");
  });
});
