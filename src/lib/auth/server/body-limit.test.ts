// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME } from "@/constants/auth";

import {
  DEFAULT_PROXY_BODY_LIMIT_BYTES as DEFAULT,
  PRODUCT_IMAGE_UPLOAD_LIMIT_BYTES as UPLOAD,
  requestBodyLimit,
} from "./body-limit";
import { backendProxyHandler } from "./handlers";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({ IS_MOCK: false }));

const origin = "https://backoffice.example.com";
const credential = "server-session-fixture";
const MEDIA = ["products", "p-1", "variants", "v-1", "media"];
const fetchMock = vi.fn<typeof fetch>();

/** A body delivered in chunks; `pulled` shows how far the reader actually got. */
function chunked(chunks: Uint8Array[], failAt?: number) {
  const state = { pulled: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (state.pulled === failAt) {
          controller.error(new Error("client aborted"));
          return;
        }
        const chunk = chunks[state.pulled];
        if (!chunk) return controller.close();
        state.pulled++;
        controller.enqueue(chunk);
      },
      cancel() {
        state.cancelled = true;
      },
      // No prefetch: `pulled` counts only chunks the handler actually read.
    },
    { highWaterMark: 0 },
  );
  return { stream, state };
}
const bytes = (size: number) => new Uint8Array(size).fill(0x61);
function proxy(
  method: string,
  paths: string[],
  body?: BodyInit,
  headers: Record<string, string> = {},
) {
  const init = {
    method,
    headers: { Origin: origin, Cookie: `${AUTH_COOKIE_NAME}=${credential}`, ...headers },
    body,
    duplex: "half" as const,
  };
  return backendProxyHandler(
    new NextRequest(`${origin}/api/backend/${paths.join("/")}`, init),
    paths,
  );
}
const sentBody = () => {
  const body = fetchMock.mock.calls[0][1]?.body;
  return body instanceof Uint8Array ? body : undefined;
};
async function expectTooLarge(response: Awaited<ReturnType<typeof proxy>>) {
  expect(response.status).toBe(413);
  expect(await response.json()).toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  expect(fetchMock).not.toHaveBeenCalled();
  // A request problem, not an authentication failure: the session cookie is left alone.
  expect(response.cookies.get(AUTH_COOKIE_NAME)).toBeUndefined();
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_URL", "http://backend.example.com/api/v1");
  vi.stubEnv("APP_ORIGIN", "");
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => Response.json({ ok: true }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("limit resolution uses only method + path", () => {
  it.each([
    ["POST", MEDIA, UPLOAD],
    ["PUT", MEDIA, DEFAULT],
    ["DELETE", MEDIA, DEFAULT],
    ["POST", [...MEDIA, "m-1"], DEFAULT],
    ["POST", ["products", "p-1", "variants", "v-1", "media", "publication"], DEFAULT],
    ["POST", ["products", "p-1", "variants"], DEFAULT],
    ["POST", ["designs"], DEFAULT],
  ])("%s %j → %i bytes", (method, paths, limit) => {
    expect(requestBodyLimit(method, paths)).toBe(limit);
  });
  it("limits are what the BE contracts allow", () => {
    expect(DEFAULT).toBe(1_048_576);
    expect(UPLOAD).toBe(10 * 1024 * 1024 + 64 * 1024);
  });
});

describe("default limit on JSON mutations", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "%s small JSON is forwarded byte-for-byte",
    async (m) => {
      const json = JSON.stringify({ note: "ghi chú", lines: [1, 2, 3] });
      const response = await proxy(m, ["purchase-orders"], json, {
        "Content-Type": "application/json",
      });
      expect(response.status).toBe(200);
      expect(new TextDecoder().decode(sentBody())).toBe(json);
      expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has("Content-Length")).toBe(false);
    },
  );
  it("exactly the limit passes, one more byte is 413 without calling Spring", async () => {
    expect((await proxy("POST", ["purchase-orders"], bytes(DEFAULT))).status).toBe(200);
    expect(sentBody()?.byteLength).toBe(DEFAULT);
    fetchMock.mockClear();
    await expectTooLarge(await proxy("POST", ["purchase-orders"], bytes(DEFAULT + 1)));
  });
  it("a JSON route does not get the upload limit even with a multipart Content-Type", async () => {
    await expectTooLarge(
      await proxy("POST", ["purchase-orders"], bytes(2 * 1024 * 1024), {
        "Content-Type": "multipart/form-data; boundary=x",
      }),
    );
  });
});

