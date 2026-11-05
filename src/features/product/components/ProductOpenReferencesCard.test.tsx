import { act, screen, within } from "@testing-library/react";
import { focusManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS, PRODUCT_STATUS, UI_LABELS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { installApi, renderApp } from "../product-test-utils";
import { ProductOpenReferencesCard } from "./ProductOpenReferencesCard";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ProductStatus } from "@/features/product";

const L = UI_LABELS.product.openReferences;
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const url = `/products/${PRODUCT}/open-references`;
const role = (...codes: PermissionCode[]) => {
  const granted = new Set(codes);
  return (code: PermissionCode) => granted.has(code);
};
/** Người giữ quyền ngừng kinh doanh (product-lifecycle:APPROVE, BE #123 — lifecycle.ts). */
const APPROVER = role(PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.lifecycle);
/** E-commerce Admin: duyệt / xuất bản nhưng không quyết ngừng kinh doanh (BE #123). */
const ECOMMERCE_ADMIN = role(PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.approve);
const CATALOG_EDITOR = role(PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update);

const references = {
  references: [
    { kind: "PURCHASE_ORDER_LINE", documentNumber: "PO-1", documentId: "p1", sku: "CUP-12OZ" },
    { kind: "SALES_ORDER_LINE", documentNumber: "ORD-9", documentId: "o9", sku: "CUP-16OZ" },
  ],
  truncated: false,
};

afterEach(() => {
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
});

function renderCard(status: ProductStatus, can = APPROVER, data: unknown = references) {
  const { get } = installApi({ permissions: [], get: (u) => (u === url ? data : undefined) });
  renderApp(<ProductOpenReferencesCard productId={PRODUCT} status={status} can={can} />);
  return () => get.mock.calls.some(([u]) => u === url);
}

describe("ProductOpenReferencesCard — chứng từ còn mở luôn hiện ở cột phải", () => {
  it.each([
    PRODUCT_STATUS.APPROVED,
    PRODUCT_STATUS.PUBLISHED,
    PRODUCT_STATUS.INACTIVE,
    PRODUCT_STATUS.DISCONTINUED,
  ])("%s: liệt kê dòng đơn mua / đơn bán còn mở tham chiếu SKU", async (status) => {
    renderCard(status);
    expect(screen.getByRole("heading", { name: new RegExp(L.title) })).toBeInTheDocument();
    expect(await screen.findByText("PO-1")).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(within(list).getByText("ORD-9")).toBeInTheDocument();
    expect(within(list).getByText(/Dòng đơn mua/)).toBeInTheDocument();
    expect(within(list).getByText(/Dòng đơn bán/)).toBeInTheDocument();
  });

  it.each([PRODUCT_STATUS.DRAFT, PRODUCT_STATUS.PENDING_APPROVAL])(
    "%s (chưa duyệt): không hiện thẻ, không gọi BE",
    (status) => {
      const called = renderCard(status);
      expect(screen.queryByText(L.title)).not.toBeInTheDocument();
      expect(called()).toBe(false);
    },
  );

  it("không giữ quyền ngừng kinh doanh: không hiện thẻ, không gọi BE (cùng gate hộp thoại)", () => {
    const called = renderCard(PRODUCT_STATUS.PUBLISHED, CATALOG_EDITOR);
    expect(screen.queryByText(L.title)).not.toBeInTheDocument();
    expect(called()).toBe(false);
  });

  it("E-commerce Admin (chỉ product-products:APPROVE): không hiện thẻ, không gọi BE", () => {
    const called = renderCard(PRODUCT_STATUS.PUBLISHED, ECOMMERCE_ADMIN);
    expect(screen.queryByText(L.title)).not.toBeInTheDocument();
    expect(called()).toBe(false);
  });

  it("không còn chứng từ mở: câu trống riêng", async () => {
    renderCard(PRODUCT_STATUS.APPROVED, APPROVER, { references: [], truncated: false });
    expect(await screen.findByText(L.empty)).toBeInTheDocument();
  });

  it("quay về tab không gọi lại BE (truy vấn nặng — thẻ dùng lại dữ liệu vừa tải)", async () => {
    renderCard(PRODUCT_STATUS.PUBLISHED);
    expect(await screen.findByText("PO-1")).toBeInTheDocument();
    const calls = () => vi.mocked(api.get).mock.calls.filter(([u]) => u === url).length;
    expect(calls()).toBe(1);
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await act(async () => {});
    expect(calls()).toBe(1);
  });

  it("tải lỗi: báo lỗi trong thẻ, không làm hỏng trang", async () => {
    installApi({
      permissions: [],
      get: (u) => {
        if (u === url) throw new ApiError(500, "INTERNAL", "boom");
        return undefined;
      },
    });
    renderApp(
      <ProductOpenReferencesCard
        productId={PRODUCT}
        status={PRODUCT_STATUS.APPROVED}
        can={APPROVER}
      />,
    );
    expect(await screen.findByText(L.loadFailed)).toBeInTheDocument();
  });
});
