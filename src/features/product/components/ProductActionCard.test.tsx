import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS, PRODUCT_STATUS, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";

import { ProductActionCard } from "./ProductActionCard";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { Product } from "@/features/product";

const L = UI_LABELS.product;
const role = (...codes: PermissionCode[]) => {
  const granted = new Set(codes);
  return (code: PermissionCode) => granted.has(code);
};
/** Seed BE: ECOMMERCE_ADMIN sửa, duyệt và xoá nháp sản phẩm. */
const ECOMMERCE_ADMIN = role(
  PRODUCT_PERMISSIONS.read,
  PRODUCT_PERMISSIONS.update,
  PRODUCT_PERMISSIONS.approve,
  PRODUCT_PERMISSIONS.delete,
);
/** Người soạn catalog: sửa nội dung, không duyệt. */
const CATALOG_EDITOR = role(PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update);
/** Người duyệt: duyệt / xuất bản, không sửa nội dung, không tạm ngưng (BE #123). */
const APPROVER = role(PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.approve);
/** System Admin: duyệt / xuất bản + tạm ngưng / tiếp tục / ngừng (product-lifecycle:APPROVE). */
const SYSTEM_ADMIN = role(
  PRODUCT_PERMISSIONS.read,
  PRODUCT_PERMISSIONS.approve,
  PRODUCT_PERMISSIONS.lifecycle,
);
const VIEWER = role(PRODUCT_PERMISSIONS.read);

const product = (status: Product["status"], over: Partial<Product> = {}): Product => ({
  productId: "product-1",
  code: "PRD-1",
  name: "Ly giấy",
  nameEn: "Paper cup",
  type: "Standard",
  categoryId: null,
  status,
  version: 3,
  description: "",
  descriptionEn: "",
  images: [],
  taxClass: "standard",
  brand: "Brand",
  createdAt: "2026-01-01T00:00:00Z",
  createdBy: "tester",
  submittedBy: "u-author",
  ...over,
});

function renderCard(
  value: Product,
  can: (code: PermissionCode) => boolean,
  currentUserId = "u-reviewer",
) {
  const onAction = vi.fn();
  render(
    <ProductActionCard
      product={value}
      can={can}
      currentUserId={currentUserId}
      isPending={false}
      onAction={onAction}
    />,
  );
  return onAction;
}

const buttonNames = () => screen.queryAllByRole("button").map((b) => b.textContent?.trim());

describe("ProductActionCard — nút theo trạng thái × vai trò (allowedProductActions)", () => {
  it("Nháp + người soạn catalog: Chỉnh sửa + Gửi duyệt, không Xoá (thiếu quyền DELETE)", async () => {
    const onAction = renderCard(product(PRODUCT_STATUS.DRAFT), CATALOG_EDITOR);
    expect(screen.getByRole("link", { name: L.actionCard.edit })).toHaveAttribute(
      "href",
      "/admin/products/product-1/edit",
    );
    expect(buttonNames()).toEqual(["Gửi duyệt"]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Gửi duyệt" }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ code: "submit" }));
  });

  it("Nháp + ECOMMERCE_ADMIN: có Xoá sản phẩm, nút huỷ giữ chữ đỏ khi hover", () => {
    renderCard(product(PRODUCT_STATUS.DRAFT), ECOMMERCE_ADMIN);
    const remove = screen.getByRole("button", { name: "Xoá sản phẩm" });
    expect(remove).toHaveClass("text-danger", "hover:text-danger");
    expect(screen.getByRole("button", { name: "Gửi duyệt" })).not.toHaveClass("text-danger");
  });

  it("Chờ duyệt + người duyệt: Phê duyệt và Từ chối, không Chỉnh sửa", () => {
    renderCard(product(PRODUCT_STATUS.PENDING_APPROVAL), APPROVER);
    expect(buttonNames()).toEqual(["Phê duyệt", "Từ chối"]);
    expect(screen.queryByRole("link", { name: L.actionCard.edit })).not.toBeInTheDocument();
    expect(screen.getByText(L.actionCard.draftOnly)).toBeInTheDocument();
  });

  it("Chờ duyệt + chính người gửi duyệt: không tự phê duyệt (bốn mắt), vẫn Từ chối được", () => {
    renderCard(product(PRODUCT_STATUS.PENDING_APPROVAL), ECOMMERCE_ADMIN, "u-author");
    expect(buttonNames()).toEqual(["Từ chối"]);
  });

  it("Chờ duyệt + người soạn catalog: không có thao tác nào, có câu giải thích", () => {
    renderCard(product(PRODUCT_STATUS.PENDING_APPROVAL), CATALOG_EDITOR);
    expect(buttonNames()).toEqual([]);
    expect(screen.getByText(L.actionCard.noActions)).toBeInTheDocument();
  });

  it("Đã xuất bản + System Admin: Gỡ xuất bản, Tạm ngưng, Ngừng kinh doanh", () => {
    renderCard(product(PRODUCT_STATUS.PUBLISHED), SYSTEM_ADMIN);
    expect(buttonNames()).toEqual(["Gỡ xuất bản", "Tạm ngưng", "Ngừng kinh doanh"]);
  });

  it("Đã xuất bản + E-commerce Admin (product-products:APPROVE): chỉ Gỡ xuất bản (BE #123)", () => {
    renderCard(product(PRODUCT_STATUS.PUBLISHED), ECOMMERCE_ADMIN);
    expect(buttonNames()).toEqual(["Gỡ xuất bản"]);
  });

  it("chỉ quyền xem: không nút nào, không link sửa", () => {
    renderCard(product(PRODUCT_STATUS.DRAFT), VIEWER);
    expect(buttonNames()).toEqual([]);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(L.actionCard.noActions)).toBeInTheDocument();
  });

  it("Tạm ngưng: hiện nhãn trạng thái tiếng Việt, lý do + thời điểm tạm ngưng; Tiếp tục kinh doanh", () => {
    renderCard(
      product(PRODUCT_STATUS.INACTIVE, {
        suspendedAt: "2026-02-01T03:00:00Z",
        suspendReason: "Đợi lô hàng mới",
      }),
      SYSTEM_ADMIN,
    );
    expect(screen.getByText("Tạm ngưng")).toBeInTheDocument();
    expect(screen.getByText(L.statusReason.suspendReason)).toBeInTheDocument();
    expect(screen.getByText("Đợi lô hàng mới")).toBeInTheDocument();
    expect(screen.getByText(formatDateTime("2026-02-01T03:00:00Z"))).toBeInTheDocument();
    expect(buttonNames()).toEqual(["Tiếp tục kinh doanh", "Ngừng kinh doanh"]);
  });

  it("Ngừng kinh doanh (terminal): không nút mutating nào, hiện lý do ngừng", () => {
    renderCard(
      product(PRODUCT_STATUS.DISCONTINUED, {
        discontinuedAt: "2026-03-01T03:00:00Z",
        discontinueReason: "Hết mẫu",
      }),
      ECOMMERCE_ADMIN,
    );
    expect(buttonNames()).toEqual([]);
    expect(screen.getByText(L.statusReason.discontinueReason)).toBeInTheDocument();
    expect(screen.getByText("Hết mẫu")).toBeInTheDocument();
  });
});
