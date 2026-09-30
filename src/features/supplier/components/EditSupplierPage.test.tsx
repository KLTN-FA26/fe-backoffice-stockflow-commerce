import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError } from "@/lib/api/error";

import { EditSupplierPage } from "./EditSupplierPage";

const refetch = vi.fn();
let queryState: Record<string, unknown> = {};

vi.mock("../queries", () => ({ useSupplier: () => ({ refetch, ...queryState }) }));
vi.mock("./SupplierForm", () => ({ SupplierForm: () => <div>supplier-form</div> }));

function zodError() {
  const r = z.object({ name: z.string() }).safeParse({});
  if (r.success) throw new Error("unreachable");
  return r.error;
}

function setError(error: unknown) {
  queryState = { isLoading: false, isError: true, error, data: undefined };
}

beforeEach(() => {
  vi.clearAllMocks();
  queryState = {};
});

describe("EditSupplierPage", () => {
  it("404 → không tìm thấy, không có nút Thử lại", () => {
    setError(new ApiError(404, "HTTP_404", "Supplier not found"));
    render(<EditSupplierPage id="SUP-X" />);

    expect(screen.getByText("Không tìm thấy nhà cung cấp")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về danh sách" })).toHaveAttribute(
      "href",
      "/admin/suppliers",
    );
  });

  it("mất mạng → không kết nối được máy chủ + Thử lại gọi refetch", async () => {
    setError(new ApiError(0, "NETWORK_ERROR", "offline"));
    render(<EditSupplierPage id="SUP-001" />);

    expect(screen.getByText("Không kết nối được máy chủ")).toBeInTheDocument();
    expect(screen.queryByText("Không tìm thấy nhà cung cấp")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("500 → message server + traceId, không nói 'không tìm thấy'", () => {
    setError(new ApiError(500, "HTTP_500", "Lỗi hệ thống", undefined, "trace-abc"));
    render(<EditSupplierPage id="SUP-001" />);

    expect(screen.getByText("Không tải được dữ liệu")).toBeInTheDocument();
    expect(screen.getByText("Lỗi hệ thống")).toBeInTheDocument();
    expect(screen.getByText("trace-abc")).toBeInTheDocument();
    expect(screen.queryByText("Không tìm thấy nhà cung cấp")).not.toBeInTheDocument();
  });

  it("zod parse fail → dữ liệu không đúng định dạng", () => {
    setError(zodError());
    render(<EditSupplierPage id="SUP-001" />);

    expect(screen.getByText("Dữ liệu trả về không đúng định dạng")).toBeInTheDocument();
    expect(screen.queryByText("Không tìm thấy nhà cung cấp")).not.toBeInTheDocument();
  });

  it("có data → render form", () => {
    queryState = { isLoading: false, isError: false, data: { supplierId: "SUP-001" } };
    render(<EditSupplierPage id="SUP-001" />);

    expect(screen.getByText("supplier-form")).toBeInTheDocument();
  });
});
