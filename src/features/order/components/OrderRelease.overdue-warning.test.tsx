/**
 * Release đơn — cảnh báo "Khách đang có đợt thanh toán quá hạn" ngay khi mở hộp thoại (BE `GET
 * /orders/{id}/release-warnings`, WF4-OVERDUE-WARN, docs 15 §4.3 bước 11). Chỉ cảnh báo: BE không còn từ chối release vì
 * công nợ quá hạn, nút Release vẫn dùng được.
 */
import { waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiOrder } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, pickSelectOption } from "../__fixtures__/render";
import {
  openReleaseDialog,
  RELEASE_PATH,
  RELEASE_WARNINGS_PATH,
  renderConfirmedScreen,
} from "../__fixtures__/release";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const WARNING = /Khách đang có đợt thanh toán quá hạn/;
const OVERDUE = () => ({ creditWarning: { outcome: "OVERDUE" } });

async function open(warnings: () => unknown) {
  await renderConfirmedScreen(
    "CONFIRMED",
    {},
    ORDER_PERMISSION_SETS.warehouseManager,
    undefined,
    warnings,
  );
  return openReleaseDialog();
}

describe("cảnh báo công nợ quá hạn trong hộp thoại Release", () => {
  it("khách quá hạn → cảnh báo hiện ngay khi mở hộp thoại, trước khi bấm gì", async () => {
    const { dialog } = await open(OVERDUE);
    expect(await within(dialog).findByText(WARNING)).toBeInTheDocument();
    expect(vi.mocked(api.get)).toHaveBeenCalledWith(RELEASE_WARNINGS_PATH, expect.anything());
  });

  it("cảnh báo không chặn: vẫn chọn kho và release được, body không đổi", async () => {
    const { user, dialog } = await open(OVERDUE);
    await within(dialog).findByText(WARNING);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrder });

    await pickSelectOption(user, /Kho xuất hàng/, "HN01 — Kho Hà Nội");
    const submit = within(dialog).getByRole("button", { name: "Release đơn" });
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(RELEASE_PATH, { warehouseId: "wh-hn" }, expect.anything()),
    );
  });

  it("khách không quá hạn (BE không trả creditWarning) → không có cảnh báo", async () => {
    const { dialog } = await open(() => ({}));
    await waitFor(() =>
      expect(vi.mocked(api.get)).toHaveBeenCalledWith(RELEASE_WARNINGS_PATH, expect.anything()),
    );
    expect(within(dialog).queryByText(WARNING)).not.toBeInTheDocument();
  });

  it("không tải được cảnh báo → im lặng: không cảnh báo, không lỗi, vẫn release được", async () => {
    const { dialog } = await open(() => {
      throw new ApiError(500, "INTERNAL_ERROR", "boom");
    });
    await waitFor(() =>
      expect(vi.mocked(api.get)).toHaveBeenCalledWith(RELEASE_WARNINGS_PATH, expect.anything()),
    );
    expect(within(dialog).queryByText(WARNING)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Release đơn" })).toBeInTheDocument();
  });
});