describe("Content-Length is a fast path only", () => {
  it("declared length above the limit is rejected before the body is read", async () => {
    const { stream, state } = chunked([bytes(16), bytes(16)]);
    await expectTooLarge(
      await proxy("POST", ["purchase-orders"], stream, { "Content-Length": String(DEFAULT + 1) }),
    );
    expect(state.pulled).toBe(0);
  });
  it.each([
    ["missing", {}],
    ["understated", { "Content-Length": "10" }],
    ["malformed", { "Content-Length": "abc" }],
    ["negative", { "Content-Length": "-1" }],
    ["list", { "Content-Length": "10, 10" }],
    ["hex", { "Content-Length": "0x10" }],
    ["exponent", { "Content-Length": "1e3" }],
  ])("%s Content-Length cannot bypass the streamed byte count", async (_name, headers) => {
    const half = DEFAULT / 2;
    const { stream } = chunked([bytes(half), bytes(half), bytes(1)]);
    await expectTooLarge(await proxy("POST", ["purchase-orders"], stream, headers));
  });
});

describe("streamed bodies are cut off at the threshold", () => {
  const third = Math.floor(DEFAULT * 0.4);
  it("two chunks under the limit are forwarded intact", async () => {
    const { stream } = chunked([bytes(third), bytes(third)]);
    expect((await proxy("POST", ["purchase-orders"], stream)).status).toBe(200);
    expect(sentBody()?.byteLength).toBe(2 * third);
  });
  it("the chunk that crosses the limit stops reading; later chunks are never pulled", async () => {
    const { stream, state } = chunked([bytes(third), bytes(third), bytes(third), bytes(third)]);
    await expectTooLarge(await proxy("POST", ["purchase-orders"], stream));
    expect(state.pulled).toBe(3);
    expect(state.cancelled).toBe(true);
  });
  it("a body stream that errors locally is 400 MALFORMED_REQUEST, not an upstream 502", async () => {
    const { stream } = chunked([bytes(8), bytes(8)], 1);
    const response = await proxy("POST", ["purchase-orders"], stream);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "MALFORMED_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("variant image upload keeps its own, narrow limit", () => {
  it("2 MiB is allowed on the upload route but not on a JSON route", async () => {
    expect((await proxy("POST", MEDIA, bytes(2 * 1024 * 1024))).status).toBe(200);
    fetchMock.mockClear();
    await expectTooLarge(await proxy("POST", ["products", "p-1"], bytes(2 * 1024 * 1024)));
  });
  it("upload limit passes, upload limit + 1 is 413", async () => {
    expect((await proxy("POST", MEDIA, bytes(UPLOAD))).status).toBe(200);
    fetchMock.mockClear();
    await expectTooLarge(await proxy("POST", MEDIA, bytes(UPLOAD + 1)));
  });
  it("the same media path with another method gets the default limit", async () => {
    await expectTooLarge(await proxy("PUT", [...MEDIA, "m-1"], bytes(2 * 1024 * 1024)));
  });
  it("a real multipart upload reaches Spring with body and boundary untouched", async () => {
    const image = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
    const form = new FormData();
    form.append("file", new File([image], "ảnh sản phẩm.png", { type: "image/png" }));
    const encoded = new Request("http://encode.local", { method: "POST", body: form });
    const contentType = encoded.headers.get("Content-Type") ?? "";
    const original = new Uint8Array(await encoded.arrayBuffer());
    const response = await proxy("POST", MEDIA, original, { "Content-Type": contentType });
    expect(response.status).toBe(200);
    expect(sentBody()).toEqual(original);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Content-Type")).toBe(contentType);
  });
});

describe("unchanged proxy behaviour around the limit", () => {
  it.each(["GET", "HEAD"])("%s is proxied without any body", async (method) => {
    const response = await proxy(method, ["purchase-orders"]);
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
  });
  it("a cross-site oversized POST is a CSRF 403 before any body is read", async () => {
    const { stream, state } = chunked([bytes(DEFAULT), bytes(DEFAULT)]);
    const response = await proxy("POST", ["purchase-orders"], stream, {
      Origin: "https://evil.example.com",
    });
    expect(response.status).toBe(403);
    expect(state.pulled).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("an unsafe path is rejected before any body is read", async () => {
    const { stream, state } = chunked([bytes(DEFAULT + 1)]);
    const response = await proxy("POST", ["identity", "auth", "login"], stream);
    expect(response.status).toBe(400);
    expect(state.pulled).toBe(0);
  });
  it("without a session cookie an oversized POST is 401 before any body is read", async () => {
    const { stream, state } = chunked([bytes(DEFAULT + 1)]);
    const response = await proxy("POST", ["purchase-orders"], stream, { Cookie: "" });
    expect(response.status).toBe(401);
    expect(state.pulled).toBe(0);
  });
});
