import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./client";
import { fileNameFromDisposition, getFile, saveFile } from "./file-download";

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

describe("fileNameFromDisposition (BE PdfDownload — tên tiếng Việt)", () => {
  const name = "Phiếu xác nhận thanh toán XNTT-261123-a1b2c3-1.pdf";
  const q = Array.from(new TextEncoder().encode(name), (byte) =>
    /[0-9A-Za-z]/.test(String.fromCharCode(byte))
      ? String.fromCharCode(byte)
      : `=${byte.toString(16).toUpperCase().padStart(2, "0")}`,
  ).join("");
  const spring = `inline; filename="=?UTF-8?Q?${q}?="; filename*=UTF-8''${encodeURIComponent(name)}`;

  it("ưu tiên filename* (RFC 5987) — giữ nguyên dấu", () => {
    expect(fileNameFromDisposition(spring)).toBe(name);
  });

  it("chỉ có filename dạng RFC 2047 (Q / B) → giải ra UTF-8", () => {
    expect(fileNameFromDisposition(`inline; filename="=?UTF-8?Q?${q}?="`)).toBe(name);
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode("Phụ lục.pdf")));
    expect(fileNameFromDisposition(`inline; filename="=?UTF-8?B?${b64}?="`)).toBe("Phụ lục.pdf");
  });

  it("tên ASCII thường vẫn đọc như trước; không có tên → null", () => {
    expect(fileNameFromDisposition('attachment; filename="loading-sheet.pdf"')).toBe(
      "loading-sheet.pdf",
    );
    expect(fileNameFromDisposition("attachment; filename=plain.pdf")).toBe("plain.pdf");
    expect(fileNameFromDisposition("inline")).toBeNull();
  });

  it("getFile lấy tên tiếng Việt từ header Spring", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: new Blob(["%PDF"]),
      headers: { "content-disposition": spring },
    });
    expect((await getFile("/x", "fallback.pdf")).fileName).toBe(name);
  });
});
