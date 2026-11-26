/**
 * Tạo / thay / xoá giá chuẩn. Thành công: ghi bản BE trả về vào khoá chi tiết (huỷ lần đọc đang chạy trước, để bản cũ
 * không ghi đè) và làm mới danh sách. Lỗi dữ liệu cũ (`isStaleStandardPriceError`) tải lại giá chuẩn trước khi tới
 * `onError` của màn hình. Không toast lỗi ở đây: màn hình hiện lỗi (`standardPriceErrorMessage` / field errors).
 * Báo giá không cần làm mới: kiểm tra giá của bản nháp đọc lại giá chuẩn mỗi lần BE dựng báo giá.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { createStandardPrice, deleteStandardPrice, updateStandardPrice } from "./api";
import { isStaleStandardPriceError } from "./errors";
import { standardPriceKeys } from "./queries";

import type { MutationHook } from "@/lib/api/stale-refetch";
import type {
  CreateStandardPriceInput,
  DeleteStandardPriceInput,
  UpdateStandardPriceInput,
} from "./api";
import type { StandardPrice } from "./schemas";

const STALE = [standardPriceKeys.all] as const;

function priceMutation<TInput extends CreateStandardPriceInput>(
  fn: (input: TInput) => Promise<StandardPrice>,
): MutationHook<TInput, StandardPrice> {
  const useBase: MutationHook<TInput, StandardPrice> = (options) => {
    const queryClient = useQueryClient();
    const { onSuccess, ...rest } = options ?? {};
    return useMutation({
      ...rest,
      mutationFn: fn,
      onSuccess: async (saved, variables, ...args) => {
        const detail = standardPriceKeys.detail(saved.sku);
        await queryClient.cancelQueries({ queryKey: detail });
        queryClient.setQueryData<StandardPrice>(detail, (current) =>
          current !== undefined && current.version > saved.version ? current : saved,
        );
        void queryClient.invalidateQueries({ queryKey: standardPriceKeys.lists() });
        return onSuccess?.(saved, variables, ...args);
      },
    });
  };
  return withStaleRefetch(useBase, STALE, isStaleStandardPriceError);
}

export const useCreateStandardPrice = priceMutation<CreateStandardPriceInput>(createStandardPrice);
export const useUpdateStandardPrice = priceMutation<UpdateStandardPriceInput>(updateStandardPrice);

const useDeleteBase: MutationHook<DeleteStandardPriceInput, void> = (options) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options ?? {};
  return useMutation({
    ...rest,
    mutationFn: deleteStandardPrice,
    onSuccess: async (result, variables, ...args) => {
      queryClient.removeQueries({ queryKey: standardPriceKeys.detail(variables.sku) });
      await queryClient.invalidateQueries({ queryKey: standardPriceKeys.lists() });
      return onSuccess?.(result, variables, ...args);
    },
  });
};

export const useDeleteStandardPrice = withStaleRefetch(
  useDeleteBase,
  STALE,
  isStaleStandardPriceError,
);
