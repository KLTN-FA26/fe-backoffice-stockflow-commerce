import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { bePage, mockApi, renderScreen } from "@/test/api-screen";

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

function Harness({ onPick, locked }: { onPick: (id: string) => void; locked?: boolean }) {
  const [value, setValue] = useState(locked ? "c-1" : "");
  return (
    <CustomerPicker
      value={value}
      locked={locked}
      onChange={(id) => {
        setValue(id);
        onPick(id);
      }}
    />
  );
}

describe("CustomerPicker — InputCombobox chọn khách ACTIVE (BE lọc theo q)", () => {
  it("gõ tên → BE tìm khách ACTIVE theo q, ↓ + Enter chọn, rồi hiện tên + Đổi khách", async () => {
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
    expect(api.get).not.toHaveBeenCalledWith("/customers", expect.anything());
    await user.type(box, "Mộc");
    const option = await screen.findByRole("option", { name: /Công ty Mộc An/ });
    expect(option).toHaveTextContent("Công ty Mộc An — mua@mocan.vn — MST 0312345678");
    const params = new URLSearchParams(
      api.get.mock.calls
        .filter(([url]) => url === "/customers")
        .map(([, config]) => (config as { params: URLSearchParams }).params)
        .at(-1),
    );
    expect(params.get("q")).toBe("Mộc");
    expect(params.get("status")).toBe("ACTIVE");

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenLastCalledWith("c-1");
    expect(await screen.findByRole("button", { name: "Đổi khách" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("không khớp → nói rõ không có khách hoạt động, không chọn gì", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    mockApi("SALES_STAFF", { get: { "/customers": () => bePage([]) } });
    renderScreen(<Harness onPick={onPick} />, "SALES_STAFF");
    await user.type(screen.getByRole("combobox", { name: "Khách hàng" }), "zzz");
    expect(await screen.findByText("Không có khách hoạt động khớp.")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Khách hàng" })).toHaveAttribute(
        "aria-expanded",
        "false",
      ),
    );
    expect(onPick).not.toHaveBeenCalled();
  });

  it("locked (sửa báo giá / mẫu từ báo giá) → chỉ hiện tên khách, không đổi được", async () => {
    mockApi("SALES_STAFF", { get: { "/customers/c-1": () => MOC_AN } });
    renderScreen(<Harness onPick={vi.fn()} locked />, "SALES_STAFF");
    expect(await screen.findByText("Công ty Mộc An")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đổi khách" })).not.toBeInTheDocument();
  });
});
