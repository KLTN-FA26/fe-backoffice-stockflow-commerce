/**
 * Mock của ảnh riêng sản phẩm (ADR-0012, `/products/{id}/image`) và ảnh trong mô tả (ADR-0013,
 * `/products/{id}/description-images`). Mock không có kho ảnh: xem trước bằng object URL của chính file vừa chọn.
 */
import { registerMockRoute } from "./mock-adapter";
import { recordMockHistory } from "./mock-product-history";
import { findMockProduct, mockProductAcceptsChanges } from "./mock-product-store";
import {
  bodyOf as body,
  fail,
  noContent,
  ok,
  pathParams as params,
  text,
} from "./mock-route-utils";

import type { AxiosRequestConfig } from "axios";

interface MockProductImage {
  productId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  storedAt: string;
  altText: string | null;
  url: string | null;
}

const images = new Map<string, MockProductImage>();

const productNotFound = () => fail(404, "PRODUCT_NOT_FOUND", "Product not found");
const noImage = () => fail(404, "MEDIA_NOT_FOUND", "Product has no image");
const notChangeable = () =>
  fail(409, "INVALID_PRODUCT_STATUS_TRANSITION", "The product takes no change in its status");

function fileOf(config: AxiosRequestConfig): File | null {
  const file = config.data instanceof FormData ? config.data.get("file") : null;
  return file instanceof File ? file : null;
}

function objectUrl(file: File | null): string | null {
  return file && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
}

/** BE `ProductImageResponse`: link xem chỉ có ở GET (`withLinks`). */
function toResponse(image: MockProductImage, withLinks: boolean) {
  return {
    productId: image.productId,
    originalName: image.originalName,
    contentType: image.contentType,
    sizeBytes: image.sizeBytes,
    storedAt: image.storedAt,
    altText: image.altText,
    renditions: [
      {
        edge: 768,
        width: 768,
        height: 768,
        contentType: "image/webp",
        sizeBytes: 1,
        url: withLinks ? image.url : null,
      },
    ],
  };
}

/** Sản phẩm tồn tại và đang nhận thay đổi (không chờ duyệt, không ngừng kinh doanh). */
async function changeable(config: AxiosRequestConfig) {
  const product = await findMockProduct(params(config).id ?? "");
  if (!product) return { error: productNotFound() };
  if (!mockProductAcceptsChanges(product)) return { error: notChangeable() };
  return { product };
}

export function registerProductImageMockRoutes(): void {
  registerMockRoute("GET", "/products/:id/image", async (config) => {
    const product = await findMockProduct(params(config).id ?? "");
    if (!product) return productNotFound();
    const image = images.get(product.productId);
    return image ? ok(toResponse(image, true)) : noImage();
  });

  registerMockRoute("PUT", "/products/:id/image", async (config) => {
    const { product, error } = await changeable(config);
    if (!product) return error;
    const file = fileOf(config);
    const altText = config.data instanceof FormData ? text(config.data.get("altText")) : "";
    const image: MockProductImage = {
      productId: product.productId,
      originalName: file?.name ?? "upload.jpg",
      contentType: file?.type || "image/jpeg",
      sizeBytes: file?.size || 1,
      storedAt: new Date().toISOString(),
      altText: altText || null,
      url: objectUrl(file),
    };
    images.set(product.productId, image);
    recordMockHistory(product.productId, "UPDATED", { changedFields: ["image"] });
    return ok(toResponse(image, false));
  });

  registerMockRoute("PATCH", "/products/:id/image", async (config) => {
    const { product, error } = await changeable(config);
    if (!product) return error;
    const image = images.get(product.productId);
    if (!image) return noImage();
    const altText = text(body(config).altText) || null;
    if (altText !== image.altText) {
      image.altText = altText;
      recordMockHistory(product.productId, "UPDATED", { changedFields: ["imageAltText"] });
    }
    return ok(toResponse(image, false));
  });

  registerMockRoute("DELETE", "/products/:id/image", async (config) => {
    const { product, error } = await changeable(config);
    if (!product) return error;
    if (images.delete(product.productId)) {
      recordMockHistory(product.productId, "UPDATED", { changedFields: ["image"] });
    }
    return noContent();
  });

  registerMockRoute("POST", "/products/:id/description-images", async (config) => {
    const { product, error } = await changeable(config);
    if (!product) return error;
    const url = objectUrl(fileOf(config)) ?? "https://cdn.example.test/product-images/mock.jpg";
    return ok(
      { url, width: 768, height: 768, renditions: [{ edge: 768, width: 768, height: 768, url }] },
      201,
    );
  });
}

/** Cho test: xoá ảnh đã lưu giữa các ca. */
export function resetProductImageMockStore(): void {
  images.clear();
}
