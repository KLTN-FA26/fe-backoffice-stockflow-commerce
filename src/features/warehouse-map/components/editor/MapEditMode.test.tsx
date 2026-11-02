import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/render";

import { LAYOUT } from "@/features/warehouse-map/__fixtures__/layout";

import { toast } from "@/components/shared/Toast";

import { MapEditMode } from "./MapEditMode";

import type { EditorCanvasProps } from "./canvas/EditorCanvas";

/** jsdom không có canvas — thay Konva bằng nút giả gọi đúng callback của canvas. */
vi.mock("next/dynamic", () => ({
  default: () =>
    function FakeCanvas(props: EditorCanvasProps) {
      return (
        <div>
          <button
            type="button"
            onClick={() => props.onDraw({ kind: "shelf", box: { x: 20, y: 20, w: 4, h: 1 } })}
          >
            vẽ kệ
          </button>
          <button type="button" onClick={() => props.onSelect("shelf-a01")}>
            chọn A01
          </button>
          <button type="button" onClick={() => props.onBlockedMove("shelf-a01")}>
            kéo A01
          </button>
        </div>
      );
    },
}));

const stock = vi.fn(() => ({ data: false, isError: false }));
vi.mock("@/features/warehouse-map/queries", () => ({ usePlaceHasStock: () => stock() }));
const mutate = vi.fn();
vi.mock("@/features/warehouse-map/mutations", () => ({
  useSaveMapDraft: () => ({ mutate, isPending: false }),
}));

const onExit = vi.fn();
const MANAGER = { update: true, delete: true };

beforeEach(() => {
  // jsdom không có ResizeObserver mà Checkbox (Radix) dùng
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  vi.clearAllMocks();
  stock.mockReturnValue({ data: false, isError: false });
});

afterEach(() => vi.restoreAllMocks());

