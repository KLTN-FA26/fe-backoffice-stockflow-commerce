import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import CanonicalSkuDetailPage from "@/app/admin/products/[id]/skus/[variantId]/page";
import { ADMIN_ROUTES } from "@/constants";
import { api } from "@/lib/api/client";

import { useCanonicalVariant } from "../variant-queries";
import { CanonicalSkuDetail } from "./CanonicalSkuDetail";
import { CanonicalVariantsSection } from "./CanonicalVariantsSection";

import type { ReactNode } from "react";

const access = vi.hoisted(() => ({ allowed: true, mock: false }));
vi.mock("@/lib/auth", () => ({ useCan: () => access.allowed }));
vi.mock("@/providers/app-providers", () => ({ useIsMock: () => access.mock }));

const productId = "11111111-1111-4111-8111-111111111111";
const variantId = "22222222-2222-4222-8222-222222222222";
const variant = {
  productId,
  variantId,
  sku: "CHAIR-BLUE",
  name: "Blue chair",
  status: "ACTIVE",
  defaultVariant: false,
  attributeSignature: "COLOR=BLUE",
  position: 0,
  version: 1,
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter hasMemory>{children}</NuqsTestingAdapter>
    </QueryClientProvider>
  );
}
let client: QueryClient;
afterEach(() => {
  cleanup();
  client?.clear();
  vi.restoreAllMocks();
  access.allowed = true;
  access.mock = false;
});
function prepare() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("canonical SKU route and navigation", () => {
  it("recovers identity from URL params with an empty cache on direct refresh", async () => {
    prepare();
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: variant });
    render(
      await CanonicalSkuDetailPage({ params: Promise.resolve({ id: productId, variantId }) }),
      { wrapper },
    );
    expect(await screen.findByText(variant.sku, { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText(productId)).toBeInTheDocument();
    expect(screen.getByText(variantId)).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toBe(`/products/${productId}/variants/${variantId}`);
    expect(screen.queryByText("Cài đặt mua hàng")).not.toBeInTheDocument();
  });
  it("reports mismatched identities without presenting the returned SKU", async () => {
    prepare();
    vi.spyOn(api, "get").mockResolvedValue({ data: { ...variant, productId: variantId } });
    render(<CanonicalSkuDetail productId={productId} variantId={variantId} />, { wrapper });
    expect(await screen.findByRole("alert")).toHaveTextContent("không khớp");
    expect(screen.queryByText(variant.sku)).not.toBeInTheDocument();
  });
  it("offers retry after a failed detail read", async () => {
    prepare();
    const get = vi
      .spyOn(api, "get")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: variant });
    render(<CanonicalSkuDetail productId={productId} variantId={variantId} />, { wrapper });
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText(variant.sku, { selector: "dd" })).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });
  it("keeps server totals and links canonical UUID pairs without fetching media", async () => {
    prepare();
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        items: [variant],
        page: 0,
        size: 15,
        totalElements: 61,
        totalPages: 5,
        hasNext: true,
        hasPrevious: false,
      },
    });
    render(<CanonicalVariantsSection productId={productId} />, { wrapper });
    const link = await screen.findByRole("link", { name: variant.sku });
    expect(link).toHaveAttribute(
      "href",
      ADMIN_ROUTES.products.canonicalSkuDetail(productId, variantId),
    );
    expect(screen.getByText("61 biến thể · trang 1/5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trang trước" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Trang sau" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        `/products/${productId}/variants`,
        expect.objectContaining({ params: { page: 1, size: 15 } }),
      ),
    );
  });
  it.each([
    ["", variantId],
    [productId, ""],
    [productId, "SKU-001-BLK-L"],
  ])("does not query without canonical identities (%s, %s)", async (p, v) => {
    prepare();
    const get = vi.spyOn(api, "get");
    const { result } = renderHook(() => useCanonicalVariant(p, v), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(get).not.toHaveBeenCalled();
  });
  it("does not read when Product READ is denied", () => {
    prepare();
    access.allowed = false;
    const get = vi.spyOn(api, "get");
    render(<CanonicalSkuDetail productId={productId} variantId={variantId} />, { wrapper });
    expect(screen.getByRole("alert")).toHaveTextContent("quyền");
    expect(get).not.toHaveBeenCalled();
  });
  it("does not manufacture canonical identity in application mock mode", () => {
    prepare();
    access.mock = true;
    const get = vi.spyOn(api, "get");
    render(<CanonicalSkuDetail productId={productId} variantId={variantId} />, { wrapper });
    expect(screen.getByRole("status")).toHaveTextContent("API Product/Variant thật");
    expect(get).not.toHaveBeenCalled();
  });
  it("keeps the legacy route builder independent", () => {
    expect(ADMIN_ROUTES.products.skuDetail("SKU-001-BLK-L")).toBe(
      "/admin/products/sku/SKU-001-BLK-L",
    );
  });
});
