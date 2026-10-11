import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_API, INVENTORY_LABELS } from "@/constants/inventory";

import { useAuthStore } from "@/lib/auth/auth-store";

import { inventoryEndpoint } from "../test-support";
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
    expect(await screen.findByText("Temporary failure")).toBeInTheDocument();
    expect(screen.getByText(/ledger-test/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.retry }));
    expect(await screen.findByText(INVENTORY_LABELS.noMovements)).toBeInTheDocument();
  });

  it("does not query inventory for an unauthorized role", () => {
    useAuthStore.setState({ impersonatedRole: "Sales Staff" });
    renderHistory();
    expect(screen.getByText(INVENTORY_LABELS.denied)).toBeInTheDocument();
    expect(screen.queryByLabelText(INVENTORY_LABELS.sku)).not.toBeInTheDocument();
  });
});
