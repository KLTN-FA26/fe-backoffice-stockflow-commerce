import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { describeVariantMedia, mediaViewUrl, uploadVariantMedia } from "./variant-api";
import { beMediaSchema } from "./variant-schemas";

afterEach(() => vi.restoreAllMocks());

const media = (over: Record<string, unknown> = {}) =>
  beMediaSchema.parse({
    mediaId: "m-1",
    variantId: "v-1",
    kind: "IMAGE",
    sortOrder: 2,
    primary: true,
    published: false,
    version: 0,
    renditions: [],
    ...over,
  });

const fileDto = {
  mediaId: "m-2",
  variantId: "v-1",
  kind: "IMAGE",
  sortOrder: 0,
  primary: false,
  published: false,
  version: 0,
};

describe("ảnh biến thể — BE ProductMediaController", () => {
  it("tải lên gửi Idempotency-Key (BE nhận ở upload)", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: fileDto });
    await uploadVariantMedia({
      productId: "p",
      variantId: "v-1",
      file: new File(["x"], "a.png", { type: "image/png" }),
      idempotencyKey: "key-12345678",
    });
    const config = post.mock.calls[0]?.[2] as { headers: Record<string, string> };
    expect(config.headers["Idempotency-Key"]).toBe("key-12345678");
  });

  it("sửa mô tả / thứ tự giữ nguyên cờ ảnh bìa (DescribeMediaRequest)", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: { ...fileDto, mediaId: "m-1" } });
    await describeVariantMedia({
      productId: "p",
      variantId: "v-1",
      media: media(),
      altText: "Ly giấy trắng",
      sortOrder: 5,
    });
    expect(put).toHaveBeenCalledWith("/products/p/variants/v-1/media/m-1", {
      altText: "Ly giấy trắng",
      sortOrder: 5,
      primary: true,
    });
  });

  it("bản hiển thị đã kèm url trong danh sách → dùng luôn, không gọi download-url", async () => {
    const get = vi.spyOn(api, "get");
    const url = await mediaViewUrl(
      "p",
      "v-1",
      media({
        renditions: [
          {
            edge: 256,
            width: 256,
            height: 256,
            contentType: "image/webp",
            sizeBytes: 10,
            url: "https://cdn/256",
          },
        ],
      }),
      256,
    );
    expect(url).toBe("https://cdn/256");
    expect(get).not.toHaveBeenCalled();
  });
});
