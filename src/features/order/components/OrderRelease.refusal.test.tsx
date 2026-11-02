/**
 * Release đơn — những gì hộp thoại làm khi BE từ chối hoặc tranh chấp (SCRUM-423, docs 17 BR-02, docs 19 BR-08/09):
 * thẻ "Chưa release được" cho đơn cọc chưa nhận cọc, lý do kèm mã quy tắc + SKU, OPTIMISTIC_LOCK / LOCK_TIMEOUT,
 * Idempotency-Key, lỗi 400 `warehouseId` ngay tại ô Kho, số dòng in + gợi ý, kho rỗng, ô kho khoá tới khi tải xong.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { DETAIL_PATH } from "../__fixtures__/detail";
import { apiOrder } from "../__fixtures__/order";
import { pickSelectOption, ORDER_PERMISSION_SETS } from "../__fixtures__/render";
import {
  keyOfCall,
  openReleaseDialog,
  RELEASE_PATH,
  renderConfirmedScreen,
} from "../__fixtures__/release";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const detailCalls = () =>
  vi.mocked(api.get).mock.calls.filter(([url]) => url === DETAIL_PATH).length;

async function submitRelease(error?: ApiError) {
  await renderConfirmedScreen();
  const { user, dialog } = await openReleaseDialog();
  const post = vi.spyOn(api, "post");
  if (error) post.mockRejectedValue(error);
  else post.mockResolvedValue({ data: apiOrder });
  await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
  await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
  return { user, dialog, post };
}

describe("thẻ 'Chưa release được' (BR-PRD-09) — không chỉ ẩn nút", () => {
  const awaiting = { paymentTerm: "DEPOSIT", depositRequired: 105_000 };

  it("đơn cọc chưa nhận cọc (Pending Payment), người có quyền release → thẻ nêu lý do + mã BR-PRD-09, không có nút", async () => {
    await renderConfirmedScreen("PENDING_PAYMENT", awaiting);
    const card = await screen.findByText("Chưa release được");
    const block = card.closest("div") as HTMLElement;
    expect(within(block).getByText("BR-PRD-09")).toBeInTheDocument();
    expect(within(block).getByText(/chưa nhận đủ tiền cọc/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release đơn" })).not.toBeInTheDocument();
  });

  it("cọc đã về (depositReceivedAt) hoặc đơn không phải đơn cọc → không có thẻ", async () => {
    await renderConfirmedScreen("PENDING_PAYMENT", {
      ...awaiting,
      depositReceivedAt: "2026-10-20T01:00:00Z",
    });
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByText("Chưa release được")).not.toBeInTheDocument();
  });

  it("người không có sales-orders:APPROVE (Sales) không thấy thẻ — họ không release được dù cọc đã về", async () => {
    await renderConfirmedScreen("PENDING_PAYMENT", awaiting, ORDER_PERMISSION_SETS.salesStaff);
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.queryByText("Chưa release được")).not.toBeInTheDocument();
  });
});

describe("lý do BE từ chối hiện trong hộp thoại, kèm mã quy tắc", () => {
  it("BR-PRD-08: DESIGN_SAMPLE_NOT_APPROVED → câu tiếng Việt + mã quy tắc + SKU thiếu mẫu + traceId; hộp thoại giữ nguyên", async () => {
    const { dialog } = await submitRelease(
      new ApiError(
        409,
        "DESIGN_SAMPLE_NOT_APPROVED",
        "Order SO-1 has new designs without an approved sample on CUP-PRINT-12OZ, MUG-9 (BR-PRD-08)",
        undefined,
        "corr-9",
      ),
    );
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("mẫu được khách duyệt");
    expect(alert).toHaveTextContent("BR-PRD-08");
    expect(alert).toHaveTextContent("SKU chưa có mẫu duyệt: CUP-PRINT-12OZ, MUG-9");
    expect(alert).toHaveTextContent("corr-9");
    expect(alert).not.toHaveTextContent("has new designs");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("câu BE không khớp mẫu → vẫn hiện chi tiết gốc để tham khảo", async () => {
    const { dialog } = await submitRelease(
      new ApiError(409, "DESIGN_SAMPLE_NOT_APPROVED", "No approved sample for: CUP-PRINT-12OZ"),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "No approved sample for: CUP-PRINT-12OZ",
    );
  });

  it("BR-PRD-09: ORDER_DEPOSIT_NOT_RECEIVED → chưa đủ cọc + mã", async () => {
    const { dialog } = await submitRelease(new ApiError(409, "ORDER_DEPOSIT_NOT_RECEIVED", "x"));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("chưa nhận đủ tiền cọc");
    expect(alert).toHaveTextContent("BR-PRD-09");
  });

  it("công nợ quá hạn → kèm mã BR-02", async () => {
    const overdue = await submitRelease(new ApiError(409, "CUSTOMER_CREDIT_OVERDUE", "x"));
    expect(await within(overdue.dialog).findByRole("alert")).toHaveTextContent(
      /công nợ quá hạn[\s\S]*BR-02/,
    );
  });

  it("CONFLICT (đơn không còn CONFIRMED) → đóng hộp thoại, toast, tải lại đơn", async () => {
    const toastError = vi.spyOn(toast, "error");
    await submitRelease(new ApiError(409, "CONFLICT", "x"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toastError).toHaveBeenCalledWith(
      "Không release được đơn",
      expect.stringMatching(/không còn ở trạng thái được release/),
    );
    await waitFor(() => expect(detailCalls()).toBe(2));
  });
});

describe("tranh chấp đồng thời — không tự gửi lại, vẫn bấm lại được", () => {
  it("OPTIMISTIC_LOCK → báo tại chỗ, GIỮ kho đã chọn, tải lại đơn, không tự gửi lại; bấm lại → gửi lần hai", async () => {
    const { user, dialog, post } = await submitRelease(new ApiError(409, "OPTIMISTIC_LOCK", "x"));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Đơn vừa được người khác cập nhật",
    );
    await waitFor(() => expect(detailCalls()).toBe(2));
    expect(post).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole("combobox", { name: /Kho xuất hàng/ })).toHaveTextContent(
      "HN01 — Kho Hà Nội",
    );

    post.mockResolvedValue({ data: apiOrder });
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  });

  it("LOCK_TIMEOUT → 'đang được xử lý ở nơi khác', KHÔNG tải lại vội, không tự gửi lại, vẫn bấm lại được", async () => {
    const { user, dialog, post } = await submitRelease(new ApiError(409, "LOCK_TIMEOUT", "x"));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "đang được xử lý ở nơi khác",
    );
    expect(detailCalls()).toBe(1);
    expect(post).toHaveBeenCalledTimes(1);
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  });
});

describe("Idempotency-Key của release", () => {
  it("lần đầu có key; BE nhả claim (LOCK_TIMEOUT) → bấm lại cùng nội dung dùng CÙNG key, mỗi lần bấm đúng một request", async () => {
    const { user, dialog, post } = await submitRelease(new ApiError(409, "LOCK_TIMEOUT", "x"));
    const first = keyOfCall(post.mock.calls, 0);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    await within(dialog).findByRole("alert");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(keyOfCall(post.mock.calls, 1)).toBe(first);
  });

  it("mất mạng (không biết BE đã chạy chưa) → giữ key cho lần bấm lại", async () => {
    const { user, dialog, post } = await submitRelease(new ApiError(0, "NETWORK_ERROR", "x"));
    await within(dialog).findByRole("alert");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(keyOfCall(post.mock.calls, 1)).toBe(keyOfCall(post.mock.calls, 0));
  });

  it("lỗi BE đã LƯU (403) → bấm lại dùng key MỚI (không bị trả lại mãi lỗi cũ)", async () => {
    const { user, dialog, post } = await submitRelease(new ApiError(403, "FORBIDDEN", "x"));
    await within(dialog).findByRole("alert");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(keyOfCall(post.mock.calls, 1)).not.toBe(keyOfCall(post.mock.calls, 0));
  });

  it("đổi kho giữa hai lần bấm → key mới (không bao giờ thành IDEMPOTENCY_KEY_REUSED vì người dùng sửa form)", async () => {
    const { user, dialog, post } = await submitRelease(new ApiError(409, "LOCK_TIMEOUT", "x"));
    await within(dialog).findByRole("alert");
    await pickSelectOption(user, /Kho xuất hàng/, "HCM01 — Kho TP.HCM");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(keyOfCall(post.mock.calls, 1)).not.toBe(keyOfCall(post.mock.calls, 0));
  });

  it("thành công → đóng; mở lại + gửi → key mới", async () => {
    const { post } = await submitRelease();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // mock-get trả lại đơn CONFIRMED nên nút còn: mở lại và gửi lần nữa
    const { user, dialog } = await openReleaseDialog();
    await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
    await user.click(within(dialog).getByRole("button", { name: "Release đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[0]?.[0]).toBe(RELEASE_PATH);
    expect(keyOfCall(post.mock.calls, 1)).not.toBe(keyOfCall(post.mock.calls, 0));
  });
});

describe("lỗi 400 theo ô, in-dòng, kho rỗng, ô kho", () => {
  it("fieldErrors.warehouseId (400 VALIDATION_FAILED) → lỗi ngay tại ô Kho xuất hàng, không có khối lý do chung", async () => {
    const { dialog } = await submitRelease(
      new ApiError(400, "VALIDATION_FAILED", "x", { warehouseId: "warehouseId is required" }),
    );
    expect(await within(dialog).findByText("Chọn kho xuất hàng.")).toBeInTheDocument();
    expect(within(dialog).queryByText("Không release được đơn")).not.toBeInTheDocument();
  });

  it("400 có thêm trường lạ → lỗi ô kho VÀ lý do chung", async () => {
    const { dialog } = await submitRelease(
      new ApiError(400, "VALIDATION_FAILED", "x", { warehouseId: "x", deliveryMode: "y" }),
    );
    expect(await within(dialog).findByText("Chọn kho xuất hàng.")).toBeInTheDocument();
    expect(within(dialog).getByText("Không release được đơn")).toBeInTheDocument();
  });

  it("đơn có dòng in → mô tả nêu số dòng in + gợi ý BR-PRD-08; đơn chỉ hàng sẵn → 'chỉ gồm hàng sẵn', không gợi ý", async () => {
    const line = { ...apiOrder.lines[0], designSnapshotId: "snap-1", designChecksum: "c" };
    await renderConfirmedScreen("CONFIRMED", {
      lines: [line, { ...line, lineId: "l-2", designSnapshotId: "snap-2" }],
    });
    const print = await openReleaseDialog();
    expect(print.dialog).toHaveTextContent("Đơn có 2 dòng in");
    expect(print.dialog).toHaveTextContent(
      /Dòng in chỉ release được cho kho có xưởng in[\s\S]*BR-PRD-08/,
    );
  });

  it("đơn chỉ hàng sẵn → 'Đơn chỉ gồm hàng sẵn', không có gợi ý dòng in", async () => {
    await renderConfirmedScreen();
    const { dialog } = await openReleaseDialog();
    expect(dialog).toHaveTextContent("Đơn chỉ gồm hàng sẵn");
    expect(dialog).not.toHaveTextContent("xưởng in");
  });

  it("danh sách kho rỗng → báo 'Chưa có kho nào đang hoạt động'", async () => {
    await renderConfirmedScreen(
      "CONFIRMED",
      {},
      ORDER_PERMISSION_SETS.coordinatorWithModes,
      () => ({ items: [] }),
    );
    const { dialog } = await openReleaseDialog();
    expect(await within(dialog).findByText("Chưa có kho nào đang hoạt động.")).toBeInTheDocument();
  });

  it("ô kho bị khoá khi danh sách kho chưa có (lỗi 403) — thông báo thiếu quyền vẫn là phương án dự phòng", async () => {
    await renderConfirmedScreen("CONFIRMED", {}, ORDER_PERMISSION_SETS.coordinatorWithModes, () => {
      throw new ApiError(403, "FORBIDDEN", "x");
    });
    const { dialog } = await openReleaseDialog();
    expect(await within(dialog).findByText(/warehouse-warehouses:READ/)).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: /Kho xuất hàng/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Release đơn" })).toBeDisabled();
  });
});
