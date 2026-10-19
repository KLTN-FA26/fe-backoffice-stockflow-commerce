import { useQueryClient } from "@tanstack/react-query";

import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import {
  createProduct,
  discontinueProduct,
  publishProduct,
  transitionProduct,
  unpublishProduct,
  updateProduct,
} from "./api";
import { isStaleAttributeError } from "./attribute-errors";
import { attributeKeys } from "./attribute-queries";
import { deleteProduct, resumeProduct, suspendProduct } from "./lifecycle-api";
import { listingKeys } from "./listing-queries";
import { PRODUCT_HISTORY_ROOT, productKeys } from "./queries";
import { isStaleProductError } from "./transition-errors";
import { variantKeys } from "./variant-queries";

import type { MutationHook } from "@/lib/api/stale-refetch";
import type { CreateProductInput, UpdateProductInput } from "./schemas";
import type { Product } from "./types";
import type {
  DiscontinueProductInput,
  DiscontinueProductResult,
  TransitionProductInput,
} from "./api";

/** Revision của listing / giá = version của sản phẩm: mọi thay đổi sản phẩm làm cũ cả listing lẫn giá. */
const PRODUCT_AND_LISTING = [productKeys.all, listingKeys.all];
/**
 * Duyệt / ngừng kinh doanh đổi luôn trạng thái biến thể ở BE: `ProductServiceImpl.approve` →
 * `variants.activateDrafts` (Nháp → Đang dùng), `discontinue` → `variants.obsoleteAll`.
 */
const WITH_VARIANTS = [...PRODUCT_AND_LISTING, variantKeys.all];
/** Mọi danh sách sản phẩm (`productKeys.list(params)` = `["products", "list", params]`). */
const PRODUCT_LISTS = [...productKeys.all, "list"] as const;

/**
 * Mutation vòng đời: 409 OPTIMISTIC_LOCK / INVALID_PRODUCT_STATUS_TRANSITION (`isStaleProductError`)
 * → tải lại chi tiết sản phẩm, để nút hiện đúng trạng thái thật và lần sau gửi đúng `version`.
 */
const lifecycle = <TInput extends string | { id: string }, TResult>(
  useBase: MutationHook<TInput, TResult>,
) =>
  withStaleRefetch(
    useBase,
    (input: TInput) => [productKeys.detail(typeof input === "string" ? input : input.id)],
    isStaleProductError,
  );

// Tạo kèm trục mà thuộc tính / giá trị vừa bị xoá → câu lỗi nói "Đã tải lại": tải lại từ điển của form.
export const useCreateProduct = withStaleRefetch(
  createMutation<CreateProductInput, Product>(createProduct, {
    invalidate: PRODUCT_AND_LISTING,
    showErrorToast: false,
    successMessage: "Tạo sản phẩm thành công",
  }),
  [attributeKeys.all],
  isStaleAttributeError,
);

export const useUpdateProduct = createMutation<{ id: string } & UpdateProductInput, Product>(
  updateProduct,
  {
    invalidate: PRODUCT_AND_LISTING,
    showErrorToast: false,
    successMessage: "Cập nhật sản phẩm thành công",
  },
);

// Gửi duyệt / duyệt / từ chối chung một hook; chỉ duyệt đổi biến thể nhưng làm mới chung cho gọn.
export const useTransitionProduct = lifecycle(
  createMutation<TransitionProductInput, Product>(transitionProduct, {
    invalidate: WITH_VARIANTS,
    showErrorToast: false,
    successMessage: "Chuyển trạng thái sản phẩm thành công",
  }),
);

export const useDiscontinueProduct = lifecycle(
  createMutation<DiscontinueProductInput, DiscontinueProductResult>(discontinueProduct, {
    invalidate: WITH_VARIANTS,
    showErrorToast: false,
    successMessage: "Đã ngừng kinh doanh sản phẩm",
  }),
);

/** `productKeys.all` (`["products"]`) đã bao gồm lịch sử và danh sách chứng từ mở của sản phẩm. */
export const useSuspendProduct = lifecycle(
  createMutation<{ id: string; reason: string; version: number }, Product>(suspendProduct, {
    invalidate: PRODUCT_AND_LISTING,
    showErrorToast: false,
    successMessage: "Đã tạm ngưng sản phẩm",
  }),
);

export const useResumeProduct = lifecycle(
  createMutation<{ id: string; version: number }, Product>(resumeProduct, {
    invalidate: PRODUCT_AND_LISTING,
    showErrorToast: false,
    successMessage: "Đã tiếp tục kinh doanh sản phẩm",
  }),
);

type DeleteProductInput = { id: string; version: number };

/** Khoá của một sản phẩm đã xoá: chi tiết, lịch sử, biến thể / trục / ảnh, listing / giá. */
const deletedProductKeys = (id: string) => [
  productKeys.detail(id),
  [...PRODUCT_HISTORY_ROOT, id],
  variantKeys.product(id),
  listingKeys.product(id),
];

/**
 * Xoá nháp (BE `ProductService.deleteDraft`, xoá hẳn): BỎ bản đã xoá khỏi cache thay vì làm mới —
 * làm mới chi tiết đang mount sẽ gọi lại ra 404 trước khi rời trang, còn giữ cache thì Back hiện
 * lại sản phẩm đã xoá. Chỉ danh sách sản phẩm được làm mới.
 */
function withDeletedProductDropped(
  useBase: MutationHook<DeleteProductInput, void>,
): MutationHook<DeleteProductInput, void> {
  return function useDropDeletedProduct(options) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onSuccess: (...args) => {
        for (const queryKey of deletedProductKeys(args[1].id)) {
          queryClient.removeQueries({ queryKey });
        }
        options?.onSuccess?.(...args);
      },
    });
  };
}

export const useDeleteProduct = lifecycle(
  withDeletedProductDropped(
    createMutation<DeleteProductInput, void>(deleteProduct, {
      invalidate: [PRODUCT_LISTS],
      showErrorToast: false,
      successMessage: "Đã xoá sản phẩm",
    }),
  ),
);

export const usePublishProduct = lifecycle(
  createMutation<string, void>(publishProduct, {
    invalidate: PRODUCT_AND_LISTING,
    showErrorToast: false,
    successMessage: "Xuất bản sản phẩm thành công",
  }),
);

export const useUnpublishProduct = lifecycle(
  createMutation<string, void>(unpublishProduct, {
    invalidate: PRODUCT_AND_LISTING,
    showErrorToast: false,
    successMessage: "Gỡ xuất bản sản phẩm thành công",
  }),
);
