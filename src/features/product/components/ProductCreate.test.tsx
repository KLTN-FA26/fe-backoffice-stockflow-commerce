import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_STATUS } from "@/constants";

import type { Product } from "@/features/product";

const { useProductMock, useUpdateProductMock, pushMock } = vi.hoisted(() => ({
  useProductMock: vi.fn(),
  useUpdateProductMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/auth/components/Can", () => ({
  useCan: () => true,
}));

vi.mock("@/providers/app-providers", () => ({
  useIsMock: () => false,
}));

vi.mock("@/features/product", async () => {
  const actual = await vi.importActual<typeof import("@/features/product")>("@/features/product");
  return {
    ...actual,
    useProduct: useProductMock,
    useCategories: () => ({ data: { items: [] }, isLoading: false }),
    useCreateProduct: () => ({ isPending: false, mutate: vi.fn() }),
    useUpdateProduct: useUpdateProductMock,
  };
});

vi.mock("./ProductMasterFields", () => ({
  ProductMasterFields: ({
    form,
  }: {
    form: { register: (name: "name") => Record<string, unknown> };
  }) => <input aria-label="product name" {...form.register("name")} />,
}));

vi.mock("./ProductFormNavigation", () => ({
  ProductFormBackLink: () => <span>back</span>,
  ProductFormForbidden: () => <span>forbidden</span>,
}));

import { ProductCreate } from "./ProductCreate";

const product = (name: string): Product => ({
  productId: "product-1",
  code: "PRD-1",
  name,
  nameEn: "Product",
  slug: "prd-1",
  type: "Standard",
  categoryId: null,
  status: PRODUCT_STATUS.DRAFT,
  description: "",
  descriptionEn: "",
  images: [],
  basePrice: 0,
  attributes: [],
  taxClass: "standard",
  uom: "pcs",
  brand: "Brand",
  createdAt: "2026-01-01T00:00:00Z",
  createdBy: "tester",
});

describe("ProductCreate server-data hydration", () => {
  const queryState = {
    data: product("Server name"),
    isLoading: false,
    isError: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryState.data = product("Server name");
    useProductMock.mockReturnValue(queryState);
    useUpdateProductMock.mockReturnValue({ isPending: false, mutate: vi.fn() });
  });

  it("hydrates the initial server product into the form", async () => {
    render(<ProductCreate productId="product-1" />);

    expect(await screen.findByDisplayValue("Server name")).toBeInTheDocument();
  });

  it("updates a pristine form when the server data changes", async () => {
    const view = render(<ProductCreate productId="product-1" />);
    await screen.findByDisplayValue("Server name");

    queryState.data = product("Refetched name");
    view.rerender(<ProductCreate productId="product-1" />);

    expect(await screen.findByDisplayValue("Refetched name")).toBeInTheDocument();
  });

  it("does not overwrite dirty local input when the query refetches", async () => {
    const user = userEvent.setup();
    const view = render(<ProductCreate productId="product-1" />);
    const input = await screen.findByDisplayValue("Server name");

    await user.clear(input);
    await user.type(input, "Local draft");
    queryState.data = product("New server name");
    view.rerender(<ProductCreate productId="product-1" />);

    await waitFor(() => expect(input).toHaveValue("Local draft"));
  });

  it("resets to the saved server product before navigating after a successful save", async () => {
    let success: ((saved: Product) => void) | undefined;
    useUpdateProductMock.mockImplementation((options: { onSuccess: (saved: Product) => void }) => {
      success = options.onSuccess;
      return { isPending: false, mutate: vi.fn() };
    });

    render(<ProductCreate productId="product-1" />);
    const input = await screen.findByDisplayValue("Server name");
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, "Local draft");

    success?.(product("Saved name"));

    await waitFor(() => expect(input).toHaveValue("Saved name"));
    expect(pushMock).toHaveBeenCalledWith("/admin/products/product-1");
  });
});
