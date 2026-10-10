import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CanonicalSkuDetailPage from "@/app/admin/products/[id]/skus/[variantId]/page";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { INVENTORY_CONTROL_TEXT as text } from "../inventory-control/constants";
import { inventoryControlKeys, useInventoryControl } from "../inventory-control/queries";
import { InventoryControlSection } from "./InventoryControlSection";

import type { ReactNode } from "react";

const access = vi.hoisted(() => ({ allowed: true, mock: false }));
vi.mock("@/lib/auth", () => ({ useCan: () => access.allowed }));
vi.mock("@/providers/app-providers", () => ({ useIsMock: () => access.mock }));
const identity = {
  productId: "11111111-1111-4111-8111-111111111111",
  variantId: "22222222-2222-4222-8222-222222222222",
  sku: "CHAIR-BLUE",
};
const response = {
  skuId: identity.variantId,
  sku: identity.sku,
  unitOfMeasure: "EACH",
  version: 7,
  removalStrategy: "FIFO",
  trackingMode: "NONE",
  expiryTracked: false,
  usableOnHand: 12,
};
let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function show() {
  return render(<InventoryControlSection identity={identity} />, { wrapper });
}
function field(label: string) {
  return screen.getByText(label, { selector: "dt" }).nextElementSibling;
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
  access.allowed = true;
  access.mock = false;
});

describe("Inventory Control read-only section", () => {
  it("shows initial loading and then the accepted policy", async () => {
    let resolve: ((value: { data: typeof response }) => void) | undefined;
    vi.spyOn(api, "get").mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    show();
    expect(screen.getByRole("status", { name: text.loading })).toBeInTheDocument();
    await act(async () => resolve?.({ data: response }));
    expect(await screen.findByText("Nhập trước, xuất trước (FIFO)")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: text.save })).not.toBeInTheDocument();
  });
  it("renders zero, false, and returned evaluation separately without recalculation", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        ...response,
        reorderPoint: 0,
        safetyStock: 0,
        maxShelfLifeDays: 0,
        reorderRequired: true,
        belowSafetyStock: false,
      },
    });
    show();
    await screen.findByText("Nhập trước, xuất trước (FIFO)");
    expect(field(text.reorderPoint)).toHaveTextContent(/^0$/);
    expect(field(text.safetyStock)).toHaveTextContent(/^0$/);
    expect(field(text.maxShelfLifeDays)).toHaveTextContent("0 ngày");
    expect(field(text.expiryTracked)).toHaveTextContent(text.no);
    expect(field(text.reorderRequired)).toHaveTextContent(text.yes);
    expect(field(text.belowSafetyStock)).toHaveTextContent(text.no);
    expect(
      within(screen.getByRole("region", { name: text.evaluation })).getByText("12 EACH"),
    ).toBeInTheDocument();
  });
  it("distinguishes unconfigured policy from unknown evaluation", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: response });
    show();
    await screen.findByText("Nhập trước, xuất trước (FIFO)");
    expect(screen.getAllByText(text.unconfigured)).toHaveLength(3);
    expect(screen.getAllByText(text.unknown)).toHaveLength(2);
  });
  it("reports API failure and retries the exact read", async () => {
    const get = vi
      .spyOn(api, "get")
      .mockRejectedValueOnce(new ApiError(500, "FAILED", "failure"))
      .mockResolvedValueOnce({ data: response });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent(text.failed);
    await userEvent.click(screen.getByRole("button", { name: text.retry }));
    await screen.findByText("Nhập trước, xuất trước (FIFO)");
    expect(get).toHaveBeenCalledTimes(2);
  });
  it("reports parser failure instead of presenting an empty policy", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { ...response, trackingMode: "UNKNOWN" } });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent(text.malformed);
    expect(screen.queryByText(text.unconfigured)).not.toBeInTheDocument();
  });
  it("reports server permission denial", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new ApiError(403, "FORBIDDEN", "denied"));
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent(text.denied);
  });
  it("does not request policy without Product READ", () => {
    access.allowed = false;
    const get = vi.spyOn(api, "get");
    show();
    expect(screen.getByRole("alert")).toHaveTextContent(text.denied);
    expect(get).not.toHaveBeenCalled();
  });
  it("does not create a mock policy or call HTTP in application mock mode", () => {
    access.mock = true;
    const get = vi.spyOn(api, "get");
    show();
    expect(screen.getByRole("status")).toHaveTextContent(text.mockUnavailable);
    expect(get).not.toHaveBeenCalled();
  });
  it("reports paused/offline status and resumes when online", async () => {
    onlineManager.setOnline(false);
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: response });
    show();
    expect(screen.getByRole("status")).toHaveTextContent(text.paused);
    expect(get).not.toHaveBeenCalled();
    await act(async () => onlineManager.setOnline(true));
    await screen.findByText("Nhập trước, xuất trước (FIFO)");
  });
  it.each([
    ["", identity.variantId],
    [identity.productId, ""],
    [identity.productId, identity.sku],
  ])("disables the query for missing/noncanonical identity (%s, %s)", (p, v) => {
    const get = vi.spyOn(api, "get");
    const { result } = renderHook(() => useInventoryControl(p, v), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(get).not.toHaveBeenCalled();
  });
  it("owns stable keys that distinguish Product and Variant", () => {
    const key = inventoryControlKeys.detail(identity.productId, identity.variantId);
    expect(key).toEqual(
      inventoryControlKeys.detail(
        identity.productId.toUpperCase(),
        identity.variantId.toUpperCase(),
      ),
    );
    expect(key).not.toEqual(inventoryControlKeys.detail(identity.variantId, identity.productId));
    expect(key).not.toEqual(inventoryControlKeys.detail(identity.productId, identity.productId));
  });
  it("recovers the canonical direct route and supplies validated identities without legacy/list/media/Procurement reads", async () => {
    const get = vi.spyOn(api, "get").mockImplementation(async (path) => ({
      data: String(path).endsWith("inventory-control")
        ? response
        : {
            ...identity,
            name: "Blue chair",
            status: "ACTIVE",
            defaultVariant: false,
            attributeSignature: "COLOR=BLUE",
            position: 0,
            version: 1,
          },
    }));
    render(
      await CanonicalSkuDetailPage({
        params: Promise.resolve({ id: identity.productId, variantId: identity.variantId }),
      }),
      { wrapper },
    );
    await screen.findByText("Nhập trước, xuất trước (FIFO)");
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenNthCalledWith(
      1,
      `/products/${identity.productId}/variants/${identity.variantId}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      `/products/${identity.productId}/skus/${identity.variantId}/inventory-control`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByText(identity.sku, { selector: "dd" })).toBeInTheDocument();
    expect(screen.queryByText("Cài đặt mua hàng")).not.toBeInTheDocument();
  });
});
