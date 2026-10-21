import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api";

import {
  useDeleteProduct,
  useDiscontinueProduct,
  useSuspendProduct,
  usePublishProduct,
  useTransitionProduct,
  useUpdateProduct,
} from "./mutations";
import { listingKeys } from "./listing-queries";
import { PRODUCT_HISTORY_ROOT, productKeys } from "./queries";
import { variantKeys } from "./variant-queries";

import type { ReactNode } from "react";

afterEach(() => vi.restoreAllMocks());

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
  const remove = vi.spyOn(queryClient, "removeQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, remove, wrapper };
}

const invalidatedKeys = (invalidate: ReturnType<typeof setup>["invalidate"]) =>
  invalidate.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));

describe("product publication mutation", () => {
  it("accepts the backend void response and invalidates product queries", async () => {
    vi.spyOn(api, "post").mockResolvedValueOnce({ data: null });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => usePublishProduct(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("11111111-1111-4111-8111-111111111111");
    });

    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: productKeys.all }));
  });

  it("does not invalidate or turn a permission failure into success", async () => {
    vi.spyOn(api, "post").mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "Forbidden"));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => usePublishProduct(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync("11111111-1111-4111-8111-111111111111");
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(invalidate).not.toHaveBeenCalled();
  });
});

// Revision của listing / giá CHÍNH LÀ version của sản phẩm (BE CatalogCommerceService.get): đổi sản phẩm
// làm cũ listing + giá, và ngược lại.
describe("product mutations also refresh the listing and prices that share its version", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  const product = {
    productId: ID,
    code: "A",
    name: "A",
    taxClass: "STANDARD",
    kind: "STANDARD",
    status: "INACTIVE",
    version: 4,
    createdAt: "2026-01-01T00:00:00Z",
  };

  it("suspend", async () => {
    vi.spyOn(api, "post").mockResolvedValueOnce({ data: product });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSuspendProduct(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: ID, reason: "x", version: 3 });
    });
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: productKeys.all }));
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: listingKeys.all }));
  });

  it("update and publish", async () => {
    vi.spyOn(api, "put").mockResolvedValueOnce({ data: { ...product, status: "DRAFT" } });
    vi.spyOn(api, "post").mockResolvedValueOnce({ data: null });
    const { invalidate, wrapper } = setup();
    const update = renderHook(() => useUpdateProduct(), { wrapper });
    await act(async () => {
      await update.result.current.mutateAsync({
        id: ID,
        name: "A",
        nameEn: "A",
        categoryId: "c",
        brandId: "b",
        description: "",
        descriptionEn: "",
        taxClass: "STANDARD",
        kind: "STANDARD",
        version: 3,
      });
    });
    const publish = renderHook(() => usePublishProduct(), { wrapper });
    await act(async () => {
      await publish.result.current.mutateAsync(ID);
    });
    const keys = invalidate.mock.calls.map((c) =>
      JSON.stringify((c[0] as { queryKey: unknown }).queryKey),
    );
    expect(keys.filter((k) => k === JSON.stringify(listingKeys.all))).toHaveLength(2);
  });
});

describe("duyệt / ngừng kinh doanh đổi trạng thái biến thể ở BE → làm mới biến thể", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  const approved = {
    productId: ID,
    code: "A",
    name: "A",
    taxClass: "STANDARD",
    kind: "STANDARD",
    status: "APPROVED",
    version: 5,
    createdAt: "2026-01-01T00:00:00Z",
  };

  it("duyệt (BE ProductServiceImpl.approve → variants.activateDrafts)", async () => {
    vi.spyOn(api, "post").mockResolvedValueOnce({ data: approved });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useTransitionProduct(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: ID, action: "approve" });
    });
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: variantKeys.all }));
  });

  it("ngừng kinh doanh (BE discontinue → variants.obsoleteAll)", async () => {
    vi.spyOn(api, "post").mockResolvedValueOnce({
      data: {
        ...approved,
        status: "DISCONTINUED",
        warnings: [],
        openReferences: [],
        openReferencesTruncated: false,
      },
    });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useDiscontinueProduct(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: ID, reason: "Hết mẫu", version: 5 });
    });
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: variantKeys.all }));
  });
});

