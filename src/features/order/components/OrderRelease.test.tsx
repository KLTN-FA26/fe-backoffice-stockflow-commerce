import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiOrder } from "../__fixtures__/order";
import {
  ORDER_PERMISSION_SETS,
  mockOrderApiGet,
  pickOrderSelectOption,
  renderOrderScreen,
} from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { PermissionCode } from "@/lib/auth";
import type { OrderDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
const RELEASE_PATH = `${DETAIL_PATH}/release`;
const WAREHOUSE_ID = "8f8f8f8f-0000-4000-8000-000000000001";
const confirmed: OrderDto = { ...apiOrder, status: "CONFIRMED", paymentTerm: "PREPAID" };

async function renderDetail(permissions: readonly PermissionCode[], order: OrderDto) {
  const get = mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () => order,
    "/warehouses": () => ({ items: [{ id: WAREHOUSE_ID, prefix: "HN", name: "Kho Hà Nội" }] }),
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
  return get;
}

const detailCalls = (get: Awaited<ReturnType<typeof renderDetail>>) =>
  get.mock.calls.filter(([url]) => url === DETAIL_PATH).length;

async function openAndPick(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Release đơn" }));
  await pickOrderSelectOption(user, /Kho xuất/, /HN — Kho Hà Nội/);
  await user.click(screen.getByRole("button", { name: "Release" }));
}

/** Mọi thao tác ghi đơn gửi kèm Idempotency-Key (header riêng request, không vào body). */
const WITH_IDEMPOTENCY_KEY = expect.objectContaining({
  headers: { "Idempotency-Key": expect.any(String) },
});

afterEach(() => vi.restoreAllMocks());

const DIALOG_FLOW_TIMEOUT_MS = 15_000;

describe("Release — action-gating (SCRUM-423, docs 17 BR-02)", () => {
  it("Confirmed + ORDER_COORDINATOR → có nút Release đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    expect(await screen.findByRole("button", { name: "Release đơn" })).toBeInTheDocument();
  });

  it("Confirmed + SALES_STAFF (không có sales-orders:APPROVE) → không có nút Release", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, confirmed);
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByRole("button", { name: "Release đơn" })).not.toBeInTheDocument();
  });

  it("đơn cọc chưa nhận cọc → Coordinator thấy 'Chưa release được · BR-PRD-09', không có nút", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, {
      ...apiOrder,
      status: "PENDING_PAYMENT",
      paymentTerm: "DEPOSIT",
      depositRequired: 105_000,
    });
    const card = await screen.findByRole("region", { name: "Thao tác đơn" });
    expect(within(card).getByText("Chưa release được")).toBeInTheDocument();
    expect(within(card).getByText("BR-PRD-09")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release đơn" })).not.toBeInTheDocument();
  });
});

describe("Credit hold trên trang chi tiết (SCRUM-427)", () => {
  it("On Hold + CREDIT + lý do giữ CREDIT + quyền duyệt công nợ (như System Admin) → Duyệt / Từ chối, không Release", async () => {
    await renderDetail(
      [...ORDER_PERMISSION_SETS.coordinator, ...ORDER_PERMISSION_SETS.accountant],
      { ...apiOrder, status: "ON_HOLD", paymentTerm: "CREDIT", holdReason: "CREDIT" },
    );
    const card = await screen.findByRole("region", { name: "Thao tác đơn" });
    expect(within(card).getByRole("button", { name: "Duyệt vượt hạn mức" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Từ chối" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Release đơn" })).not.toBeInTheDocument();
    // BR-02: Coordinator thấy lý do chưa release
    expect(within(card).getByText("BR-02")).toBeInTheDocument();
  });
});

