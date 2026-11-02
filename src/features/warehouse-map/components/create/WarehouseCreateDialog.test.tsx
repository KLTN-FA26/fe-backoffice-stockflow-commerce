import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { renderWithProviders } from "@/test/render";

import { WarehouseCreateDialog } from "./WarehouseCreateDialog";

import type { WarehouseCreateBody } from "@/features/warehouse-map/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

type Handlers = {
  onSuccess: (w: { id: string; prefix: string }) => void;
  onError: (e: unknown) => void;
};
const mutate = vi.fn<(body: WarehouseCreateBody, handlers: Handlers) => void>();
vi.mock("@/features/warehouse-map/mutations", () => ({
  useCreateWarehouse: () => ({ mutate, isPending: false }),
}));

/** Danh mục hành chính 2 cấp (provinces.open-api.vn v2) — thay API thật trong test. */
const PROVINCES = [
  { code: 1, name: "Thành phố Hà Nội", codename: "ha_noi" },
  { code: 79, name: "Thành phố Hồ Chí Minh", codename: "ho_chi_minh" },
];
const WARDS = [{ code: 4, name: "Phường Ba Đình", codename: "phuong_ba_dinh" }];
vi.mock("@/lib/references/vn-divisions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/references/vn-divisions")>()),
  useVnProvinces: () => ({ data: PROVINCES, isPending: false, isError: false }),
  useVnWards: (code: number | null) => ({
    data: code === 1 ? WARDS : undefined,
    isPending: code === null,
    isError: false,
  }),
}));

/** Điền đủ form gõ nhiều ký tự qua combobox (cmdk) — chạy chung cả bộ test thì có thể quá 5 giây. */
const FILL_TIMEOUT = 15_000;

async function pick(label: RegExp, search: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.type(screen.getByRole("combobox", { name: label }), search);
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

async function fillValid() {
  await userEvent.type(screen.getByLabelText(/^Prefix mã vị trí/), "hn");
  await userEvent.type(screen.getByLabelText(/Tên kho/), "Kho Hà Nội");
  // Gõ không dấu vẫn tìm được (codename của API)
  await pick(/Tỉnh \/ thành phố/, "ha noi", "Thành phố Hà Nội");
  await pick(/Phường \/ xã/, "ba dinh", "Phường Ba Đình");
  await userEvent.type(screen.getByLabelText(/Số nhà, tên đường/), "Lô CN2, KCN Bắc Thăng Long");
  await userEvent.type(screen.getByLabelText(/Chiều rộng/), "60");
  await userEvent.type(screen.getByLabelText(/Chiều dài/), "40");
}

beforeEach(() => {
  // jsdom không có ResizeObserver / scrollIntoView mà `cmdk` (ô chọn tỉnh / xã) dùng
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  push.mockReset();
  mutate.mockReset();
});

describe("modal khai báo kho mới", () => {
  it(
    "chưa đủ ô bắt buộc thì không bấm Tạo kho được; đủ thì gửi prefix viết hoa",
    async () => {
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
        // Ghép một dòng như BE lưu; mã tỉnh / tên rời không gửi BE
        address: "Lô CN2, KCN Bắc Thăng Long, Phường Ba Đình, Thành phố Hà Nội",
      });
      expect(mutate.mock.calls[0]?.[0]).not.toHaveProperty("provinceCode");
    },
    FILL_TIMEOUT,
  );

  it('lưu ý không hiện sẵn — bấm "?" cạnh nhãn mới hiện', async () => {
    renderWithProviders(<WarehouseCreateDialog onClose={() => {}} />);
    expect(screen.queryByText(/Không đổi được/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Lưu ý: Prefix mã vị trí" }));
    expect(await screen.findByText(/Không đổi được/)).toBeInTheDocument();
  });

  it(
    "chưa chọn tỉnh thì chưa chọn được phường / xã; đổi tỉnh thì bỏ phường / xã cũ",
    async () => {
      renderWithProviders(<WarehouseCreateDialog onClose={() => {}} />);
      expect(screen.getByRole("combobox", { name: /Phường \/ xã/ })).toBeDisabled();
      await pick(/Tỉnh \/ thành phố/, "ha noi", "Thành phố Hà Nội");
      await pick(/Phường \/ xã/, "ba dinh", "Phường Ba Đình");
      await pick(/Tỉnh \/ thành phố/, "ho chi minh", "Thành phố Hồ Chí Minh");
      expect(screen.getByRole("combobox", { name: /Phường \/ xã/ })).toHaveValue("");
    },
    FILL_TIMEOUT,
  );

  it(
    "prefix trùng (409) → lỗi hiện ngay tại ô prefix, modal vẫn mở",
    async () => {
      const onClose = vi.fn();
      renderWithProviders(<WarehouseCreateDialog onClose={onClose} />);
      await fillValid();
      await userEvent.click(screen.getByRole("button", { name: "Tạo kho" }));
      mutate.mock.calls[0]?.[1].onError(
        new ApiError(409, "WAREHOUSE_PREFIX_ALREADY_EXISTS", "This prefix is already in use"),
      );
      expect(await screen.findByText(/Prefix này đã được kho khác dùng/)).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    },
    FILL_TIMEOUT,
  );

  it(
    "tạo xong → đóng modal và mở bản đồ của kho mới",
    async () => {
      const onClose = vi.fn();
      renderWithProviders(<WarehouseCreateDialog onClose={onClose} />);
      await fillValid();
      await userEvent.click(screen.getByRole("button", { name: "Tạo kho" }));
      mutate.mock.calls[0]?.[1].onSuccess({ id: "wh-new", prefix: "HN" });
      expect(onClose).toHaveBeenCalled();
      // URL theo prefix kho (duy nhất, không đổi — BR-13), vào thẳng kho mới, không qua bước chọn kho
      expect(push).toHaveBeenCalledWith("/admin/warehouse-map/HN");
    },
    FILL_TIMEOUT,
  );
});
