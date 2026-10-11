import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { INVENTORY_API } from "@/constants/inventory";

import { api } from "@/lib/api/client";

import { listMovements } from "./api";
import { movementPageDto } from "./schemas";
import { inventoryRequest } from "./transport";

const server = setupServer();
const originalBaseUrl = api.defaults.baseURL;
const page = {
  items: [],
  page: 1,
  size: 15,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: true,
};

beforeAll(() => {
  api.defaults.baseURL = "http://localhost/api";
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  api.defaults.baseURL = originalBaseUrl;
});

describe("backend inventory transport boundary", () => {
  it("unwraps actual PageResponse and forwards zero-based pagination and filters", async () => {
    server.use(
      http.get("http://localhost/api/v1/inventory/movements", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("page")).toBe("1");
        expect(url.searchParams.get("size")).toBe("15");
        expect(url.searchParams.get("sku")).toBe("CUP-PP-500");
        expect(url.searchParams.get("location")).toBe("HCM-A01-1-A");
        expect(url.searchParams.get("type")).toBe("MOVE");
        return HttpResponse.json({ success: true, data: page });
      }),
    );
    expect(
      await listMovements({
        page: 1,
        size: 15,
        sku: "CUP-PP-500",
        location: "HCM-A01-1-A",
        type: "MOVE",
      }),
    ).toEqual(page);
  });

  it("preserves backend code, per-field validation and support correlation ID", async () => {
    server.use(
      http.get("http://localhost/api/v1/inventory/movements", () =>
        HttpResponse.json(
          {
            success: false,
            errorCode: "VALIDATION_FAILED",
            message: "Invalid location",
            fieldErrors: [{ field: "locationCode", message: "Unknown location", code: "NotFound" }],
            correlationId: "contract-test",
          },
          { status: 422 },
        ),
      ),
    );
    await expect(
      inventoryRequest({ url: INVENTORY_API.movements }, movementPageDto),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_FAILED",
      traceId: "contract-test",
      fieldErrors: { locationCode: "Unknown location" },
    });
  });

  it("fails visibly if a response does not match the agreed envelope", async () => {
    server.use(
      http.get("http://localhost/api/v1/inventory/movements", () => HttpResponse.json(page)),
    );
    await expect(listMovements({ page: 0, size: 15 })).rejects.toMatchObject({
      status: 502,
      code: "INVALID_INVENTORY_CONTRACT",
    });
  });

  it("does not treat a failed success-status envelope as valid data", async () => {
    server.use(
      http.get("http://localhost/api/v1/inventory/movements", () =>
        HttpResponse.json({ success: false, data: page }),
      ),
    );
    await expect(listMovements({ page: 0, size: 15 })).rejects.toMatchObject({
      code: "INVALID_INVENTORY_CONTRACT",
    });
  });
});
