import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INVENTORY_API,
  INVENTORY_ERROR_MESSAGES,
  INVENTORY_LABELS,
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_TYPES,
} from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import { useAuthStore } from "@/lib/auth/auth-store";

import { inventoryEndpoint, inventoryPermissions } from "../test-support";
import { MovementHistory } from "./MovementHistory";

const server = setupServer();
const endpoint = inventoryEndpoint(INVENTORY_API.movements);
const emptyPage = {
  items: [],
  page: 0,
  size: 15,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({
    user: {
      userId: crypto.randomUUID(),
      fullName: "Test actor",
      email: "actor@example.test",
      roles: ["Warehouse Staff"],
      warehouseIds: [],
    },
    impersonatedRole: null,
  });
  server.use(inventoryPermissions([INVENTORY_PERMISSIONS.movementRead]));
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function renderHistory(searchParams = "", onUrlUpdate = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NuqsTestingAdapter searchParams={searchParams} hasMemory onUrlUpdate={onUrlUpdate}>
      <QueryClientProvider client={client}>
        <MovementHistory />
      </QueryClientProvider>
    </NuqsTestingAdapter>,
  );
  return onUrlUpdate;
}

describe("movement ledger screen", () => {
  it("loads shared URL filters and sends the actual zero-based page", async () => {
    const requestSeen = vi.fn();
    server.use(
      http.get(endpoint, ({ request }) => {
        const url = new URL(request.url);
        requestSeen({
          sku: url.searchParams.get("sku"),
          location: url.searchParams.get("location"),
          type: url.searchParams.get("type"),
          page: url.searchParams.get("page"),
        });
        return HttpResponse.json({
          success: true,
          data: { ...emptyPage, page: 1, hasPrevious: true },
        });
      }),
    );
    renderHistory("?sku=CUP-PP-500&location=HCM-A01-1-A&type=MOVE&page=2");
    expect(await screen.findByText(INVENTORY_LABELS.noResults)).toBeInTheDocument();
    expect(requestSeen).toHaveBeenCalledWith({
      sku: "CUP-PP-500",
      location: "HCM-A01-1-A",
      type: "MOVE",
      page: "1",
    });
    expect(screen.getByLabelText(INVENTORY_LABELS.sku)).toHaveValue("CUP-PP-500");
  });

  it("changes type in URL and resets the page before the server request", async () => {
    const pages = vi.fn();
    server.use(
      http.get(endpoint, ({ request }) => {
        pages(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json({ success: true, data: emptyPage });
      }),
    );
    const updates = renderHistory("?page=3");
    await screen.findByText(INVENTORY_LABELS.noMovements);
    await userEvent.selectOptions(
      screen.getByLabelText(INVENTORY_LABELS.movementType),
      "ADJUSTMENT",
    );
    await waitFor(() => expect(updates).toHaveBeenCalled());
    expect(updates.mock.lastCall?.[0].searchParams.get("type")).toBe("ADJUSTMENT");
    await waitFor(() => expect(pages).toHaveBeenLastCalledWith("0"));
  });

  it("uses backend hasNext rather than current-page row count", async () => {
    const pages = vi.fn();
    server.use(
      http.get(endpoint, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        pages(page);
        return HttpResponse.json({
          success: true,
          data: {
            ...emptyPage,
            page,
            totalElements: 30,
            totalPages: 2,
            hasNext: page === 0,
            hasPrevious: page > 0,
          },
        });
      }),
    );
    renderHistory();
    await screen.findByText(INVENTORY_LABELS.noMovements);
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.next }));
    await waitFor(() => expect(pages).toHaveBeenLastCalledWith(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: INVENTORY_LABELS.next })).toBeDisabled(),
    );
  });

  it("shows a recoverable error and retries", async () => {
    let attempts = 0;
    server.use(
      http.get(endpoint, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json(
              {
                success: false,
                errorCode: "SERVER_ERROR",
                message: "Temporary failure",
                correlationId: "ledger-test",
              },
              { status: 500 },
            )
          : HttpResponse.json({ success: true, data: emptyPage });
      }),
    );
    renderHistory();
    expect(await screen.findByText(INVENTORY_ERROR_MESSAGES.server)).toBeInTheDocument();
    expect(screen.queryByText("Temporary failure")).not.toBeInTheDocument();
    expect(screen.getByText(/ledger-test/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.retry }));
    expect(await screen.findByText(INVENTORY_LABELS.noMovements)).toBeInTheDocument();
  });

  it("a formerly privileged role without movement READ is denied and nothing is fetched", async () => {
    const ledger = vi.fn();
    useAuthStore.setState({ impersonatedRole: "Warehouse Manager" });
    server.use(
      inventoryPermissions(
        [
          INVENTORY_PERMISSIONS.adjustmentRead,
          INVENTORY_PERMISSIONS.adjustmentApprove,
          INVENTORY_PERMISSIONS.stockUpdate,
        ],
        ["WAREHOUSE_MANAGER"],
      ),
      http.get(endpoint, () => {
        ledger();
        return HttpResponse.json({ success: true, data: emptyPage });
      }),
    );
    renderHistory();
    expect(await screen.findByText(INVENTORY_LABELS.denied)).toBeInTheDocument();
    expect(screen.queryByLabelText(INVENTORY_LABELS.sku)).not.toBeInTheDocument();
    expect(ledger).not.toHaveBeenCalled();
  });

  it("a non-allowlisted role with movement READ opens the ledger", async () => {
    useAuthStore.setState({ impersonatedRole: "Sales Staff" });
    server.use(
      inventoryPermissions([INVENTORY_PERMISSIONS.movementRead], ["SALES_STAFF"]),
      http.get(endpoint, () => HttpResponse.json({ success: true, data: emptyPage })),
    );
    renderHistory();
    expect(await screen.findByText(INVENTORY_LABELS.noMovements)).toBeInTheDocument();
    expect(screen.getByLabelText(INVENTORY_LABELS.sku)).toBeInTheDocument();
  });

  it("renders current and unknown movement types without losing the page", async () => {
    const row = {
      sku: "CUP-PP-500",
      quantity: 4,
      occurredAt: "2026-10-11T00:00:00Z",
    };
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json({
          success: true,
          data: {
            ...emptyPage,
            items: [
              {
                ...row,
                movementId: crypto.randomUUID(),
                type: "STATUS_CHANGE",
                fromLocation: "HCM-A01-1-A",
                status: "INBOUND",
                toStatus: "QUARANTINE",
                referenceType: "QC_INSPECTION",
              },
              {
                ...row,
                movementId: crypto.randomUUID(),
                type: "FUTURE_MOVEMENT_TYPE",
                status: null,
                referenceType: "PICK_LINE",
              },
            ],
            totalElements: 20,
            totalPages: 2,
            hasNext: true,
          },
        }),
      ),
    );
    renderHistory();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText(STOCK_MOVEMENT_LABELS.STATUS_CHANGE)).toBeInTheDocument();
    expect(within(table).getByText("FUTURE_MOVEMENT_TYPE")).toBeInTheDocument();
    expect(within(table).getByText("PICK_LINE")).toBeInTheDocument();
    expect(screen.queryByText(INVENTORY_LABELS.loadError)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: INVENTORY_LABELS.next })).toBeEnabled();
  });

  it("offers exactly the backend movement types and sends the chosen one", async () => {
    const types = vi.fn();
    server.use(
      http.get(endpoint, ({ request }) => {
        types(new URL(request.url).searchParams.get("type"));
        return HttpResponse.json({ success: true, data: emptyPage });
      }),
    );
    renderHistory();
    await screen.findByText(INVENTORY_LABELS.noMovements);
    const select = screen.getByLabelText(INVENTORY_LABELS.movementType);
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(["", ...STOCK_MOVEMENT_TYPES]);
    await userEvent.selectOptions(select, "PUT_BACK");
    await waitFor(() => expect(types).toHaveBeenLastCalledWith("PUT_BACK"));
  });
});
