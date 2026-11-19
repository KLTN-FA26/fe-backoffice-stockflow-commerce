/**
 * Schema file đính kèm (BE `WaybillFileResponse`, `PodFileResponse`, `WaybillFileResponse.Link`; docs 09 §4.4, §4.3 bước 2).
 */
import { describe, expect, it } from "vitest";

import {
  beAttachedFileListSchema,
  beAttachedFileSchema,
  beDownloadLinkSchema,
} from "./attached-files-schemas";

const WAYBILL_FILE = {
  fileId: "11111111-1111-4111-8111-111111111111",
  loadId: "22222222-2222-4222-8222-222222222222",
  fileName: "van-don-hang-NB.pdf",
  contentType: "application/pdf",
  sizeBytes: 48213,
  uploadedBy: "33333333-3333-4333-8333-333333333333",
  uploadedAt: "2026-11-17T13:24:10.123456Z",
};
const POD_FILE = {
  fileId: "44444444-4444-4444-8444-444444444444",
  shipmentId: "55555555-5555-4555-8555-555555555555",
  fileName: "bien-ban.png",
  contentType: "image/png",
  sizeBytes: 912,
  uploadedBy: "33333333-3333-4333-8333-333333333333",
  uploadedAt: "2026-11-17T15:00:00+07:00",
};

describe("beAttachedFileSchema", () => {
  it("nhận file vận đơn và POD (hai DTO cùng hình, khác khoá cha) và bỏ khoá cha", () => {
    const waybill = beAttachedFileSchema.parse(WAYBILL_FILE);
    expect(waybill.fileName).toBe("van-don-hang-NB.pdf");
    expect(waybill.sizeBytes).toBe(48213);
    expect("loadId" in waybill).toBe(false);
    const pod = beAttachedFileSchema.parse(POD_FILE);
    expect(pod.contentType).toBe("image/png");
    expect("shipmentId" in pod).toBe(false);
  });

  it("BE bỏ null khỏi JSON: contentType / uploadedBy vắng vẫn đọc được", () => {
    const { contentType: _type, uploadedBy: _by, ...rest } = WAYBILL_FILE;
    const parsed = beAttachedFileSchema.parse(rest);
    expect(parsed.contentType).toBeUndefined();
    expect(parsed.uploadedBy).toBeUndefined();
  });

  it.each([
    ["thiếu fileId", { ...WAYBILL_FILE, fileId: "" }],
    ["thiếu fileName", { ...WAYBILL_FILE, fileName: undefined }],
    ["dung lượng âm", { ...WAYBILL_FILE, sizeBytes: -1 }],
    ["dung lượng không nguyên", { ...WAYBILL_FILE, sizeBytes: 1.5 }],
    ["thời điểm không phải ISO", { ...WAYBILL_FILE, uploadedAt: "17/11/2026" }],
  ])("từ chối khi %s", (_name, input) => {
    expect(beAttachedFileSchema.safeParse(input).success).toBe(false);
  });

  it("danh sách rỗng và danh sách nhiều file", () => {
    expect(beAttachedFileListSchema.parse([])).toEqual([]);
    expect(beAttachedFileListSchema.parse([WAYBILL_FILE, POD_FILE])).toHaveLength(2);
  });
});

describe("beDownloadLinkSchema", () => {
  it("đọc url và hạn; hạn vắng vẫn nhận", () => {
    expect(
      beDownloadLinkSchema.parse({ url: "https://s3/x?sig=1", expiresAt: "2026-11-17T13:30:00Z" }),
    ).toEqual({ url: "https://s3/x?sig=1", expiresAt: "2026-11-17T13:30:00Z" });
    expect(beDownloadLinkSchema.parse({ url: "https://s3/x?sig=1" }).expiresAt).toBeUndefined();
  });

  it("từ chối url rỗng hoặc thiếu", () => {
    expect(beDownloadLinkSchema.safeParse({ url: "" }).success).toBe(false);
    expect(beDownloadLinkSchema.safeParse({}).success).toBe(false);
  });
});
