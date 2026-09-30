import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import { useSupplierWizard } from "./useSupplierWizard";

import type { SupplierDto } from "@/features/supplier/types";

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

const address = {
  street: "12 Lê Lợi",
  ward: "Bến Nghé",
  district: "Quận 1",
  province: "TP.HCM",
  postalCode: "700000",
  country: "VN" as const,
};

const supplier: SupplierDto = {
  supplierId: "SUP-001",
  name: "Công ty A",
  taxCode: "0301234567",
  contactName: "Nguyễn Văn B",
  contactEmail: "b@a.vn",
  contactPhone: "0901234567",
  address,
  paymentTerms: "Net 30",
  currency: "VND",
  leadTimeDays: 7,
  status: "Active",
};

async function submitReview(result: { current: ReturnType<typeof useSupplierWizard> }) {
  await act(async () => {
    result.current.setCurrentStep("terms");
  });
  await act(async () => {
    result.current.handleReviewSubmit();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSupplierWizard", () => {
  it("tạo mới, tên trống → nhảy về profile + toast ngay lần lưu đầu", async () => {
    const { result } = renderHook(() => useSupplierWizard());
    await submitReview(result);

    expect(result.current.currentStep).toBe("profile");
    expect(toastError).toHaveBeenCalledWith("Chưa thể lưu", "Tên nhà cung cấp không được để trống");
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("sửa NCC không có địa chỉ → nhảy sang bước address", async () => {
    const { result } = renderHook(() => useSupplierWizard({ ...supplier, address: undefined }));
    await submitReview(result);

    expect(result.current.currentStep).toBe("address");
    expect(toastError).toHaveBeenCalledWith("Chưa thể lưu", "Số nhà / Đường không được để trống");
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("sửa: prefill code từ supplierId và gửi PUT với id", async () => {
    const { result } = renderHook(() => useSupplierWizard(supplier));
    await submitReview(result);

    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0]?.[0]).toMatchObject({ id: "SUP-001", code: "SUP-001" });
  });

  it("sửa: 409 trùng taxCode → lỗi inline ở ô taxCode, về bước profile, không điều hướng", async () => {
    updateMutate.mockImplementation((_input, opts) => {
      opts.onError?.(
        new ApiError(409, "SUPPLIER_CODE_ALREADY_EXISTS", "Trùng MST", {
          taxCode: "Mã số thuế đã thuộc nhà cung cấp khác.",
        }),
      );
    });
    const { result } = renderHook(() => useSupplierWizard(supplier));
    await submitReview(result);

    expect(result.current.currentStep).toBe("profile");
    expect(result.current.errors.taxCode?.message).toBe("Mã số thuế đã thuộc nhà cung cấp khác.");
    expect(push).not.toHaveBeenCalled();
  });

  it("sửa: lỗi server nhiều bước → chọn bước sớm nhất, map alias email", async () => {
    updateMutate.mockImplementation((_input, opts) => {
      opts.onError?.(
        new ApiError(422, "VALIDATION", "Sai", {
          "address.street": "Thiếu đường",
          email: "Email trùng",
        }),
      );
    });
    const { result } = renderHook(() => useSupplierWizard(supplier));
    await submitReview(result);

    expect(result.current.currentStep).toBe("contact");
    expect(result.current.errors.contactEmail?.message).toBe("Email trùng");
    expect(result.current.errors.address?.street?.message).toBe("Thiếu đường");
  });

  it("sửa thành công → điều hướng về trang chi tiết", async () => {
    updateMutate.mockImplementation((_input, opts) => opts.onSuccess?.(supplier));
    const { result } = renderHook(() => useSupplierWizard(supplier));
    await submitReview(result);

    expect(push).toHaveBeenCalledWith("/admin/suppliers/SUP-001");
  });
});
