import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { renderWithProviders } from "@/test/render";

import { LAYOUT } from "../../__fixtures__/layout";
import { LocationLabelsDialog } from "./LocationLabelsDialog";

import type { LocationLabelBody, LocationLabelsPdf } from "@/features/warehouse-map/types";

const P = UI_LABELS.warehouseMap.print;

type Handlers = { onSuccess: (pdf: LocationLabelsPdf) => void; onError: (e: unknown) => void };
const mutate =
  vi.fn<(input: { warehouseId: string; body: LocationLabelBody }, handlers: Handlers) => void>();
vi.mock("@/features/warehouse-map/mutations", () => ({
  usePrintLocationLabels: () => ({ mutate, isPending: false }),
}));

const submitButton = (name: string = P.generate) => screen.getByRole("button", { name });

beforeEach(() => {
  mutate.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:labels");
  URL.revokeObjectURL = vi.fn();
});

describe("dialog in nhãn vị trí (docs 06 §4.3, BR-17)", () => {
  it("mặc định cả kho: báo số nhãn sẽ in (bỏ vị trí ngừng dùng) rồi gửi đúng body", async () => {
    renderWithProviders(<LocationLabelsDialog layout={LAYOUT} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: P.title })).toBeInTheDocument();
    // Kệ A01: 2 bin tầng 1 (một BLOCKED vẫn in) + 1 bin tầng 2; khu RCV01. Kệ Z99 ngừng dùng → 0
    expect(screen.getByText(P.count(4))).toBeInTheDocument();
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await userEvent.click(screen.getByRole("radio", { name: /Cuộn nhiệt/ }));
    await userEvent.click(submitButton());
    expect(mutate).toHaveBeenCalledWith(
      { warehouseId: "wh-hcm", body: { format: "THERMAL_ROLL" } },
      expect.anything(),
    );
  });

  it("danh sách mã: mã kho không có → lỗi tại ô, không gửi được", async () => {
    renderWithProviders(<LocationLabelsDialog layout={LAYOUT} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("radio", { name: P.scopes.CODES }));
    await userEvent.type(screen.getByRole("textbox", { name: /Mã vị trí/ }), "hcm-a01-1-a, HCM-X9");
    expect(await screen.findByText(P.validation.codesUnknown("HCM-X9"))).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it("BE từ chối → câu tiếng Việt trong dialog; thành công → xem trước + Tải xuống, đổi lựa chọn thì ẩn file cũ", async () => {
    renderWithProviders(<LocationLabelsDialog layout={LAYOUT} onClose={() => {}} />);
    await waitFor(() => expect(submitButton()).toBeEnabled());
    mutate.mockImplementationOnce((_input, handlers) =>
      handlers.onError(new ApiError(422, "LOCATION_LABELS_TOO_MANY", "2001 labels")),
    );
    await userEvent.click(submitButton());
    expect(await screen.findByText(P.validation.tooMany)).toBeInTheDocument();

    mutate.mockImplementationOnce((_input, handlers) =>
      handlers.onSuccess({ blob: new Blob(["%PDF"]), fileName: "location-labels-HCM.pdf" }),
    );
    await userEvent.click(submitButton());
    expect(await screen.findByTitle(P.preview)).toHaveAttribute("src", "blob:labels");
    expect(screen.getByRole("link", { name: P.download })).toHaveAttribute(
      "download",
      "location-labels-HCM.pdf",
    );
    expect(submitButton(P.regenerate)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: P.scopes.ZONE }));
    expect(screen.queryByTitle(P.preview)).not.toBeInTheDocument();
  });

  it("mở từ chi tiết kệ: chọn sẵn phạm vi Một kệ với kệ đó, gửi shelfId", async () => {
    renderWithProviders(
      <LocationLabelsDialog layout={LAYOUT} shelfId="shelf-a01" onClose={() => {}} />,
    );
    expect(screen.getByRole("radio", { name: P.scopes.SHELF })).toBeChecked();
    // Kệ A01: 2 bin tầng 1 + 1 bin tầng 2 — không gồm khu RCV01
    expect(screen.getByText(P.count(3))).toBeInTheDocument();
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await userEvent.click(submitButton());
    expect(mutate).toHaveBeenCalledWith(
      { warehouseId: "wh-hcm", body: { format: "A4_SHEET", shelfId: "shelf-a01" } },
      expect.anything(),
    );
  });
});