// Dialog nhiều bước (Radix Select trong jsdom) chậm khi chạy song song cả bộ test → nới timeout
describe("Release — gửi & lý do từ chối", { timeout: DIALOG_FLOW_TIMEOUT_MS }, () => {
  it("chọn kho → POST /release {warehouseId}, đóng dialog", async () => {
    const user = userEvent.setup();
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    const post = vi.spyOn(api, "post").mockResolvedValue({
      data: { ...confirmed, status: "READY_TO_FULFILL", warehouseId: WAREHOUSE_ID },
    });

    await openAndPick(user);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        RELEASE_PATH,
        { warehouseId: WAREHOUSE_ID },
        WITH_IDEMPOTENCY_KEY,
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("chưa chọn kho → nút Release bị khoá", async () => {
    const user = userEvent.setup();
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    await user.click(await screen.findByRole("button", { name: "Release đơn" }));
    expect(screen.getByRole("button", { name: "Release" })).toBeDisabled();
  });

  it("BR-PRD-08: DESIGN_SAMPLE_NOT_APPROVED → lý do + mã quy tắc + SKU hiện trong dialog, dialog giữ nguyên", async () => {
    const user = userEvent.setup();
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(
        409,
        "DESIGN_SAMPLE_NOT_APPROVED",
        "No approved sample for: CUP-PRINT-12OZ",
        undefined,
        "corr-9",
      ),
    );

    await openAndPick(user);

    const dialog = await screen.findByRole("dialog");
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("mẫu được khách duyệt");
    expect(alert).toHaveTextContent("BR-PRD-08");
    expect(alert).toHaveTextContent("CUP-PRINT-12OZ");
    expect(alert).toHaveTextContent("corr-9");
  });

  it("BR-PRD-09: ORDER_DEPOSIT_NOT_RECEIVED → lý do chưa đủ cọc", async () => {
    const user = userEvent.setup();
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(409, "ORDER_DEPOSIT_NOT_RECEIVED", "x"));

    await openAndPick(user);

    const alert = await within(await screen.findByRole("dialog")).findByRole("alert");
    expect(alert).toHaveTextContent("chưa nhận đủ tiền cọc");
    expect(alert).toHaveTextContent("BR-PRD-09");
  });

  it("danh sách kho 403 (Coordinator chưa có warehouse-warehouses:READ) → báo rõ quyền", async () => {
    const user = userEvent.setup();
    mockOrderApiGet(ORDER_PERMISSION_SETS.coordinator, {
      [DETAIL_PATH]: () => confirmed,
      "/warehouses": () => {
        throw new ApiError(403, "FORBIDDEN", "Forbidden");
      },
    });
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
    });

    await user.click(await screen.findByRole("button", { name: "Release đơn" }));
    expect(await screen.findByText(/warehouse-warehouses:READ/)).toBeInTheDocument();
  });
});

