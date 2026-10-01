import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import { foreignSupplier, supplier } from "../../__fixtures__/supplier";
import { useSupplierWizard } from "./useSupplierWizard";

type MutateOpts = { onSuccess?: (d: unknown) => void; onError?: (e: ApiError) => void };

const push = vi.fn();
const createMutate = vi.fn<(input: unknown, opts: MutateOpts) => void>();
const updateMutate = vi.fn<(input: unknown, opts: MutateOpts) => void>();
const toastError = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/shared/Toast", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn(), info: vi.fn() },
}));
vi.mock("@/features/supplier/mutations", () => ({
  useCreateSupplier: () => ({ mutate: createMutate, isPending: false }),
  useUpdateSupplier: () => ({ mutate: updateMutate, isPending: false }),
}));

type Wizard = { current: ReturnType<typeof useSupplierWizard> };

async function goToTermsAndSubmit(result: Wizard) {
  await act(async () => result.current.goToStep("terms"));
  await act(async () => result.current.handleReviewSubmit());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSupplierWizard — tạo mới", () => {
  it("bấm Tiếp khi bước Hồ sơ còn trống → không chuyển bước, không có dấu ✓", async () => {
    const { result } = renderHook(() => useSupplierWizard());

    await act(async () => result.current.goNext());

    expect(result.current.currentStep).toBe("profile");
    expect(result.current.stepStatus("profile")).toBe("error");
    expect(result.current.errors.code?.message).toBe("Mã nhà cung cấp không được để trống");
    expect(result.current.canGoTo("contact")).toBe(false);
  });

  it("bước hợp lệ → chuyển bước và bước trước được đánh ✓", async () => {
    const { result } = renderHook(() => useSupplierWizard());
    await act(async () => {
      result.current.setValue("code", "SUP-100");
      result.current.setValue("name", "Công ty mới");
    });

    await act(async () => result.current.goNext());

    expect(result.current.currentStep).toBe("contact");
    expect(result.current.stepStatus("profile")).toBe("done");
    expect(result.current.stepStatus("terms")).toBe("idle");
  });

  it("không nhảy cóc tới bước chưa tới lượt qua sidebar", async () => {
    const { result } = renderHook(() => useSupplierWizard());
    await act(async () => result.current.goToStep("terms"));
    expect(result.current.currentStep).toBe("profile");
  });
});

describe("useSupplierWizard — sửa", () => {
  it("NCC nước ngoài (MST chữ-số) mở sửa rồi lưu không đổi gì → gửi PUT", async () => {
    const { result } = renderHook(() => useSupplierWizard(foreignSupplier));
    await goToTermsAndSubmit(result);

    expect(toastError).not.toHaveBeenCalled();
    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0]?.[0]).toMatchObject({
      id: foreignSupplier.supplierId,
      status: "Active",
      values: { code: "SUP-002", taxCode: "91440101MA5XXXXX" },
    });
  });

  it("409 trùng MST (BE không kèm fieldErrors) → lỗi tiếng Việt ở ô taxCode, về bước Hồ sơ", async () => {
    updateMutate.mockImplementation((_input, opts) =>
      opts.onError?.(
        new ApiError(
          409,
          "SUPPLIER_TAX_CODE_ALREADY_EXISTS",
          "A supplier with this tax code exists",
        ),
      ),
    );
    const { result } = renderHook(() => useSupplierWizard(supplier));
    await goToTermsAndSubmit(result);

    expect(result.current.currentStep).toBe("profile");
    expect(result.current.errors.taxCode?.message).toBe("Mã số thuế đã thuộc nhà cung cấp khác");
    expect(push).not.toHaveBeenCalled();
  });

  it("deliveryContactValid từ BE → ô email (kênh EMAIL), về bước Liên hệ", async () => {
    updateMutate.mockImplementation((_input, opts) =>
      opts.onError?.(
        new ApiError(400, "VALIDATION_FAILED", "invalid", { deliveryContactValid: "invalid" }),
      ),
    );
    const { result } = renderHook(() => useSupplierWizard(supplier));
    await goToTermsAndSubmit(result);

    expect(result.current.currentStep).toBe("contact");
    expect(result.current.errors.email?.message).toBe("Kênh Email cần có email liên hệ");
  });

  it("sửa thành công → về trang chi tiết", async () => {
    updateMutate.mockImplementation((_input, opts) => opts.onSuccess?.(supplier));
    const { result } = renderHook(() => useSupplierWizard(supplier));
    await goToTermsAndSubmit(result);

    expect(push).toHaveBeenCalledWith(`/admin/suppliers/${supplier.supplierId}`);
  });

  it("dữ liệu sửa không hợp lệ → nhảy về bước lỗi sớm nhất + toast tiếng Việt", async () => {
    const { result } = renderHook(() => useSupplierWizard({ ...supplier, email: null }));
    await goToTermsAndSubmit(result);

    expect(result.current.currentStep).toBe("contact");
    expect(toastError).toHaveBeenCalledWith("Chưa thể lưu", "Kênh Email cần có email liên hệ");
    expect(updateMutate).not.toHaveBeenCalled();
  });
});
