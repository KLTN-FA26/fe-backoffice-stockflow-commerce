import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { formatDateTime } from "@/lib/format/date";

import { installApi, renderApp } from "../product-test-utils";
import { ProductHistory } from "./ProductHistory";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const entry = (over: Record<string, unknown>) => ({
  action: "UPDATE",
  actorName: "Admin",
  outcome: "SUCCESS",
  occurredAt: "2026-02-01T08:30:00Z",
  changeType: "UPDATED",
  subjectType: "PRODUCT",
  subjectId: null,
  fromStatus: null,
  toStatus: null,
  reason: null,
  changedFields: [],
  ...over,
});
const page = (items: unknown[], over: Record<string, unknown> = {}) => ({
  items,
  page: 0,
  size: 10,
  totalElements: items.length,
  totalPages: items.length ? 1 : 0,
  hasNext: false,
  hasPrevious: false,
  ...over,
});

afterEach(() => vi.restoreAllMocks());

const versionsUrl = `/products/${PRODUCT}/versions`;

describe("ProductHistory — GET /products/{id}/versions", () => {
  it("hiện loại thay đổi, đổi trạng thái (từ → đến), lý do và các trường đã đổi bằng tiếng Việt", async () => {
    installApi({
      permissions: [],
      get: (url) =>
        url === versionsUrl
          ? page([
              entry({
                changeType: "SUSPENDED",
                fromStatus: "APPROVED",
                toStatus: "INACTIVE",
                reason: "Kiểm tra chất lượng",
              }),
              entry({
                changeType: "UPDATED",
                changedFields: ["name", "categoryId"],
                actorName: null,
              }),
              entry({
                changeType: "INVENTORY_CONTROL",
                subjectType: "INVENTORY_CONTROL",
                subjectId: "s1",
                changedFields: ["reorderPoint"],
              }),
            ])
          : undefined,
    });
    renderApp(<ProductHistory productId={PRODUCT} />);
    expect(
      await screen.findByText("Tạm ngưng", { selector: "div.font-medium" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Đã duyệt")).toBeInTheDocument();
    expect(screen.getByText("Kiểm tra chất lượng")).toBeInTheDocument();
    expect(screen.getByText("Tên, Danh mục")).toBeInTheDocument();
    expect(screen.getByText("Chính sách tồn kho của SKU")).toBeInTheDocument();
    expect(screen.getByText("Điểm đặt hàng lại")).toBeInTheDocument();
    // Không lộ mã BE.
    expect(document.body).not.toHaveTextContent("INACTIVE");
    expect(document.body).not.toHaveTextContent("categoryId");
  });

  it("dòng biến thể nêu SKU; người thực hiện system / unknown và trường ảnh hiện tiếng Việt", async () => {
    installApi({
      permissions: [],
      get: (url) =>
        url === versionsUrl
          ? page([
              entry({
                changeType: "VARIANT_STATUS",
                subjectType: "VARIANT",
                subjectId: "v-1",
                fromStatus: "ACTIVE",
                toStatus: "BLOCKED",
                actorName: "unknown",
              }),
              entry({
                changeType: "MEDIA",
                subjectType: "MEDIA",
                subjectId: "m-1",
                changedFields: ["published"],
                actorName: "system",
              }),
              entry({
                changeType: "MEDIA",
                subjectType: "MEDIA",
                subjectId: "m-2",
                changedFields: ["withdrawn"],
              }),
            ])
          : undefined,
    });
    renderApp(<ProductHistory productId={PRODUCT} skuById={new Map([["v-1", "CUP-12OZ"]])} />);
    expect(await screen.findByText("CUP-12OZ")).toBeInTheDocument();
    expect(screen.getByText("Không rõ")).toBeInTheDocument();
    expect(screen.getByText("Hệ thống")).toBeInTheDocument();
    expect(screen.getByText("Xuất bản ảnh")).toBeInTheDocument();
    expect(screen.getByText("Gỡ ảnh khỏi cửa hàng")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/unknown|system|published|withdrawn/);
    // Ảnh không thuộc biến thể nào trong bảng tra → không bịa SKU.
    expect(screen.queryByText("m-1")).not.toBeInTheDocument();
  });

  it("lịch sử trống: trạng thái trống riêng, không phải lỗi", async () => {
    installApi({ permissions: [], get: (url) => (url === versionsUrl ? page([]) : undefined) });
    renderApp(<ProductHistory productId={PRODUCT} />);
    expect(await screen.findByText("Chưa có thay đổi nào được ghi lại")).toBeInTheDocument();
  });

  it("lỗi tải báo lỗi (khác trống)", async () => {
    installApi({
      permissions: [],
      get: (url) => {
        if (url === versionsUrl) throw new ApiError(500, "INTERNAL", "boom");
        return undefined;
      },
    });
    renderApp(<ProductHistory productId={PRODUCT} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Không tải được lịch sử thay đổi/);
  });

  it("phân trang phía server: gửi page (từ 0) và size; đổi cỡ trang về trang đầu", async () => {
    const get = installApi({
      permissions: [],
      get: (url, config) => {
        if (url !== versionsUrl) return undefined;
        const { page: p } = (config as { params: { page: number } }).params;
        return page([entry({ changeType: p === 0 ? "CREATED" : "SUBMITTED", action: "CREATE" })], {
          page: p,
          totalElements: 25,
          totalPages: 3,
          hasNext: p < 2,
          hasPrevious: p > 0,
        });
      },
    }).get;
    const user = userEvent.setup();
    renderApp(<ProductHistory productId={PRODUCT} />);
    expect(await screen.findByText("Tạo sản phẩm")).toBeInTheDocument();
    const calls = () =>
      get.mock.calls
        .filter((c) => c[0] === versionsUrl)
        .map((c) => (c[1] as { params: unknown }).params);
    expect(calls()[0]).toEqual({ page: 0, size: 10 });
    await user.click(screen.getByRole("button", { name: /Trang sau|Sau|›|>/ }));
    await waitFor(() => expect(calls().at(-1)).toEqual({ page: 1, size: 10 }));
    expect(await screen.findByText("Gửi duyệt")).toBeInTheDocument();
    expect(within(document.body).queryByText("Tạo sản phẩm")).not.toBeInTheDocument();
  });
});

describe("ProductHistory — thời điểm theo giờ Việt Nam", () => {
  it("hiện thời điểm qua formatDateTime (Asia/Ho_Chi_Minh), không phụ thuộc múi giờ máy", async () => {
    installApi({
      permissions: [],
      get: (url) => (url === versionsUrl ? page([entry({})]) : undefined),
    });
    renderApp(<ProductHistory productId={PRODUCT} />);
    expect(await screen.findByText(formatDateTime("2026-02-01T08:30:00Z"))).toBeInTheDocument();
  });
});