describe("chế độ sửa bản đồ", () => {
  it("vẽ kệ → bản nháp chưa lưu với mã gợi ý; Lưu gửi cả bản nháp một lần", async () => {
    renderWithProviders(<MapEditMode layout={LAYOUT} can={MANAGER} onExit={onExit} />);
    expect(screen.getByRole("button", { name: /^Lưu$/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "vẽ kệ" }));
    await userEvent.click(screen.getByRole("button", { name: /Thông số/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Kệ K01")).toBeInTheDocument();
    expect(within(dialog).getByText("Mới — chưa lưu")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Xong" }));
    await userEvent.click(screen.getByRole("button", { name: "Lưu 1 thay đổi" }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({ warehouseId: LAYOUT.warehouse.id });
  });

  it("công cụ sửa ở thanh ngang trên đầu, zoom ở thanh dọc bên phải; phím K chọn vẽ kệ", async () => {
    renderWithProviders(<MapEditMode layout={LAYOUT} can={MANAGER} onExit={onExit} />);
    const bar = screen.getByRole("toolbar", { name: "Thanh công cụ sửa" });
    expect(bar).toHaveAttribute("aria-orientation", "horizontal");
    expect(screen.getByRole("toolbar", { name: "Điều khiển bản đồ" })).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
    const tools = within(bar).getByRole("group", { name: "Công cụ vẽ" });
    expect(within(tools).getByRole("button", { name: /Chọn \/ di chuyển/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.keyboard("k");
    expect(within(tools).getByRole("button", { name: /Vẽ kệ/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // H = bàn tay, như modal phím tắt và tooltip ghi
    await userEvent.keyboard("h");
    expect(within(tools).getByRole("button", { name: /Bàn tay/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("BR-04: kệ đã lưu còn hàng → khoá vị trí và ngừng dùng, mã không sửa được (BR-13)", async () => {
    stock.mockReturnValue({ data: true, isError: false });
    renderWithProviders(<MapEditMode layout={LAYOUT} can={MANAGER} onExit={onExit} />);
    await userEvent.click(screen.getByRole("button", { name: "chọn A01" }));
    expect(screen.getByRole("button", { name: /Xoá \(Delete\)/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Thông số/ }));
    expect(screen.getByText(/Vị trí đang có hàng/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ngừng dùng/ })).toBeDisabled();
    expect(screen.getByLabelText("X (m)")).toBeDisabled();
    expect(screen.getByLabelText("Mã")).toBeDisabled();
    expect(screen.getByLabelText("Tên")).toBeEnabled();
  });

  it("BR-04: dời kệ còn hàng (kéo / phím mũi tên / xoay) → cảnh báo không được di chuyển, bản nháp không đổi", async () => {
    stock.mockReturnValue({ data: true, isError: false });
    const warning = vi.spyOn(toast, "warning");
    renderWithProviders(<MapEditMode layout={LAYOUT} can={MANAGER} onExit={onExit} />);
    await userEvent.click(screen.getByRole("button", { name: "chọn A01" }));
    await userEvent.click(screen.getByRole("button", { name: "kéo A01" }));
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("{ArrowRight}r");
    expect(warning).toHaveBeenCalledTimes(3);
    expect(warning).toHaveBeenLastCalledWith(
      expect.stringMatching(/đang có hàng — không được di chuyển/),
      undefined,
      { id: "move-blocked:shelf-a01" },
    );
    expect(screen.getByRole("button", { name: /^Lưu$/ })).toBeDisabled();
  });

  it("kệ không còn hàng → phím mũi tên dời được, không cảnh báo", async () => {
    const warning = vi.spyOn(toast, "warning");
    renderWithProviders(<MapEditMode layout={LAYOUT} can={MANAGER} onExit={onExit} />);
    await userEvent.click(screen.getByRole("button", { name: "chọn A01" }));
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("{ArrowRight}");
    expect(warning).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Lưu 1 thay đổi" })).toBeEnabled();
  });

  it("thiếu quyền sửa → dời kệ đã lưu báo không có quyền", async () => {
    const warning = vi.spyOn(toast, "warning");
    renderWithProviders(
      <MapEditMode layout={LAYOUT} can={{ update: false, delete: false }} onExit={onExit} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "kéo A01" }));
    expect(warning).not.toHaveBeenCalled(); // chưa chọn thì không báo
    await userEvent.click(screen.getByRole("button", { name: "chọn A01" }));
    await userEvent.click(screen.getByRole("button", { name: "kéo A01" }));
    expect(warning).toHaveBeenCalledWith(expect.stringMatching(/không có quyền sửa/), undefined, {
      id: "move-blocked:shelf-a01",
    });
  });

  it("phím tắt: Ctrl+Z hoàn tác hình vừa vẽ, Ctrl+Shift+Z làm lại, Ctrl+S lưu", async () => {
    renderWithProviders(<MapEditMode layout={LAYOUT} can={MANAGER} onExit={onExit} />);
    await userEvent.click(screen.getByRole("button", { name: "vẽ kệ" }));
    expect(screen.getByRole("button", { name: "Lưu 1 thay đổi" })).toBeEnabled();
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(screen.getByRole("button", { name: /^Lưu$/ })).toBeDisabled();
    await userEvent.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(screen.getByRole("button", { name: "Lưu 1 thay đổi" })).toBeEnabled();
    await userEvent.keyboard("{Control>}s{/Control}");
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+D nhân bản hình đang chọn thành hình mới", async () => {
    renderWithProviders(<MapEditMode layout={LAYOUT} can={MANAGER} onExit={onExit} />);
    await userEvent.click(screen.getByRole("button", { name: "vẽ kệ" }));
    await userEvent.keyboard("{Control>}d{/Control}");
    expect(screen.getByRole("button", { name: "Lưu 2 thay đổi" })).toBeEnabled();
  });

  it("Ctrl+C rồi Ctrl+V dán hình mới ngay dưới; dán tiếp ra thêm hình", async () => {
    renderWithProviders(<MapEditMode layout={LAYOUT} can={MANAGER} onExit={onExit} />);
    await userEvent.click(screen.getByRole("button", { name: "vẽ kệ" }));
    (document.activeElement as HTMLElement | null)?.blur();
    expect(screen.getByRole("button", { name: /^Dán/ })).toBeDisabled();
    await userEvent.keyboard("{Control>}c{/Control}");
    expect(screen.getByRole("button", { name: /^Dán/ })).toBeEnabled();
    await userEvent.keyboard("{Control>}v{/Control}{Control>}v{/Control}");
    expect(screen.getByRole("button", { name: "Lưu 3 thay đổi" })).toBeEnabled();
  });

  it("bấm vào khoảng trống quanh bản đồ thì bỏ chọn hình đang chọn", async () => {
    renderWithProviders(<MapEditMode layout={LAYOUT} can={MANAGER} onExit={onExit} />);
    await userEvent.click(screen.getByRole("button", { name: "vẽ kệ" }));
    expect(screen.getByRole("button", { name: /^Thông số/ })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("map-edit-viewport"));
    expect(screen.queryByRole("button", { name: /^Thông số/ })).not.toBeInTheDocument();
  });

  it("thoát khi còn thay đổi chưa lưu → hỏi lại; không đổi gì → thoát ngay", async () => {
    renderWithProviders(<MapEditMode layout={LAYOUT} can={MANAGER} onExit={onExit} />);
    await userEvent.click(screen.getByRole("button", { name: /Thoát/ }));
    expect(onExit).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "vẽ kệ" }));
    await userEvent.click(screen.getByRole("button", { name: /Thoát/ }));
    expect(await screen.findByText("Bỏ các thay đổi chưa lưu?")).toBeInTheDocument();
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
