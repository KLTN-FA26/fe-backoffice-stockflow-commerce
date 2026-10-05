import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError } from "@/lib/api/error";
import { renderWithProviders } from "@/test/render";

import { OrderDetailErrorState } from "./OrderDetailErrorState";

describe("OrderDetailErrorState", () => {
  it("lỗi parse (không phải ApiError) → 'Dữ liệu trả về không đúng định dạng'", () => {
    const zodError = z.object({ status: z.string() }).safeParse({}).error;
    renderWithProviders(<OrderDetailErrorState id="o-1" error={zodError} onRetry={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Dữ liệu trả về không đúng định dạng" }),
    ).toBeInTheDocument();
  });

  it("403 → 'Bạn không có quyền', không có nút Thử lại", () => {
    const error = new ApiError(403, "FORBIDDEN", "Not authorised", undefined, "corr-1");
    renderWithProviders(<OrderDetailErrorState id="o-1" error={error} onRetry={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Bạn không có quyền" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
    expect(screen.getByText("traceId: corr-1")).toBeInTheDocument();
  });

  it("5xx → nút Thử lại gọi onRetry", async () => {
    const onRetry = vi.fn();
    const error = new ApiError(500, "INTERNAL_ERROR", "boom");
    renderWithProviders(<OrderDetailErrorState id="o-1" error={error} onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("404 → không tìm thấy đơn + link quay lại danh sách", () => {
    const error = new ApiError(404, "NOT_FOUND", "Resource not found");
    renderWithProviders(<OrderDetailErrorState id="o-1" error={error} onRetry={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Không tìm thấy đơn hàng" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay lại danh sách" })).toBeInTheDocument();
  });

  it("400 UNSUPPORTED_PARAMETER (id không phải UUID) → không tìm thấy, không có Thử lại", () => {
    const error = new ApiError(400, "UNSUPPORTED_PARAMETER", "Unsupported parameter value");
    renderWithProviders(<OrderDetailErrorState id="abc" error={error} onRetry={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Không tìm thấy đơn hàng" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
  });
});
