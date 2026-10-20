import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { installApi, renderApp } from "../product-test-utils";
import { ProductListingSection } from "./ProductListingSection";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const listing = (over: Record<string, unknown> = {}) => ({
  productId: PRODUCT,
  slug: "ly-giay",
  seoTitle: "Ly giấy",
  seoDescription: null,
  revision: 3,
  projectedRevision: 3,
  published: false,
  projectionPending: false,
  ...over,
});

afterEach(() => vi.restoreAllMocks());

function setup(permissions: string[], data = listing(), put?: () => unknown) {
  return installApi({
    permissions,
    get: (url) => (url === `/products/${PRODUCT}/ecommerce` ? data : undefined),
    put: (url) =>
      url === `/products/${PRODUCT}/ecommerce`
        ? put
          ? put()
          : listing({ revision: 4 })
        : undefined,
  });
}

describe("ProductListingSection — GET/PUT /products/{id}/ecommerce", () => {
  it("hiện slug, SEO, trạng thái hiển thị; chỉ đọc thì không có nút sửa", async () => {
    setup([PRODUCT_PERMISSIONS.read]);
    renderApp(<ProductListingSection productId={PRODUCT} status="Approved" />);
    expect(await screen.findByText("ly-giay")).toBeInTheDocument();
    expect(screen.getByText("Chưa hiển thị")).toBeInTheDocument();
    expect(screen.getByText("Chưa đặt")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Sửa thông tin cửa hàng/ }),
    ).not.toBeInTheDocument();
  });

  it("projectionPending nhắc rằng thay đổi chưa lên cửa hàng", async () => {
    setup([], listing({ projectionPending: true }));
    renderApp(<ProductListingSection productId={PRODUCT} status="Published" />);
    expect(await screen.findByText(/đang được cập nhật lên cửa hàng/)).toBeInTheDocument();
  });

  it("sửa: slug xem trước dạng chuẩn hoá, gửi revision của lần đọc, SEO trống thì bỏ", async () => {
    const { put } = setup([PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update]);
    const user = userEvent.setup();
    renderApp(<ProductListingSection productId={PRODUCT} status="Approved" />);
    await user.click(await screen.findByRole("button", { name: /Sửa thông tin cửa hàng/ }));
    const dialog = await screen.findByRole("dialog", { name: "Thông tin cửa hàng" });
    const slug = within(dialog).getByLabelText(/Đường dẫn/);
    await user.clear(slug);
    await user.type(slug, "Ghế Xoay Đẹp!");
    expect(within(dialog).getByText("Sẽ lưu là: ghe-xoay-dep")).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Tiêu đề SEO"));
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(`/products/${PRODUCT}/ecommerce`, {
        revision: 3,
        slug: "Ghế Xoay Đẹp!",
        seoTitle: undefined,
        seoDescription: undefined,
      }),
    );
  });

  it("slug không còn chữ / số sau chuẩn hoá thì không lưu được", async () => {
    setup([PRODUCT_PERMISSIONS.update]);
    const user = userEvent.setup();
    renderApp(<ProductListingSection productId={PRODUCT} status="Approved" />);
    await user.click(await screen.findByRole("button", { name: /Sửa thông tin cửa hàng/ }));
    const dialog = await screen.findByRole("dialog", { name: "Thông tin cửa hàng" });
    const slug = within(dialog).getByLabelText(/Đường dẫn/);
    await user.clear(slug);
    await user.type(slug, "***");
    expect(within(dialog).getByText("Đường dẫn phải có chữ hoặc số")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Lưu" })).toBeDisabled();
  });

  it("slug đã có người dùng (CATALOG_SLUG_EXISTS) → báo trong hộp thoại bằng tiếng Việt", async () => {
    setup([PRODUCT_PERMISSIONS.update], listing(), () => {
      throw new ApiError(409, "CATALOG_SLUG_EXISTS", "taken");
    });
    const user = userEvent.setup();
    renderApp(<ProductListingSection productId={PRODUCT} status="Approved" />);
    await user.click(await screen.findByRole("button", { name: /Sửa thông tin cửa hàng/ }));
    const dialog = await screen.findByRole("dialog", { name: "Thông tin cửa hàng" });
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /Đường dẫn này đã được sản phẩm khác dùng/,
    );
  });

  it("CONFLICT giải thích cả ba nguyên nhân (revision lệch, đã ngừng kinh doanh, slug cố định sau khi xuất bản)", async () => {
    setup([PRODUCT_PERMISSIONS.update], listing(), () => {
      throw new ApiError(409, "CONFLICT", "Conflicting state");
    });
    const user = userEvent.setup();
    renderApp(<ProductListingSection productId={PRODUCT} status="Published" />);
    await user.click(await screen.findByRole("button", { name: /Sửa thông tin cửa hàng/ }));
    const dialog = await screen.findByRole("dialog", { name: "Thông tin cửa hàng" });
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(/người khác sửa/);
    expect(alert).toHaveTextContent(/ngừng kinh doanh/);
    expect(alert).toHaveTextContent(/từng xuất bản/);
  });

  it("sản phẩm đã ngừng kinh doanh: không có nút sửa dù có quyền", async () => {
    setup([PRODUCT_PERMISSIONS.update]);
    renderApp(<ProductListingSection productId={PRODUCT} status="Discontinued" />);
    await screen.findByText("ly-giay");
    expect(
      screen.queryByRole("button", { name: /Sửa thông tin cửa hàng/ }),
    ).not.toBeInTheDocument();
  });

  it("CONFLICT: lấy lại listing (và sản phẩm) để lần lưu sau mang revision đúng", async () => {
    let revision = 3;
    const { get } = installApi({
      permissions: [PRODUCT_PERMISSIONS.update],
      get: (url) => (url === `/products/${PRODUCT}/ecommerce` ? listing({ revision }) : undefined),
      put: () => {
        revision = 9;
        throw new ApiError(409, "CONFLICT", "Conflicting state");
      },
    });
    const user = userEvent.setup();
    renderApp(<ProductListingSection productId={PRODUCT} status="Approved" />);
    await user.click(await screen.findByRole("button", { name: /Sửa thông tin cửa hàng/ }));
    const dialog = await screen.findByRole("dialog", { name: "Thông tin cửa hàng" });
    const loads = () =>
      get.mock.calls.filter((c) => c[0] === `/products/${PRODUCT}/ecommerce`).length;
    expect(loads()).toBe(1);
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(loads()).toBe(2));
    // Lần lưu kế tiếp mang revision mới.
    const put = vi.mocked((await import("@/lib/api/client")).api.put);
    put.mockResolvedValueOnce({ data: listing({ revision: 10 }) });
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await waitFor(() =>
      expect(put).toHaveBeenLastCalledWith(
        `/products/${PRODUCT}/ecommerce`,
        expect.objectContaining({ revision: 9 }),
      ),
    );
  });
});
