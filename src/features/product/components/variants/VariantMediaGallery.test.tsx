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

// BE `ProductMediaService.publish`: người tải ảnh lên không tự xuất bản được (409 SELF_APPROVAL_NOT_ALLOWED).
// `uploadedBy` của BE là username.
describe("VariantMediaGallery — duyệt bốn mắt: người tải lên không được chọn ảnh của mình để xuất bản", () => {
  // `renderApp` signs in as username "test".
  function setupUploadedBy(uploadedBy: string) {
    installApi({
      permissions: [PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.approve],
      get: (url) => (url === MEDIA_PATH ? [{ ...image("m-new", false), uploadedBy }] : undefined),
    });
  }

  const gallery = (
    <VariantMediaGallery
      productId={PRODUCT}
      variantId={VARIANT}
      canUpload={false}
      canManage={false}
      canPublish
      canWithdraw={false}
    />
  );

  it("ảnh do chính mình tải: không có ô chọn, có câu nói người khác cần xuất bản", async () => {
    setupUploadedBy("test");
    renderApp(gallery);
    expect(await screen.findByText(/người khác cần xuất bản/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /để xuất bản/ })).not.toBeInTheDocument();
  });

  it("ảnh do người khác tải: chọn được để xuất bản", async () => {
    setupUploadedBy("admin");
    renderApp(gallery);
    expect(
      await screen.findByRole("checkbox", { name: "Chọn ảnh m-new.png để xuất bản" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/người khác cần xuất bản/)).not.toBeInTheDocument();
  });
});

describe("VariantMediaGallery — thẻ nhỏ cột phải: trạng thái là chấm màu, không phải nhãn chữ che ảnh", () => {
  it("compact: tên trạng thái chỉ ở tooltip / screen reader", async () => {
    installApi({
      permissions: [PRODUCT_PERMISSIONS.read],
      get: (url) =>
        url === MEDIA_PATH ? [{ ...image("m-new", false), primary: true }] : undefined,
    });
    renderApp(
      <VariantMediaGallery
        productId={PRODUCT}
        variantId={VARIANT}
        canUpload={false}
        canManage={false}
        canPublish={false}
        canWithdraw={false}
        compact
      />,
    );
    const label = await screen.findByText("Ảnh bìa, riêng tư");
    expect(label).toHaveClass("sr-only");
    expect(screen.getByTitle("Ảnh bìa, riêng tư")).toBeInTheDocument();
    expect(screen.queryByText("Riêng tư")).not.toBeInTheDocument();
  });
});

describe("VariantMediaGallery — tên người tải lên / xuất bản (issue #286)", () => {
  const gallery = (
    <VariantMediaGallery
      productId={PRODUCT}
      variantId={VARIANT}
      canUpload={false}
      canManage={false}
      canPublish={false}
      canWithdraw={false}
    />
  );

  it("hiện uploadedByName / publishedByName thay id người dùng", async () => {
    installApi({
      permissions: [PRODUCT_PERMISSIONS.read],
      get: (url) =>
        url === MEDIA_PATH
          ? [
              {
                ...image("m-pub", true),
                uploadedBy: "u-1111",
                uploadedByName: "Nguyễn Thị Lan",
                publishedBy: "u-2222",
                publishedByName: "Trần Minh Quang",
              },
            ]
          : undefined,
    });
    renderApp(gallery);
    expect(
      await screen.findByText("Tải lên: Nguyễn Thị Lan · Xuất bản: Trần Minh Quang"),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/u-1111|u-2222/);
  });

  it("BE chưa gửi tên: không hiện id / username thô; ảnh riêng tư không có dòng xuất bản", async () => {
    installApi({
      permissions: [PRODUCT_PERMISSIONS.read],
      get: (url) =>
        url === MEDIA_PATH
          ? [
              { ...image("m-new", false), uploadedBy: "u-3333", uploadedByName: "Lê Văn Bình" },
              { ...image("m-old", false), uploadedBy: "u-4444" },
            ]
          : undefined,
    });
    renderApp(gallery);
    expect(await screen.findByText("Tải lên: Lê Văn Bình")).toBeInTheDocument();
    expect(screen.queryByText(/Xuất bản:/)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/u-3333|u-4444/);
  });
});
