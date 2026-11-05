import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderLoadError } from "./OrderLoadError";

import type { PermissionCode } from "@/lib/auth";

const { common, loadError, order } = UI_LABELS;

function renderError(
  props: React.ComponentProps<typeof OrderLoadError>,
  permissions: readonly PermissionCode[] = ORDER_PERMISSION_SETS.salesStaff,
) {
  mockOrderApiGet(permissions, {});
  return renderOrderScreen(<OrderLoadError {...props} />);
}

afterEach(() => vi.restoreAllMocks());

describe("OrderLoadError — cùng bố cục/nhãn với SupplierLoadError", () => {
  it("PageHeader là tên trang, lý do nằm ở EmptyState (không lặp)", async () => {
    renderError({ error: new ApiError(404, "NOT_FOUND", "Resource not found") });

    expect(screen.getByRole("heading", { level: 1, name: order.pageTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: order.notFoundTitle })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: common.backToList })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.orders.list,
    );
  });

  it("400 UNSUPPORTED_PARAMETER (id không phải UUID) → không tìm thấy, không có Thử lại", () => {
    renderError({
      error: new ApiError(400, "UNSUPPORTED_PARAMETER", "Unsupported parameter value"),
      onRetry: vi.fn(),
    });

    expect(screen.getByRole("heading", { name: order.notFoundTitle })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: common.retry })).not.toBeInTheDocument();
  });

  it("lỗi parse (ZodError) → 'Dữ liệu trả về không đúng định dạng'", () => {
    const zodError = z.object({ status: z.string() }).safeParse({}).error;
    renderError({ error: zodError, onRetry: vi.fn() });

    expect(screen.getByRole("heading", { name: loadError.invalidDataTitle })).toBeInTheDocument();
  });

  it("5xx → câu tiếng Việt chung (không hiện message BE), Thử lại gọi onRetry, có traceId", async () => {
    const onRetry = vi.fn();
    renderError({
      error: new ApiError(500, "INTERNAL_ERROR", "NullPointerException at ...", undefined, "c-1"),
      onRetry,
    });

    expect(screen.getByText(loadError.serverDescription)).toBeInTheDocument();
    expect(screen.queryByText(/NullPointerException/)).not.toBeInTheDocument();
    expect(screen.getByText("c-1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: common.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("thiếu quyền + không xem được danh sách → nút về trang tổng quan, không có Thử lại", async () => {
    renderError({ error: null, kind: "forbidden", onRetry: vi.fn() }, ORDER_PERMISSION_SETS.none);

    expect(screen.getByRole("heading", { name: loadError.forbiddenTitle })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: common.backToHome })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.home,
    );
    expect(screen.queryByRole("button", { name: common.retry })).not.toBeInTheDocument();
  });

  it("thiếu READ → tiêu đề riêng 'không có quyền xem dữ liệu'", () => {
    renderError({ error: null, kind: "no-read" }, ORDER_PERMISSION_SETS.viewOnly);
    expect(screen.getByRole("heading", { name: loadError.noReadTitle })).toBeInTheDocument();
  });

  it("inline (vùng bảng) → không vẽ PageHeader, không có nút quay lại", () => {
    renderError({
      error: new ApiError(500, "INTERNAL_ERROR", "x"),
      inline: true,
      onRetry: vi.fn(),
    });

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: common.retry })).toBeInTheDocument();
  });
});
