/**
 * Tạo / thay giá riêng của khách. Thành công: ghi bản BE trả về vào khoá chi tiết (huỷ lần đọc đang
 * chạy trước, để bản cũ không ghi đè) và làm mới danh sách của ĐÚNG khách đó — khách khác không bị đụng.
 * Lỗi dữ liệu cũ (`isStaleCustomerPriceError`) tải lại giá của khách trước khi tới `onError` của màn hình.
 * Không toast lỗi ở đây: màn hình hiện lỗi (`customerPriceErrorMessage` / `customerPriceFieldErrors`).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { createCustomerPrice, updateCustomerPrice } from "./api";
import { isStaleCustomerPriceError } from "./errors";
import { customerPriceKeys } from "./queries";

import type { MutationHook } from "@/lib/api/stale-refetch";
import type { CreateCustomerPriceInput, UpdateCustomerPriceInput } from "./api";
import type { CustomerPrice } from "./schemas";

function priceMutation<TInput extends CreateCustomerPriceInput>(
  fn: (input: TInput) => Promise<CustomerPrice>,
): MutationHook<TInput, CustomerPrice> {
  const useBase: MutationHook<TInput, CustomerPrice> = (options) => {
    const queryClient = useQueryClient();
    const { onSuccess, ...rest } = options ?? {};
    return useMutation({
      ...rest,
      mutationFn: fn,
      onSuccess: async (saved, variables, ...args) => {
        const detail = customerPriceKeys.detail(variables.customerId, saved.sku);
        await queryClient.cancelQueries({ queryKey: detail });
        queryClient.setQueryData<CustomerPrice>(detail, (current) =>
          current !== undefined && current.version > saved.version ? current : saved,
        );
        void queryClient.invalidateQueries({
          queryKey: customerPriceKeys.lists(variables.customerId),
        });
        return onSuccess?.(saved, variables, ...args);
      },
    });
  };
  return withStaleRefetch(
    useBase,
    (input: TInput) => [customerPriceKeys.customer(input.customerId)],
    isStaleCustomerPriceError,
  );
}

export const useCreateCustomerPrice = priceMutation<CreateCustomerPriceInput>(createCustomerPrice);
export const useUpdateCustomerPrice = priceMutation<UpdateCustomerPriceInput>(updateCustomerPrice);
