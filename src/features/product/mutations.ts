import { createMutation } from "@/lib/api/query-factory";

import {
  createProduct,
  discontinueProduct,
  publishProduct,
  transitionProduct,
  unpublishProduct,
  updateProduct,
} from "./api";
import { deleteProduct, resumeProduct, suspendProduct } from "./lifecycle-api";
import { listingKeys } from "./listing-queries";
import { PRODUCT_HISTORY_ROOT, productKeys } from "./queries";

import type { CreateProductInput, UpdateProductInput } from "./schemas";
import type { Product } from "./types";
import type {
  DiscontinueProductInput,
  DiscontinueProductResult,
  TransitionProductInput,
} from "./api";

/** Revision của listing / giá = version của sản phẩm: mọi thay đổi sản phẩm làm cũ cả listing lẫn giá. */
const PRODUCT_AND_LISTING = [productKeys.all, listingKeys.all];

export const useCreateProduct = createMutation<CreateProductInput, Product>(createProduct, {
  invalidate: PRODUCT_AND_LISTING,
  showErrorToast: false,
  successMessage: "Tạo sản phẩm thành công",
});

export const useUpdateProduct = createMutation<{ id: string } & UpdateProductInput, Product>(
  updateProduct,
  {
    invalidate: PRODUCT_AND_LISTING,
    showErrorToast: false,
    successMessage: "Cập nhật sản phẩm thành công",
  },
);

export const useTransitionProduct = createMutation<TransitionProductInput, Product>(
  transitionProduct,
  {
    invalidate: PRODUCT_AND_LISTING,
    showErrorToast: false,
    successMessage: "Chuyển trạng thái sản phẩm thành công",
  },
);

export const useDiscontinueProduct = createMutation<
  DiscontinueProductInput,
  DiscontinueProductResult
>(discontinueProduct, {
  invalidate: PRODUCT_AND_LISTING,
  showErrorToast: false,
  successMessage: "Đã ngừng kinh doanh sản phẩm",
});

/** `productKeys.all` (`["products"]`) đã bao gồm lịch sử và danh sách chứng từ mở của sản phẩm. */
export const useSuspendProduct = createMutation<
  { id: string; reason: string; version: number },
  Product
>(suspendProduct, {
  invalidate: PRODUCT_AND_LISTING,
  showErrorToast: false,
  successMessage: "Đã tạm ngưng sản phẩm",
});

export const useResumeProduct = createMutation<{ id: string; version: number }, Product>(
  resumeProduct,
  {
    invalidate: PRODUCT_AND_LISTING,
    showErrorToast: false,
    successMessage: "Đã tiếp tục kinh doanh sản phẩm",
  },
);

export const useDeleteProduct = createMutation<{ id: string; version: number }, void>(
  deleteProduct,
  {
    invalidate: [productKeys.all, listingKeys.all, PRODUCT_HISTORY_ROOT, ["variants"]],
    showErrorToast: false,
    successMessage: "Đã xoá sản phẩm",
  },
);

export const usePublishProduct = createMutation<string, void>(publishProduct, {
  invalidate: PRODUCT_AND_LISTING,
  showErrorToast: false,
  successMessage: "Xuất bản sản phẩm thành công",
});

export const useUnpublishProduct = createMutation<string, void>(unpublishProduct, {
  invalidate: PRODUCT_AND_LISTING,
  showErrorToast: false,
  successMessage: "Gỡ xuất bản sản phẩm thành công",
});
