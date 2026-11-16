/**
 * Tải tệp thẳng lên kho (BE `StagedUploads`): băm SHA-256, khai báo, PUT có tiến độ; lỗi phân loại rõ.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./client";
import {
  DirectUploadError,
  sha256Hex,
  storageClient,
  uploadFileDirect,
  uploadSlotSchema,
} from "./direct-upload";
import { ApiError } from "./error";

import type { DirectUploadProgress } from "./direct-upload";

afterEach(() => vi.restoreAllMocks());

const file = new File(["abc"], "xac-nhan.pdf", { type: "application/pdf" });
/** SHA-256("abc") — vector chuẩn. */
const ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const slot = (
  url: string,
  headers: Record<string, string> = { "Content-Type": "application/pdf" },
) => ({ uploadId: "u-1", method: "PUT", url, headers, expiresAt: "2026-11-12T10:15:00Z" });

describe("sha256Hex", () => {
  it("hex thường 64 ký tự, đúng vector chuẩn; tệp rỗng cũng băm được", async () => {
    expect(await sha256Hex(file)).toBe(ABC);
    expect(await sha256Hex(new File([], "e.txt"))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("uploadSlotSchema (BE UploadSlot)", () => {
  it("headers vắng → {}; thiếu url bị từ chối", () => {
    expect(
      uploadSlotSchema.parse({ uploadId: "u", method: "PUT", url: "https://s3/x" }).headers,
    ).toEqual({});
    expect(uploadSlotSchema.safeParse({ uploadId: "u", method: "PUT" }).success).toBe(false);
  });
});

describe("uploadFileDirect", () => {
  it("khai báo đúng {fileName, contentType, sizeBytes, sha256} rồi PUT tệp tới URL tuyệt đối bằng axios riêng với đúng headers", async () => {
    const declare = vi.fn().mockResolvedValue(slot("https://bucket.s3.amazonaws.com/incoming/u-1"));
    const put = vi.spyOn(storageClient, "request").mockResolvedValue({ status: 200 });
    const viaApi = vi.spyOn(api, "request");
    const id = await uploadFileDirect({ file, declare });
    expect(id).toBe("u-1");
    expect(declare).toHaveBeenCalledWith(
      { fileName: "xac-nhan.pdf", contentType: "application/pdf", sizeBytes: 3, sha256: ABC },
      undefined,
    );
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PUT",
        url: "https://bucket.s3.amazonaws.com/incoming/u-1",
        data: file,
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    // `api` (có interceptor thêm X-Warehouse-Id / JSON) KHÔNG được dùng cho URL của kho
    expect(viaApi).not.toHaveBeenCalled();
  });

  it("URL tương đối (cùng origin, mock) đi qua `api`", async () => {
    const declare = vi.fn().mockResolvedValue(slot("/__mock-storage/u-1"));
    const viaApi = vi.spyOn(api, "request").mockResolvedValue({ status: 200 });
    const direct = vi.spyOn(storageClient, "request");
    await uploadFileDirect({ file, declare });
    expect(viaApi).toHaveBeenCalledWith(expect.objectContaining({ url: "/__mock-storage/u-1" }));
    expect(direct).not.toHaveBeenCalled();
  });

  it("báo tiến độ: băm → khai báo → tải lên (theo % của sự kiện upload) → 100", async () => {
    const events: DirectUploadProgress[] = [];
    vi.spyOn(storageClient, "request").mockImplementation(async (config) => {
      config.onUploadProgress?.({ loaded: 1, total: 4 } as never);
      config.onUploadProgress?.({ loaded: 4, total: 4 } as never);
      return { status: 200 };
    });
    await uploadFileDirect({
      file,
      declare: async () => slot("https://s3/x"),
      onProgress: (event) => events.push(event),
    });
    expect(events.map((e) => `${e.stage}:${e.percent}`)).toEqual([
      "hashing:0",
      "declaring:0",
      "uploading:0",
      "uploading:25",
      "uploading:100",
      "uploading:100",
    ]);
  });

  it("lỗi bước khai báo (ApiError 415 / 413 / 429…) được giữ nguyên để chức năng map theo mã, và KHÔNG PUT", async () => {
    const put = vi.spyOn(storageClient, "request");
    const refusal = new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "x");
    await expect(
      uploadFileDirect({ file, declare: async () => Promise.reject(refusal) }),
    ).rejects.toBe(refusal);
    expect(put).not.toHaveBeenCalled();
  });

  it("slot sai hợp đồng (thiếu url) → từ chối trước khi PUT", async () => {
    const put = vi.spyOn(storageClient, "request");
    await expect(
      uploadFileDirect({ file, declare: async () => ({ uploadId: "u" }) }),
    ).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });

  it("kho từ chối (403 — chữ ký / byte không khớp / hết hạn) → DirectUploadError refused kèm status", async () => {
    vi.spyOn(storageClient, "request").mockRejectedValue({ response: { status: 403 } });
    await expect(
      uploadFileDirect({ file, declare: async () => slot("https://s3/x") }),
    ).rejects.toMatchObject({ name: "DirectUploadError", kind: "refused", status: 403 });
  });

  it("không tới được kho (không có response) → network; qua `api` mất mạng (ApiError status 0) cũng là network", async () => {
    vi.spyOn(storageClient, "request").mockRejectedValue(new Error("Network Error"));
    await expect(
      uploadFileDirect({ file, declare: async () => slot("https://s3/x") }),
    ).rejects.toMatchObject({ kind: "network" });
    vi.spyOn(api, "request").mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "x"));
    await expect(
      uploadFileDirect({ file, declare: async () => slot("/__mock-storage/u") }),
    ).rejects.toMatchObject({ kind: "network" });
  });

  it("người dùng huỷ: trước khi khai báo / giữa chừng khi PUT → aborted (không phải lỗi mạng)", async () => {
    const early = new AbortController();
    early.abort();
    const declare = vi.fn();
    await expect(uploadFileDirect({ file, declare, signal: early.signal })).rejects.toBeInstanceOf(
      DirectUploadError,
    );
    expect(declare).not.toHaveBeenCalled();

    const late = new AbortController();
    vi.spyOn(storageClient, "request").mockImplementation(async () => {
      late.abort();
      throw new Error("canceled");
    });
    await expect(
      uploadFileDirect({ file, declare: async () => slot("https://s3/x"), signal: late.signal }),
    ).rejects.toMatchObject({ kind: "aborted" });
  });
});
