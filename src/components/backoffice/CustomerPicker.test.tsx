import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { bePage, mockApi, renderScreen } from "@/test/api-screen";
import { openComboboxList } from "@/test/combobox";

import { CustomerPicker } from "./CustomerPicker";

afterEach(() => vi.restoreAllMocks());

beforeAll(() => {
  // jsdom không có ResizeObserver / scrollIntoView mà `cmdk` dùng
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

const MOC_AN = {
  customerId: "c-1",
  fullName: "Công ty Mộc An",
  email: "mua@mocan.vn",
  taxCode: "0312345678",
  status: "ACTIVE",
};

function Harness({
  onPick,
  locked,
  mode,
}: {
  onPick: (id: string) => void;
  locked?: boolean;
  mode?: "pick" | "filter";
}) {
  const [value, setValue] = useState(locked ? "c-1" : "");
  return (
    <CustomerPicker
      value={value}
      locked={locked}
      mode={mode}
      onChange={(id) => {
        setValue(id);
        onPick(id);
      }}
    />
  );
}

function customerParams(api: ReturnType<typeof mockApi>) {
  return new URLSearchParams(
    api.get.mock.calls
      .filter(([url]) => url === "/customers")
      .map(([, config]) => (config as { params: URLSearchParams }).params)
      .at(-1),
  );
}

describe("CustomerPicker — InputCombobox chọn khách (BE lọc theo q)", () => {
  it("bấm vào ô không mở danh sách, không gọi BE; gõ → BE tìm khách ACTIVE theo q, ↓ + Enter chọn, ô giữ tên + ✕", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const api = mockApi("SALES_STAFF", {
      get: {
        "/customers": (params) =>
          new URLSearchParams(params as URLSearchParams).get("q") ? bePage([MOC_AN]) : bePage([]),
        "/customers/c-1": () => MOC_AN,
      },
    });
    renderScreen(<Harness onPick={onPick} />, "SALES_STAFF");

    const box = screen.getByRole("combobox", { name: "Khách hàng" });
    await user.click(box);
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(api.get).not.toHaveBeenCalledWith("/customers", expect.anything());

    await user.type(box, "Mộc");
    const option = await screen.findByRole("option", { name: /Công ty Mộc An/ });
    // 2 tầng: tên / MST — không còn email, không còn "—" nối chữ
    expect(within(option).getByText("Công ty Mộc An")).toBeInTheDocument();
    expect(within(option).getByText("MST 0312345678")).toBeInTheDocument();
    expect(option).not.toHaveTextContent("mua@mocan.vn");
    const params = customerParams(api);
    expect(params.get("q")).toBe("Mộc");
    expect(params.get("status")).toBe("ACTIVE");
    expect(params.get("size")).toBe("10");

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenLastCalledWith("c-1");
    // Chọn xong: tên nằm trong ô (không biến thành chữ + "Đổi khách"), có ✕ để bỏ chọn
    expect(screen.getByRole("combobox", { name: "Khách hàng" })).toHaveValue("Công ty Mộc An");
    expect(screen.queryByRole("button", { name: "Đổi khách" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Bỏ chọn Khách hàng" }));
    expect(onPick).toHaveBeenLastCalledWith("");
    expect(screen.getByRole("combobox", { name: "Khách hàng" })).toHaveValue("");
  });

  it("còn nhiều khách hơn số dòng hiện → 'Còn N khách — gõ thêm để thu hẹp'", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 10 }, (_, i) => ({
      ...MOC_AN,
      customerId: `c-${i}`,
      fullName: `Công ty Mộc ${i}`,
    }));
    mockApi("SALES_STAFF", {
      get: { "/customers": () => ({ ...bePage(many), totalElements: 37, hasNext: true }) },
    });
    renderScreen(<Harness onPick={vi.fn()} />, "SALES_STAFF");

    await openComboboxList(user, "Khách hàng");
    expect(await screen.findAllByRole("option")).toHaveLength(10);
    expect(screen.getByText("Còn 27 khách — gõ thêm để thu hẹp")).toBeInTheDocument();
  });

  it("BE#488: có tỉnh giao mặc định → dòng phụ 'MST · tỉnh'; không có tỉnh (BE cũ / thiếu quyền địa chỉ) → chỉ MST", async () => {
    const user = userEvent.setup();
    mockApi("SALES_STAFF", {
      get: {
        "/customers": () =>
          bePage([
            { ...MOC_AN, defaultShippingProvinceName: "Bình Dương" },
            { ...MOC_AN, customerId: "c-2", fullName: "Công ty Lá Xanh", taxCode: "0100000001" },
          ]),
      },
    });
    renderScreen(<Harness onPick={vi.fn()} />, "SALES_STAFF");
    await openComboboxList(user, "Khách hàng");
    expect(await screen.findByText("MST 0312345678 · Bình Dương")).toBeInTheDocument();
    expect(screen.getByText("MST 0100000001")).toBeInTheDocument();
  });

  it("có tỉnh nhưng không có MST → chỉ tỉnh", async () => {
    const user = userEvent.setup();
    mockApi("SALES_STAFF", {
      get: {
        "/customers": () =>
          bePage([{ ...MOC_AN, taxCode: null, defaultShippingProvinceName: "Hà Nội" }]),
      },
    });
    renderScreen(<Harness onPick={vi.fn()} />, "SALES_STAFF");
    await openComboboxList(user, "Khách hàng");
    expect(await screen.findByText("Hà Nội")).toBeInTheDocument();
  });

  it("khách không có MST → dòng phụ là email", async () => {
    const user = userEvent.setup();
    mockApi("SALES_STAFF", {
      get: { "/customers": () => bePage([{ ...MOC_AN, taxCode: null }]) },
    });
    renderScreen(<Harness onPick={vi.fn()} />, "SALES_STAFF");
    await openComboboxList(user, "Khách hàng");
    expect(await screen.findByText("mua@mocan.vn")).toBeInTheDocument();
  });

  it("không khớp → nói rõ không có khách hoạt động + lối mở hồ sơ khách (tab mới), không chọn gì", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    mockApi("SALES_STAFF", { get: { "/customers": () => bePage([]) } });
    renderScreen(<Harness onPick={onPick} />, "SALES_STAFF");
    await user.type(screen.getByRole("combobox", { name: "Khách hàng" }), "zzz");
    expect(await screen.findByText("Không có khách hoạt động khớp.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Mở hồ sơ khách" });
    expect(link).toHaveAttribute("href", "/admin/customers");
    expect(link).toHaveAttribute("target", "_blank");
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Khách hàng" })).toHaveAttribute(
        "aria-expanded",
        "false",
      ),
    );
    expect(onPick).not.toHaveBeenCalled();
  });

  it("chế độ lọc: không ép khách ACTIVE, không dấu *, không lối mở hồ sơ khi không khớp", async () => {
    const user = userEvent.setup();
    const api = mockApi("SALES_STAFF", { get: { "/customers": () => bePage([]) } });
    renderScreen(<Harness onPick={vi.fn()} mode="filter" />, "SALES_STAFF");
    expect(screen.queryByText(/Chỉ khách đã kích hoạt/)).not.toBeInTheDocument();
    await user.type(screen.getByRole("combobox", { name: "Khách hàng" }), "zzz");
    expect(await screen.findByText("Không có khách khớp.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mở hồ sơ khách" })).not.toBeInTheDocument();
    expect(customerParams(api).has("status")).toBe(false);
  });

  it("đang tải tên khách đã chọn → ô để trống (không hiện nhãn 'Khách hàng' như đã chọn); tải xong hiện tên", async () => {
    let release: (customer: typeof MOC_AN) => void = () => {};
    const pending = new Promise<typeof MOC_AN>((resolve) => (release = resolve));
    mockApi("SALES_STAFF", { get: { "/customers/c-1": () => pending } });
    renderScreen(<Harness onPick={vi.fn()} locked />, "SALES_STAFF");
    const box = screen.getByRole("combobox", { name: "Khách hàng" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(box).toHaveValue("");
    release(MOC_AN);
    await waitFor(() => expect(box).toHaveValue("Công ty Mộc An"));
  });

  it("tải tên khách lỗi (thiếu quyền tra khách) → nhãn trung tính 'Khách hàng', không UUID", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/customers/c-1": () => {
          throw new Error("403");
        },
      },
    });
    renderScreen(<Harness onPick={vi.fn()} locked />, "SALES_STAFF");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Khách hàng" })).toHaveValue("Khách hàng"),
    );
  });

  it("locked (sửa báo giá / mẫu từ báo giá) → ô hiện tên khách nhưng khoá, không ✕, không đổi được", async () => {
    mockApi("SALES_STAFF", { get: { "/customers/c-1": () => MOC_AN } });
    renderScreen(<Harness onPick={vi.fn()} locked />, "SALES_STAFF");
    const box = screen.getByRole("combobox", { name: "Khách hàng" });
    await waitFor(() => expect(box).toHaveValue("Công ty Mộc An"));
    expect(box).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Bỏ chọn Khách hàng" })).not.toBeInTheDocument();
  });
});
