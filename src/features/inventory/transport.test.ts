import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { INVENTORY_API, INVENTORY_ERROR_MESSAGES } from "@/constants/inventory";

import { approveAdjustment, listMovements } from "./api";
import { inventoryErrorView } from "./errors";
import { movementPageDto } from "./schemas";
import { installInventoryTestApiContract } from "./test-api-contract";
import { inventoryRequest } from "./transport";

const server = setupServer();
let restoreApiContract: () => void;
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
  restoreApiContract = installInventoryTestApiContract();
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  restoreApiContract();
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

  it("accepts data already unwrapped by the shared client", async () => {
    server.use(
      http.get("http://localhost/api/v1/inventory/movements", () => HttpResponse.json(page)),
    );
    expect(await listMovements({ page: 0, size: 15 })).toEqual(page);
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

  it("fails visibly if unwrapped data does not match the Inventory DTO", async () => {
    server.use(
      http.get("http://localhost/api/v1/inventory/movements", () =>
        HttpResponse.json({ items: [] }),
      ),
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

  it("hands the mapper the backend errorCode, not just its English message", async () => {
    server.use(
      http.post("http://localhost/api/v1/inventory/adjustments/:id/approval", () =>
        HttpResponse.json(
          {
            success: false,
            errorCode: "INVENTORY_POLICY_STOCK_CONFLICT",
            message: "Existing stock is incompatible with this policy",
            correlationId: "policy-trace",
          },
          { status: 409 },
        ),
      ),
    );
    const failure = await approveAdjustment(crypto.randomUUID()).catch((error: unknown) => error);
    expect(failure).toMatchObject({ status: 409, code: "INVENTORY_POLICY_STOCK_CONFLICT" });
    expect(inventoryErrorView(failure)).toEqual({
      kind: "conflict",
      title: expect.any(String),
      detail: INVENTORY_ERROR_MESSAGES.policyConflict,
      traceId: "policy-trace",
    });
  });
});
