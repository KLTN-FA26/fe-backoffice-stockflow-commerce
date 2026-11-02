import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { readBlobErrorBody } from "./blob-error";
import { api } from "./client";
import { ApiError } from "./error";

import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";

const jsonBlob = (body: unknown) => new Blob([JSON.stringify(body)], { type: "application/json" });

describe("readBlobErrorBody", () => {
  it("Blob JSON → object; không phải Blob → giữ nguyên; Blob không phải JSON → undefined", async () => {
    expect(await readBlobErrorBody(jsonBlob({ errorCode: "X" }))).toEqual({ errorCode: "X" });
    expect(await readBlobErrorBody({ errorCode: "Y" })).toEqual({ errorCode: "Y" });
    expect(await readBlobErrorBody(new Blob(["%PDF-1.4"]))).toBeUndefined();
  });
});

describe("client — lỗi của request tải file (responseType blob)", () => {
  const failWith =
    (status: number, data: unknown): AxiosAdapter =>
    async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config, undefined, {
        status,
        statusText: "",
        data,
        headers: new AxiosHeaders(),
        config,
      });
    };

  it("422 dạng Blob JSON → ApiError mang errorCode và fieldErrors của BE", async () => {
    const body = {
      success: false,
      errorCode: "STOCK_PACKAGE_LABELS_TOO_MANY",
      message: "At most 500",
      fieldErrors: [{ field: "lpns", message: "too many", code: "STOCK_PACKAGE_LABELS_TOO_MANY" }],
    };
    const error = await api
      .post(
        "/inventory/stock-packages/labels",
        {},
        {
          responseType: "blob",
          adapter: failWith(422, jsonBlob(body)),
        },
      )
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: "STOCK_PACKAGE_LABELS_TOO_MANY",
      fieldCodes: { lpns: "STOCK_PACKAGE_LABELS_TOO_MANY" },
    });
  });

  it("lỗi JSON thường không đổi", async () => {
    const error = await api
      .post("/x", {}, { adapter: failWith(409, { errorCode: "INVALID_RECEIPT_TRANSITION" }) })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: "INVALID_RECEIPT_TRANSITION" });
  });
});
