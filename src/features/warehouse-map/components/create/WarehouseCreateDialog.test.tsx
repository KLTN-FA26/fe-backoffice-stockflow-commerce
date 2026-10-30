import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { renderWithProviders } from "@/test/render";

import { WarehouseCreateDialog } from "./WarehouseCreateDialog";

import type { WarehouseCreateBody } from "@/features/warehouse-map/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

type Handlers = { onSuccess: (w: { id: string }) => void; onError: (e: unknown) => void };
const mutate = vi.fn<(body: WarehouseCreateBody, handlers: Handlers) => void>();
vi.mock("@/features/warehouse-map/mutations", () => ({
  useCreateWarehouse: () => ({ mutate, isPending: false }),
}));

async function fillValid() {
  await userEvent.type(screen.getByLabelText(/Prefix mã vị trí/), "hn");
  await userEvent.type(screen.getByLabelText(/Tên kho/), "Kho Hà Nội");
  await userEvent.type(screen.getByLabelText(/Địa chỉ kho/), "Lô CN2, KCN Bắc Thăng Long");
  await userEvent.type(screen.getByLabelText(/Chiều rộng/), "60");
  await userEvent.type(screen.getByLabelText(/Chiều dài/), "40");
}

beforeEach(() => {
  push.mockReset();
  mutate.mockReset();
});

describe("modal khai báo kho mới", () => {
  it("chưa đủ ô bắt buộc thì không bấm Tạo kho được; đủ thì gửi prefix viết hoa", async () => {
    renderWithProviders(<WarehouseCreateDialog onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Khai báo kho mới" })).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Tạo kho" });
    expect(submit).toBeDisabled();
    await fillValid();
    // Xem trước mã bin theo prefix đang nhập (BR-10)
    expect(screen.getByText("HN-A01-1-01")).toBeInTheDocument();
    await userEvent.click(submit);
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      prefix: "HN",
      mapUnit: "M",
      mapWidth: 60,
      mapHeight: 40,
      returnAddress: null,
    });
  });

  it("prefix trùng (409) → lỗi hiện ngay tại ô prefix, modal vẫn mở", async () => {
    const onClose = vi.fn();
    renderWithProviders(<WarehouseCreateDialog onClose={onClose} />);
    await fillValid();
    await userEvent.click(screen.getByRole("button", { name: "Tạo kho" }));
    mutate.mock.calls[0]?.[1].onError(
      new ApiError(409, "WAREHOUSE_PREFIX_ALREADY_EXISTS", "This prefix is already in use"),
    );
    expect(await screen.findByText(/Prefix này đã được kho khác dùng/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("tạo xong → đóng modal và mở bản đồ của kho mới", async () => {
    const onClose = vi.fn();
    renderWithProviders(<WarehouseCreateDialog onClose={onClose} />);
    await fillValid();
    await userEvent.click(screen.getByRole("button", { name: "Tạo kho" }));
    mutate.mock.calls[0]?.[1].onSuccess({ id: "wh-new" });
    expect(onClose).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/admin/warehouse-map?warehouse=wh-new");
  });
});
