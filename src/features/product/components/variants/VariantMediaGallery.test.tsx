import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS } from "@/constants";

import { installApi, renderApp } from "../../product-test-utils";
import { VariantMediaGallery } from "./VariantMediaGallery";

const PRODUCT = "p-1";
const VARIANT = "v-1";
const MEDIA_PATH = `/products/${PRODUCT}/variants/${VARIANT}/media`;

const image = (mediaId: string, published: boolean) => ({
  mediaId,
  variantId: VARIANT,
  kind: "IMAGE",
  url: `https://cdn.test/${mediaId}.webp`,
  originalName: `${mediaId}.png`,
  renditions: [],
  sortOrder: 0,
  primary: false,
  published,
  version: 1,
});

afterEach(() => vi.restoreAllMocks());

function setup() {
  return installApi({
    permissions: [PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.approve],
    get: (url) => (url === MEDIA_PATH ? [image("m-pub", true), image("m-new", false)] : undefined),
    post: (url) => (url === `${MEDIA_PATH}/m-pub/withdrawal` ? image("m-pub", false) : undefined),
  });
}

describe("VariantMediaGallery — gỡ ảnh tách khỏi xuất bản (BE ProductMediaService.withdraw)", () => {
  it("SP Nháp / Tạm ngưng: không xuất bản được nhưng vẫn gỡ ảnh đang bán", async () => {
    const { post } = setup();
    renderApp(
      <VariantMediaGallery
        productId={PRODUCT}
        variantId={VARIANT}
        canUpload={false}
        canManage={false}
        canPublish={false}
        canWithdraw
      />,
    );
    const withdraw = await screen.findByRole("button", { name: "Gỡ khỏi cửa hàng" });
    expect(screen.queryByRole("checkbox", { name: /để xuất bản/ })).not.toBeInTheDocument();

    await userEvent.setup().click(withdraw);
    expect(post).toHaveBeenCalledWith(`${MEDIA_PATH}/m-pub/withdrawal`);
  });

  it("SP chờ duyệt / ngừng kinh doanh: không gỡ, không xuất bản", async () => {
    setup();
    renderApp(
      <VariantMediaGallery
        productId={PRODUCT}
        variantId={VARIANT}
        canUpload={false}
        canManage={false}
        canPublish={false}
        canWithdraw={false}
      />,
    );
    expect(await screen.findAllByText("Đã xuất bản")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Gỡ khỏi cửa hàng" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /để xuất bản/ })).not.toBeInTheDocument();
  });

  it("SP đã duyệt: chọn ảnh riêng tư để xuất bản", async () => {
    setup();
    renderApp(
      <VariantMediaGallery
        productId={PRODUCT}
        variantId={VARIANT}
        canUpload={false}
        canManage={false}
        canPublish
        canWithdraw
      />,
    );
    expect(
      await screen.findByRole("checkbox", { name: "Chọn ảnh m-new.png để xuất bản" }),
    ).toBeInTheDocument();
  });
});

// BE `ProductMediaService.delete` / `describe` (đặt ảnh bìa) chỉ `requireChangeable`; chỉ `upload` chặn
// biến thể OBSOLETE (`requireAcceptsImages`).
describe("VariantMediaGallery — biến thể ngừng dùng: không tải ảnh mới, vẫn xoá / đặt ảnh bìa", () => {
  it("canUpload false + canManage: có Xoá ảnh và Đặt làm ảnh bìa, không có ô tải lên", async () => {
    setup();
    renderApp(
      <VariantMediaGallery
        productId={PRODUCT}
        variantId={VARIANT}
        canUpload={false}
        canManage
        canPublish={false}
        canWithdraw={false}
      />,
    );
    expect(await screen.findAllByRole("button", { name: "Xoá ảnh" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Đặt làm ảnh bìa" })).toHaveLength(2);
    expect(screen.queryByLabelText("Chọn ảnh để tải lên")).not.toBeInTheDocument();
  });
});
