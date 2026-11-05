import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import {
  attributeKeys,
  useDeleteAttribute,
  useDeleteAttributeValue,
  useReplaceCategoryAttributes,
} from "./attribute-queries";
import { useCreateProduct } from "./mutations";
import {
  useDeleteVariantMedia,
  useGenerateVariants,
  usePublishVariantMedia,
  useReplaceProductAxes,
  useReplaceProductDescriptives,
  useTransitionVariant,
  useUpdateVariant,
  useWithdrawVariantMedia,
  variantKeys,
} from "./variant-queries";

import type { ReactNode } from "react";
import type { CreateProductInput } from "./schemas";

const PRODUCT = "11111111-1111-4111-8111-111111111111";

afterEach(() => vi.restoreAllMocks());

/** Mọi lệnh ghi trả `code`; trả về các khoá đã invalidate (chuỗi JSON để so sánh). */
async function failWith<TInput>(
  code: string,
  useHook: () => { mutateAsync: (input: TInput) => Promise<unknown> },
  input: TInput,
) {
  const error = new ApiError(code.endsWith("_NOT_FOUND") ? 404 : 409, code, "x");
  for (const method of ["post", "put", "delete"] as const) {
    vi.spyOn(api, method).mockRejectedValue(error);
  }
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(useHook, { wrapper });
  let thrown: unknown;
  await act(async () => {
    await result.current.mutateAsync(input).catch((e: unknown) => (thrown = e));
  });
  expect(thrown).toBe(error);
  return invalidate.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
}

const key = (k: readonly unknown[]) => JSON.stringify(k);

describe("từ điển thuộc tính — lỗi dữ liệu cũ tải lại từ điển + trục đang dùng", () => {
  it("xoá thuộc tính 409 OPTIMISTIC_LOCK", async () => {
    const keys = await failWith("OPTIMISTIC_LOCK", () => useDeleteAttribute(), {
      attributeId: "a-1",
      version: 1,
    });
    expect(keys).toEqual(expect.arrayContaining([key(attributeKeys.all), key(variantKeys.all)]));
  });

  it("xoá giá trị 404 ATTRIBUTE_VALUE_NOT_FOUND", async () => {
    const keys = await failWith("ATTRIBUTE_VALUE_NOT_FOUND", () => useDeleteAttributeValue(), {
      attributeId: "a-1",
      valueId: "v-1",
      version: 1,
    });
    expect(keys).toContain(key(attributeKeys.all));
  });

  it("bộ thuộc tính danh mục 404 ATTRIBUTE_NOT_FOUND", async () => {
    const keys = await failWith("ATTRIBUTE_NOT_FOUND", () => useReplaceCategoryAttributes(), {
      categoryId: "c-1",
      attributes: [],
    });
    expect(keys).toContain(key(attributeKeys.all));
  });

  it("lỗi nghiệp vụ (ATTRIBUTE_IN_USE) không tải lại", async () => {
    const keys = await failWith("ATTRIBUTE_IN_USE", () => useDeleteAttribute(), {
      attributeId: "a-1",
      version: 1,
    });
    expect(keys).toEqual([]);
  });
});

describe("trục / mô tả / sinh ma trận — lỗi dữ liệu cũ tải lại thuộc tính của SP + từ điển", () => {
  const expectAxesReloaded = (keys: string[]) =>
    expect(keys).toEqual(
      expect.arrayContaining([key(variantKeys.product(PRODUCT)), key(attributeKeys.all)]),
    );

  it("sửa trục 404 ATTRIBUTE_VALUE_NOT_FOUND", async () => {
    expectAxesReloaded(
      await failWith("ATTRIBUTE_VALUE_NOT_FOUND", () => useReplaceProductAxes(), {
        productId: PRODUCT,
        axes: [],
      }),
    );
  });

  it("thuộc tính mô tả 404 ATTRIBUTE_NOT_FOUND", async () => {
    expectAxesReloaded(
      await failWith("ATTRIBUTE_NOT_FOUND", () => useReplaceProductDescriptives(), {
        productId: PRODUCT,
        attributes: [],
      }),
    );
  });

  it("sinh ma trận 404 ATTRIBUTE_VALUE_NOT_FOUND", async () => {
    expectAxesReloaded(
      await failWith("ATTRIBUTE_VALUE_NOT_FOUND", () => useGenerateVariants(), {
        productId: PRODUCT,
      }),
    );
  });

  it("tạo sản phẩm kèm trục 404 ATTRIBUTE_VALUE_NOT_FOUND → tải lại từ điển của form", async () => {
    const input: CreateProductInput = {
      code: "CUP",
      name: "Ly",
      nameEn: "Cup",
      categoryId: "c-1",
      brandId: "b-1",
      description: "",
      descriptionEn: "",
      taxClass: "STANDARD",
      kind: "STANDARD",
    };
    const keys = await failWith("ATTRIBUTE_VALUE_NOT_FOUND", () => useCreateProduct(), input);
    expect(keys).toContain(key(attributeKeys.all));
  });
});

describe("biến thể / ảnh — mã variantErrorMessage nói 'Đã tải lại' thì tải lại biến thể + ảnh của SP", () => {
  const reloaded = (keys: string[]) => expect(keys).toContain(key(variantKeys.product(PRODUCT)));
  const target = { productId: PRODUCT, variantId: "v-1" };

  it("đổi trạng thái 409 INVALID_VARIANT_TRANSITION (người khác vừa đổi)", async () => {
    reloaded(
      await failWith("INVALID_VARIANT_TRANSITION", () => useTransitionVariant(), {
        ...target,
        action: "block",
      }),
    );
  });

  it("sửa biến thể 409 OPTIMISTIC_LOCK", async () => {
    reloaded(
      await failWith("OPTIMISTIC_LOCK", () => useUpdateVariant(), {
        ...target,
        position: 0,
        name: "Ly 12oz",
        sku: "CUP-12OZ",
        optionValueIds: [],
      }),
    );
  });

  it("gỡ ảnh 404 MEDIA_NOT_FOUND", async () => {
    reloaded(
      await failWith("MEDIA_NOT_FOUND", () => useWithdrawVariantMedia(), {
        ...target,
        mediaId: "m-1",
      }),
    );
  });

  it("xoá ảnh 404 VARIANT_NOT_FOUND", async () => {
    reloaded(
      await failWith("VARIANT_NOT_FOUND", () => useDeleteVariantMedia(), {
        ...target,
        mediaId: "m-1",
      }),
    );
  });

  it("lỗi nghiệp vụ (SELF_APPROVAL_NOT_ALLOWED khi xuất bản ảnh) không tải lại", async () => {
    const keys = await failWith("SELF_APPROVAL_NOT_ALLOWED", () => usePublishVariantMedia(), {
      ...target,
      mediaIds: ["m-1"],
    });
    expect(keys).toEqual([]);
  });
});
