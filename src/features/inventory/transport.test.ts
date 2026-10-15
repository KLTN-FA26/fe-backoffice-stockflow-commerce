import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { INVENTORY_API, INVENTORY_ERROR_MESSAGES } from "@/constants/inventory";

import { api } from "@/lib/api/client";

import { approveAdjustment, listMovements } from "./api";
import { inventoryErrorView } from "./errors";
import { movementPageDto } from "./schemas";
import { inventoryEndpoint } from "./test-support";
import { inventoryRequest } from "./transport";

// The shared production client as-is: same-origin `/api` base (next.config.ts rewrites it to
// the backend `/api/v1`) and its own `{ success: true, data }` unwrapping. No test-only
// baseURL or response interceptor.
const server = setupServer();
const movements = inventoryEndpoint(INVENTORY_API.movements);
const page = {
  items: [],
  page: 1,
  size: 15,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: true,
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("backend inventory transport boundary", () => {
  it("calls the same-origin /api path and forwards zero-based paging and filters", async () => {
    expect(api.defaults.baseURL).toBe("/api");
    server.use(
      http.get(movements, ({ request }) => {
        const url = new URL(request.url);
        expect(url.pathname).toBe(`/api${INVENTORY_API.movements}`);
        expect(Object.fromEntries(url.searchParams)).toEqual({
          page: "1",
          size: "15",
          sku: "CUP-PP-500",
          location: "HCM-A01-1-A",
          type: "MOVE",
        });
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
      http.get(movements, () =>
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

  it("fails visibly if the enveloped data does not match the Inventory DTO", async () => {
    server.use(
      http.get(movements, () => HttpResponse.json({ success: true, data: { items: [] } })),
    );
    await expect(listMovements({ page: 0, size: 15 })).rejects.toMatchObject({
      status: 502,
      code: "INVALID_INVENTORY_CONTRACT",
    });
  });

  it("does not treat a failed envelope sent with HTTP 200 as valid data", async () => {
    server.use(http.get(movements, () => HttpResponse.json({ success: false, data: page })));
    await expect(listMovements({ page: 0, size: 15 })).rejects.toMatchObject({
      code: "INVALID_INVENTORY_CONTRACT",
    });
  });

  it("hands the mapper the backend errorCode, not just its English message", async () => {
    server.use(
      http.post(inventoryEndpoint(`${INVENTORY_API.adjustments}/:id/approval`), () =>
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
