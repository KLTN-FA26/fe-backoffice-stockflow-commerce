import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./client";
import { getFile, saveFile } from "./file-download";

afterEach(() => vi.restoreAllMocks());

describe("getFile", () => {
  it("GET dạng blob, lấy tên file từ Content-Disposition", async () => {
    const pdf = new Blob(["%PDF"], { type: "application/pdf" });
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: pdf,
      headers: { "content-disposition": 'attachment; filename="loading-sheet-LP-1-xe2.pdf"' },
    });
    const file = await getFile("/fulfillment/x.pdf", "fallback.pdf");
    expect(get).toHaveBeenCalledWith("/fulfillment/x.pdf", {
      responseType: "blob",
      headers: { Accept: "application/pdf, application/json" },
      signal: undefined,
    });
    expect(file).toEqual({ blob: pdf, fileName: "loading-sheet-LP-1-xe2.pdf" });
  });

  it("thiếu Content-Disposition → tên dự phòng", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: new Blob(["x"]), headers: {} });
    expect((await getFile("/p", "fallback.pdf")).fileName).toBe("fallback.pdf");
  });
});

describe("saveFile", () => {
  it("bấm một thẻ <a download> với đúng tên file rồi thu hồi blob URL", () => {
    const create = vi.fn(() => "blob:sheet");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe("a.pdf");
      expect(this.getAttribute("href")).toBe("blob:sheet");
    });
    saveFile({ blob: new Blob(["x"]), fileName: "a.pdf" });
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:sheet");
    vi.unstubAllGlobals();
  });
});
