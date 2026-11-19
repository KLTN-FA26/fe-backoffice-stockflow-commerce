/**
 * Phần thuần của file đính kèm (docs 09 §4.4, §4.3 bước 2, BR-28): đường dẫn BE, định dạng, kiểm file ở máy, câu lỗi tiếng Việt.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIPPING_FILE_LABELS as L, SHIPPING_FILE_MAX_BYTES } from "@/constants/shipping-files";
import { DirectUploadError } from "@/lib/api/direct-upload";
import { ApiError } from "@/lib/api/error";

import {
  POD_FILES,
  WAYBILL_FILES,
  attachedFileProblem,
  attachedFileUploadError,
  fileTypeLabel,
  formatFileSize,
  openDownloadLink,
} from "./attached-files";

const apiError = (status: number, code: string) =>
  new ApiError(status, code, "English server message", undefined, "trace-1");
const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpeg: "image/jpeg",
  png: "image/png",
};

describe("đường dẫn và khoá cache", () => {
  it("file vận đơn dưới chuyến, POD dưới lô giao; id được mã hoá", () => {
    expect(WAYBILL_FILES.basePath("ld-1")).toBe("/fulfillment/loads/ld-1/waybill-files");
    expect(POD_FILES.basePath("sh-1")).toBe("/fulfillment/shipments/sh-1/pod-files");
    expect(WAYBILL_FILES.basePath("a/b")).toBe("/fulfillment/loads/a%2Fb/waybill-files");
  });

  it("khoá cache nằm dưới khoá gốc của chuyến / lô giao và tách theo chủ", () => {
    expect(WAYBILL_FILES.queryKey("ld-1")).toEqual(["fulfillment-loads", "waybill-files", "ld-1"]);
    expect(POD_FILES.queryKey("sh-1")).toEqual(["fulfillment-shipments", "pod-files", "sh-1"]);
    expect(WAYBILL_FILES.queryKey("ld-1")).not.toEqual(WAYBILL_FILES.queryKey("ld-2"));
  });
});

describe("formatFileSize", () => {
  it.each([
    [0, "0 B"],
    [912, "912 B"],
    [1024, "1,0 KB"],
    [48213, "47 KB"],
    [1536, "1,5 KB"],
    [5 * 1024 * 1024, "5,0 MB"],
    [25 * 1024 * 1024, "25 MB"],
  ])("%d byte → %s", (bytes, text) => {
    expect(formatFileSize(bytes)).toBe(text);
  });
});

describe("fileTypeLabel", () => {
  it("tên loại tiếng Việt; thiếu hoặc lạ → Tệp", () => {
    expect(fileTypeLabel(MIME.pdf)).toBe("PDF");
    expect(fileTypeLabel(MIME.xlsx)).toBe("Excel");
    expect(fileTypeLabel(MIME.docx)).toBe("Word");
    expect(fileTypeLabel(MIME.png)).toBe("Ảnh PNG");
    expect(fileTypeLabel("text/csv")).toBe("CSV");
    expect(fileTypeLabel("application/x-unknown")).toBe(L.common.typeOther);
    expect(fileTypeLabel(undefined)).toBe(L.common.typeOther);
    expect(fileTypeLabel(null)).toBe(L.common.typeOther);
  });
});

describe("attachedFileProblem (kiểm ở máy trước khi gửi, khớp FileCategory.DOCUMENT của BE)", () => {
  it.each(Object.values(MIME))("file vận đơn nhận %s", (type) => {
    expect(attachedFileProblem("waybill", { size: 1000, type })).toBeNull();
  });

  it("POD chỉ nhận PDF hoặc ảnh: Word / Excel bị từ chối", () => {
    expect(attachedFileProblem("pod", { size: 1000, type: MIME.pdf })).toBeNull();
    expect(attachedFileProblem("pod", { size: 1000, type: MIME.jpeg })).toBeNull();
    expect(attachedFileProblem("pod", { size: 1000, type: MIME.png })).toBeNull();
    expect(attachedFileProblem("pod", { size: 1000, type: MIME.xlsx })).toBe(L.pod.typeNotAccepted);
    expect(attachedFileProblem("pod", { size: 1000, type: MIME.docx })).toBe(L.pod.typeNotAccepted);
  });

  it("loại lạ, loại trống và ảnh WebP (BE không nhận) bị từ chối với câu của từng loại file", () => {
    for (const type of ["text/plain", "application/zip", "image/webp", ""]) {
      expect(attachedFileProblem("waybill", { size: 10, type })).toBe(L.waybill.typeNotAccepted);
      expect(attachedFileProblem("pod", { size: 10, type })).toBe(L.pod.typeNotAccepted);
    }
  });

  it("file rỗng và file quá 25 MB bị từ chối; đúng 25 MB còn nhận", () => {
    expect(attachedFileProblem("waybill", { size: 0, type: MIME.pdf })).toBe(
      L.common.fileProblem.empty,
    );
    expect(
      attachedFileProblem("waybill", { size: SHIPPING_FILE_MAX_BYTES + 1, type: MIME.pdf }),
    ).toBe(L.common.fileProblem.tooLarge);
    expect(
      attachedFileProblem("pod", { size: SHIPPING_FILE_MAX_BYTES, type: MIME.pdf }),
    ).toBeNull();
  });
});

describe("attachedFileUploadError (không bao giờ hiện message tiếng Anh của máy chủ)", () => {
  it.each([
    ["waybill", 415, "UNSUPPORTED_MEDIA_TYPE", L.common.error.unsupportedType],
    ["waybill", 413, "PAYLOAD_TOO_LARGE", L.common.error.tooLarge],
    ["waybill", 400, "VALIDATION_FAILED", L.waybill.rejected],
    ["pod", 400, "VALIDATION_FAILED", L.pod.rejected],
    ["waybill", 429, "RATE_LIMITED", L.common.error.rateLimited],
    ["pod", 409, "CONFLICT", L.common.error.conflict],
    ["waybill", 409, "INVALID_LOAD_TRANSITION", L.waybill.stateConflict],
    ["pod", 409, "SHIPMENT_STATE_CONFLICT", L.pod.stateConflict],
    ["waybill", 404, "LOAD_NOT_FOUND", L.waybill.notFound],
    ["pod", 404, "SHIPMENT_NOT_FOUND", L.pod.notFound],
    ["pod", 403, "FORBIDDEN", L.common.error.forbidden],
    ["waybill", 403, "OUT_OF_DATA_SCOPE", L.common.error.forbidden],
    ["waybill", 0, "NETWORK_ERROR", L.common.error.network],
    ["pod", 500, "STORAGE_ERROR", L.common.error.unavailable],
    ["pod", 503, "SOMETHING_ELSE", L.common.error.unavailable],
    ["pod", 400, "SOMETHING_ELSE", L.common.error.unknown],
  ] as const)("%s · %d %s", (kind, status, code, message) => {
    expect(attachedFileUploadError(kind, apiError(status, code))).toBe(message);
  });

  it("mã trạng thái của loại file kia không có nghĩa ở đây → câu chung", () => {
    expect(attachedFileUploadError("pod", apiError(409, "INVALID_LOAD_TRANSITION"))).toBe(
      L.common.error.unknown,
    );
    expect(attachedFileUploadError("waybill", apiError(409, "SHIPMENT_STATE_CONFLICT"))).toBe(
      L.common.error.unknown,
    );
  });

  it("lỗi bước PUT lên kho: mất mạng khác bị từ chối; lỗi lạ → câu chung", () => {
    expect(attachedFileUploadError("pod", new DirectUploadError("network"))).toBe(
      L.common.error.network,
    );
    expect(attachedFileUploadError("pod", new DirectUploadError("refused", 403))).toBe(
      L.common.error.storageRefused,
    );
    expect(attachedFileUploadError("waybill", new Error("boom"))).toBe(L.common.error.unknown);
  });
});

describe("openDownloadLink", () => {
  afterEach(() => vi.restoreAllMocks());

  it("bấm một thẻ <a> tạm tới link, mở tab mới không gửi referrer, rồi gỡ thẻ", () => {
    const seen: { href: string; target: string; rel: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      seen.push({ href: this.href, target: this.target, rel: this.rel });
    });
    openDownloadLink("https://files.example/doc.pdf?sig=abc");
    expect(seen).toEqual([
      {
        href: "https://files.example/doc.pdf?sig=abc",
        target: "_blank",
        rel: "noopener noreferrer",
      },
    ]);
    expect(document.querySelector("a[href^='https://files.example']")).toBeNull();
  });
});
