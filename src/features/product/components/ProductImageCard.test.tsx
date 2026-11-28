import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { installApi, renderApp } from "../product-test-utils";
import { ProductImageCard } from "./ProductImageCard";

const PRODUCT = "p-1";
const IMAGE_PATH = `/products/${PRODUCT}/image`;

const image = {
  productId: PRODUCT,
  originalName: "ly.png",
  contentType: "image/png",
  sizeBytes: 10,
  storedAt: "2026-11-27T00:00:00Z",
  altText: "Mặt trước",
  renditions: [
    {
      edge: 768,
      width: 768,
      height: 768,
      contentType: "image/webp",
      sizeBytes: 1,
      url: "https://cdn.test/a.webp",
    },
  ],
};

afterEach(() => vi.restoreAllMocks());

function setup(current: typeof image | null) {
  return installApi({
    permissions: [PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update],
    get: (url) => {
      if (url !== IMAGE_PATH) return undefined;
      if (!current) throw new ApiError(404, "MEDIA_NOT_FOUND", "Product has no image");
      return current;
    },
    put: (url) => (url === IMAGE_PATH ? { ...image, renditions: [] } : undefined),
    delete: (url) => (url === IMAGE_PATH ? null : undefined),
  });
}

describe("ProductImageCard — ảnh riêng của sản phẩm (ADR-0012)", () => {
  it("chưa có ảnh: báo chưa có, nút Tải ảnh lên gửi PUT multipart", async () => {
    const { put } = setup(null);
    const { container } = renderApp(<ProductImageCard productId={PRODUCT} canEdit />);
    expect(await screen.findByText("Chưa có ảnh sản phẩm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải ảnh lên" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gỡ ảnh" })).not.toBeInTheDocument();

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("no file input");
    await userEvent.setup().upload(input, new File(["x"], "ly.png", { type: "image/png" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(IMAGE_PATH, expect.any(FormData), expect.anything()),
    );
  });

  it("có ảnh: hiện ảnh và chữ thay thế; Gỡ ảnh cần xác nhận rồi gửi DELETE", async () => {
    const { del } = setup(image);
    renderApp(<ProductImageCard productId={PRODUCT} canEdit />);
    expect(await screen.findByRole("img", { name: "Mặt trước" })).toHaveAttribute(
      "src",
      "https://cdn.test/a.webp",
    );
    expect(screen.getByRole("button", { name: "Thay ảnh" })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Gỡ ảnh" }));
    expect(del).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Gỡ ảnh", hidden: false }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(IMAGE_PATH));
  });

  it("không có quyền sửa / sản phẩm không nhận thay đổi: chỉ xem, không có nút nào", async () => {
    setup(image);
    renderApp(<ProductImageCard productId={PRODUCT} canEdit={false} />);
    expect(await screen.findByRole("img", { name: "Mặt trước" })).toBeInTheDocument();
    expect(screen.getByText("Chữ thay thế: Mặt trước")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Thay ảnh|Tải ảnh lên|Gỡ ảnh/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