describe(
  "Release — tranh chấp đồng thời + fieldErrors (Step 8)",
  { timeout: DIALOG_FLOW_TIMEOUT_MS },
  () => {
    it("A. OPTIMISTIC_LOCK → báo trong dialog, giữ kho đã chọn, tải lại đơn, KHÔNG tự gửi lại; bấm lại → gửi lần 2", async () => {
      const user = userEvent.setup();
      const get = await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
      const post = vi
        .spyOn(api, "post")
        .mockRejectedValueOnce(new ApiError(409, "OPTIMISTIC_LOCK", "The record changed meanwhile"))
        .mockResolvedValueOnce({ data: { ...confirmed, status: "READY_TO_FULFILL" } });
      await user.click(await screen.findByRole("button", { name: "Release đơn" }));
      await pickOrderSelectOption(user, /Kho xuất/, /HN — Kho Hà Nội/);
      const dialog = screen.getByRole("dialog");
      // Đếm ngay trước khi gửi — mọi lần GET chi tiết sau đó là do lỗi khoá kích hoạt
      await new Promise((resolve) => setTimeout(resolve, 50));
      const before = detailCalls(get);
      await user.click(within(dialog).getByRole("button", { name: "Release" }));
      expect(await within(dialog).findByText(/vừa được người khác cập nhật/)).toBeInTheDocument();
      await waitFor(() => expect(detailCalls(get)).toBeGreaterThan(before));
      expect(post).toHaveBeenCalledTimes(1);
      // Kho đã chọn vẫn còn — bấm lại là gửi lại (người dùng chủ động)
      await user.click(within(dialog).getByRole("button", { name: "Release" }));
      await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
      expect(post).toHaveBeenLastCalledWith(
        RELEASE_PATH,
        { warehouseId: WAREHOUSE_ID },
        WITH_IDEMPOTENCY_KEY,
      );
    });

    it("B. LOCK_TIMEOUT → 'đang được xử lý ở nơi khác', không tải lại vội, không tự gửi lại, vẫn bấm lại được", async () => {
      const user = userEvent.setup();
      const get = await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
      const post = vi
        .spyOn(api, "post")
        .mockRejectedValue(new ApiError(409, "LOCK_TIMEOUT", "The record is busy"));

      await openAndPick(user);
      const dialog = await screen.findByRole("dialog");
      expect(await within(dialog).findByText(/đang được xử lý ở nơi khác/)).toBeInTheDocument();
      const after = detailCalls(get);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(detailCalls(get)).toBe(after);
      expect(post).toHaveBeenCalledTimes(1);
      expect(within(dialog).getByRole("button", { name: "Release" })).toBeEnabled();
    });

    it("fieldErrors.warehouseId (400 VALIDATION_FAILED) → lỗi tại ô Kho xuất", async () => {
      const user = userEvent.setup();
      await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
      vi.spyOn(api, "post").mockRejectedValue(
        new ApiError(400, "VALIDATION_FAILED", "Invalid request data", {
          warehouseId: "must not be null",
        }),
      );

      await openAndPick(user);
      const dialog = await screen.findByRole("dialog");
      expect(await within(dialog).findByText("Chọn kho xuất.")).toBeInTheDocument();
      expect(within(dialog).getByRole("combobox", { name: /Kho xuất/ })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(within(dialog).queryByText("must not be null")).not.toBeInTheDocument();
    });
  },
);

/* ── Step 9: Idempotency-Key — vòng đời theo BE IdempotencyFilter ───────── */

type PostSpy = { mock: { calls: unknown[][] } };

function keyOf(post: PostSpy, call: number): string | undefined {
  const config = post.mock.calls[call]?.[2] as { headers?: Record<string, string> } | undefined;
  return config?.headers?.["Idempotency-Key"];
}

describe("Release — Idempotency-Key", { timeout: DIALOG_FLOW_TIMEOUT_MS }, () => {
  it("A/B. lần đầu có key K1; LOCK_TIMEOUT (BE nhả claim) → bấm lại cùng nội dung dùng lại K1, mỗi lần bấm đúng 1 request", async () => {
    const user = userEvent.setup();
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValueOnce(new ApiError(409, "LOCK_TIMEOUT", "busy"))
      .mockResolvedValueOnce({ data: { ...confirmed, status: "READY_TO_FULFILL" } });

    await openAndPick(user);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/đang được xử lý ở nơi khác/);
    expect(post).toHaveBeenCalledTimes(1);
    const k1 = keyOf(post, 0);
    expect(k1).toMatch(/^[A-Za-z0-9\-_:.]{8,255}$/);

    await user.click(within(dialog).getByRole("button", { name: "Release" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(keyOf(post, 1)).toBe(k1);
  });

  it("15. lỗi BE đã LƯU (400) → bấm lại cùng nội dung dùng key MỚI (không bị trả lại 400 cũ)", async () => {
    const user = userEvent.setup();
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValueOnce(new ApiError(400, "VALIDATION_FAILED", "Invalid request data"))
      .mockResolvedValueOnce({ data: { ...confirmed, status: "READY_TO_FULFILL" } });

    await openAndPick(user);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("alert");
    await user.click(within(dialog).getByRole("button", { name: "Release" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(keyOf(post, 1)).not.toBe(keyOf(post, 0));
  });

  it("D/F. thành công → dialog đóng; mở lại + gửi → key mới, không thừa key cũ", async () => {
    const user = userEvent.setup();
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: confirmed });

    await openAndPick(user);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await openAndPick(user);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(keyOf(post, 1)).not.toBe(keyOf(post, 0));
  });

  it("E. đóng dialog (Huỷ) sau lỗi tạm thời rồi mở lại → lần thử mới, key mới", async () => {
    const user = userEvent.setup();
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, confirmed);
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValueOnce(new ApiError(409, "LOCK_TIMEOUT", "busy"))
      .mockResolvedValueOnce({ data: confirmed });

    await openAndPick(user);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/đang được xử lý ở nơi khác/);
    await user.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await openAndPick(user);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(keyOf(post, 1)).not.toBe(keyOf(post, 0));
  });
});
