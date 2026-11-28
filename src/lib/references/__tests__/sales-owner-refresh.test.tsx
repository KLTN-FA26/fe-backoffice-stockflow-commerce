/**
 * Hai cách đọc người phụ trách, hai khoá (thẻ khách: bản ghi để sửa; chế độ chặt: đọc lỏng) — đổi người phụ trách ở hộp
 * thoại của thẻ khách phải làm mới CẢ khoá của chế độ chặt, để nút báo giá / hợp đồng / chat mở hay khoá theo người mới.
 * Thêm: lỗi chế độ chặt đi qua MỘT hàm ở mọi màn, kể cả hộp đổi người phụ trách.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { assignableOnly } from "../sales-agents";
import { ownerChangeErrorMessage, salesOwnerKeys, useChangeSalesOwner } from "../sales-owner";
import { salesOwnerAccessKeys } from "../sales-owner-queries";

import type { ReactNode } from "react";

afterEach(() => vi.restoreAllMocks());

const OWNER = {
  customerId: "c-1",
  salesOwnerId: "s-b",
  salesOwnerName: "Sale Bình",
  active: true,
  state: "ASSIGNED",
  since: "2026-11-28T02:00:00Z",
  cover: null,
  version: 4,
};

describe("đổi người phụ trách → mọi màn tải lại", () => {
  it("useChangeSalesOwner làm mới khoá của thẻ khách VÀ khoá chế độ chặt (salesOwnerAccessKeys)", async () => {
    vi.spyOn(api, "put").mockResolvedValue({ data: OWNER });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(salesOwnerKeys.one("c-1"), { ...OWNER, salesOwnerId: "s-a" });
    queryClient.setQueryData(salesOwnerAccessKeys.one("c-1"), {
      ...OWNER,
      salesOwnerId: "s-a",
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useChangeSalesOwner(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        customerId: "c-1",
        salesOwnerId: "s-b",
        reason: "WORKLOAD",
        note: "",
        notifyCustomer: true,
        version: 3,
      });
    });
    await waitFor(() =>
      expect(queryClient.getQueryState(salesOwnerAccessKeys.one("c-1"))?.isInvalidated).toBe(true),
    );
    expect(queryClient.getQueryState(salesOwnerKeys.one("c-1"))?.isInvalidated).toBe(true);
  });
});

describe("ownerChangeErrorMessage — một hàm cho lỗi chế độ chặt", () => {
  it("CUSTOMER_OWNED_BY_OTHER_SALES nêu tên từ details.salesOwnerName", () => {
    const error = new ApiError(
      409,
      "CUSTOMER_OWNED_BY_OTHER_SALES",
      "x",
      undefined,
      undefined,
      undefined,
      undefined,
      {
        salesOwnerName: "Trần Văn Sales",
      },
    );
    expect(ownerChangeErrorMessage(error)).toContain("Trần Văn Sales");
  });

  it("mã của thao tác đổi dùng câu riêng; OPTIMISTIC_LOCK nói về người phụ trách", () => {
    expect(ownerChangeErrorMessage(new ApiError(422, "SALES_OWNER_NOT_ASSIGNABLE", "x"))).toMatch(
      /không phải Sale đang làm/,
    );
    expect(ownerChangeErrorMessage(new ApiError(409, "OPTIMISTIC_LOCK", "x"))).toMatch(
      /người phụ trách/,
    );
  });
});

describe("assignableOnly — lọc nguồn dự phòng (D42)", () => {
  const option = (userId: string) => ({
    userId,
    name: userId,
    paused: false,
    onLeave: false,
    coverName: null,
  });

  it("bỏ người điều phối và chính quản lý đang xem; Sale xem thì không bỏ chính mình", () => {
    const options = [option("s-1"), option("m-1"), option("me")];
    expect(
      assignableOnly(options, { meId: "me", isManager: true }, new Set(["m-1"])).map(
        (o) => o.userId,
      ),
    ).toEqual(["s-1"]);
    expect(assignableOnly(options, { meId: "me", isManager: false }).map((o) => o.userId)).toEqual([
      "s-1",
      "m-1",
      "me",
    ]);
  });
});