describe("xoá nháp bỏ cache của sản phẩm đã xoá thay vì làm mới (làm mới = 404)", () => {
  const ID = "11111111-1111-4111-8111-111111111111";

  it("bỏ chi tiết, lịch sử, biến thể, listing của bản đã xoá; chỉ làm mới danh sách", async () => {
    vi.spyOn(api, "delete").mockResolvedValueOnce({ data: null });
    const { invalidate, remove, wrapper } = setup();
    const { result } = renderHook(() => useDeleteProduct(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: ID, version: 2 });
    });

    const removed = remove.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(removed).toEqual(
      expect.arrayContaining(
        [
          productKeys.detail(ID),
          [...PRODUCT_HISTORY_ROOT, ID],
          ["variants", ID],
          ["listing", ID],
        ].map((key) => JSON.stringify(key)),
      ),
    );
    const keys = invalidatedKeys(invalidate);
    expect(keys).toContain(JSON.stringify([...productKeys.all, "list"]));
    // Không làm mới gốc "products" (gồm chi tiết vừa xoá) — trang chi tiết còn mount sẽ gọi lại → 404.
    expect(keys).not.toContain(JSON.stringify(productKeys.all));
  });
});

describe("409 trạng thái / version cũ khi chuyển vòng đời → tải lại chi tiết để nút khớp trạng thái thật", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  const fail = (code: string) => new ApiError(409, code, "x");

  async function failing<TInput>(
    useHook: () => { mutateAsync: (input: TInput) => Promise<unknown> },
    input: TInput,
  ) {
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(useHook, { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input).catch(() => undefined);
    });
    return invalidatedKeys(invalidate);
  }
  const detail = JSON.stringify(productKeys.detail(ID));

  it("gửi duyệt 409 INVALID_PRODUCT_STATUS_TRANSITION (người khác đã gửi / duyệt)", async () => {
    vi.spyOn(api, "post").mockRejectedValueOnce(fail("INVALID_PRODUCT_STATUS_TRANSITION"));
    expect(await failing(() => useTransitionProduct(), { id: ID, action: "submit" })).toContain(
      detail,
    );
  });

  it("duyệt 409 OPTIMISTIC_LOCK", async () => {
    vi.spyOn(api, "post").mockRejectedValueOnce(fail("OPTIMISTIC_LOCK"));
    expect(await failing(() => useTransitionProduct(), { id: ID, action: "approve" })).toContain(
      detail,
    );
  });

  it("xuất bản 409 INVALID_PRODUCT_STATUS_TRANSITION", async () => {
    vi.spyOn(api, "post").mockRejectedValueOnce(fail("INVALID_PRODUCT_STATUS_TRANSITION"));
    expect(await failing(() => usePublishProduct(), ID)).toContain(detail);
  });

  it("xuất bản 409 PRODUCT_NOT_APPROVED (SP vừa bị tạm ngưng ở nơi khác)", async () => {
    vi.spyOn(api, "post").mockRejectedValueOnce(fail("PRODUCT_NOT_APPROVED"));
    expect(await failing(() => usePublishProduct(), ID)).toContain(detail);
  });

  it("tạm ngưng 409 INVALID_PRODUCT_STATUS_TRANSITION (không chỉ OPTIMISTIC_LOCK)", async () => {
    vi.spyOn(api, "post").mockRejectedValueOnce(fail("INVALID_PRODUCT_STATUS_TRANSITION"));
    expect(await failing(() => useSuspendProduct(), { id: ID, reason: "x", version: 3 })).toContain(
      detail,
    );
  });

  it("xoá nháp 409 OPTIMISTIC_LOCK", async () => {
    vi.spyOn(api, "delete").mockRejectedValueOnce(fail("OPTIMISTIC_LOCK"));
    expect(await failing(() => useDeleteProduct(), { id: ID, version: 2 })).toContain(detail);
  });

  it("lỗi nghiệp vụ (PRODUCT_GALLERY_REQUIRED) không tải lại", async () => {
    vi.spyOn(api, "post").mockRejectedValueOnce(fail("PRODUCT_GALLERY_REQUIRED"));
    expect(await failing(() => usePublishProduct(), ID)).toEqual([]);
  });
});
