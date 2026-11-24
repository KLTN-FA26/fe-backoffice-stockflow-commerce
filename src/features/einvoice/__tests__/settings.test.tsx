import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EINVOICE_SETTINGS_PERMISSIONS } from "@/constants/einvoice";
import { ApiError } from "@/lib/api/error";

import { mockEInvoiceApi, renderEInvoiceScreen } from "../__fixtures__/screen";
import { EInvoiceSettingsView } from "../components/EInvoiceSettingsView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/invoicing/settings",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const ADMIN = Object.values(EINVOICE_SETTINGS_PERMISSIONS);
const ACCOUNTANT = [EINVOICE_SETTINGS_PERMISSIONS.read];
const settings = {
  provider: "VIETTEL_SINVOICE",
  environment: "SANDBOX",
  endpoint: "https://sinvoice.example",
  username: "stockflow",
  secretSet: true,
  autoIssue: false,
  series: [{ templateCode: "1", symbol: "C26TAA", year: 2026 }],
  version: 2,
};
const provider = {
  provider: "VIETTEL_SINVOICE",
  environment: "SANDBOX",
  username: "stockflow",
  secretSet: true,
  active: true,
  autoIssue: false,
  version: 2,
};
const routes = {
  get: {
    "/einvoice-settings": () => settings,
    "/einvoice-settings/providers": () => [provider],
  },
  put: {
    "/einvoice-settings": () => ({ ...settings, autoIssue: true, version: 3 }),
    "/einvoice-settings/providers/VIETTEL_SINVOICE/series": () => null,
  },
};

describe("EInvoiceSettingsView (docs 21 BR-10)", () => {
  it("shows the provider in use and its series; the password is never shown", async () => {
    mockEInvoiceApi(ADMIN, routes);
    renderEInvoiceScreen(<EInvoiceSettingsView />);
    expect(await screen.findByText("Viettel SInvoice")).toBeInTheDocument();
    expect(screen.getByText("1C26TAA (2026)")).toBeInTheDocument();
    expect(screen.getByText("Đã lưu (không hiển thị)")).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu mới (bỏ trống = giữ)")).toHaveValue("");
  });

  it("the admin turns automatic issuing on, sending the version read", async () => {
    const api = mockEInvoiceApi(ADMIN, routes);
    renderEInvoiceScreen(<EInvoiceSettingsView />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /Tự phát hành/ }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/einvoice-settings", { autoIssue: true, version: 2 }),
    );
  });

  it("BO-10: a real provider needs its own template code before the series is sent", async () => {
    const api = mockEInvoiceApi(ADMIN, routes);
    renderEInvoiceScreen(<EInvoiceSettingsView />);
    await userEvent.type(await screen.findByLabelText(/^Ký hiệu/), "C26TAA");
    await userEvent.click(screen.getByRole("button", { name: "Dùng ký hiệu" }));
    expect(await screen.findByText("Nhập mã mẫu của nhà cung cấp")).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalledWith(
      "/einvoice-settings/providers/VIETTEL_SINVOICE/series",
      expect.anything(),
    );
    await userEvent.type(screen.getByLabelText(/Mã mẫu của nhà cung cấp/), "1/001");
    await userEvent.click(screen.getByRole("button", { name: "Dùng ký hiệu" }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/einvoice-settings/providers/VIETTEL_SINVOICE/series", {
        templateCode: "1",
        symbol: "C26TAA",
        year: new Date().getFullYear(),
        providerTemplateCode: "1/001",
      }),
    );
  });

  it("BO-10: the BE's field errors land under the field", async () => {
    mockEInvoiceApi(ADMIN, {
      ...routes,
      put: {
        ...routes.put,
        "/einvoice-settings/providers/VIETTEL_SINVOICE/account": () => {
          throw new ApiError(400, "VALIDATION_FAILED", "x", { username: "Tên đăng nhập bị khoá" });
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceSettingsView />);
    await userEvent.click(await screen.findByRole("button", { name: "Lưu tài khoản" }));
    expect(await screen.findByText("Tên đăng nhập bị khoá")).toBeInTheDocument();
  });

  it("BO-10: SECRETS_UNAVAILABLE reads in Vietnamese", async () => {
    mockEInvoiceApi(ADMIN, {
      ...routes,
      put: {
        ...routes.put,
        "/einvoice-settings/providers/VIETTEL_SINVOICE/account": () => {
          throw new ApiError(503, "SECRETS_UNAVAILABLE", "no key");
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceSettingsView />);
    await userEvent.click(await screen.findByRole("button", { name: "Lưu tài khoản" }));
    expect(await screen.findByText(/khoá mã hoá bí mật/)).toBeInTheDocument();
  });

  it("refuses a malformed series symbol before sending it (BR-07)", async () => {
    const api = mockEInvoiceApi(ADMIN, routes);
    renderEInvoiceScreen(<EInvoiceSettingsView />);
    await userEvent.type(await screen.findByLabelText(/Ký hiệu/), "ABC");
    await userEvent.click(screen.getByRole("button", { name: "Dùng ký hiệu" }));
    expect(await screen.findByText(/Ký hiệu dạng C26TAA/)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalledWith(
      "/einvoice-settings/providers/VIETTEL_SINVOICE/series",
      expect.anything(),
    );
  });

  it("the accountant reads but cannot change anything", async () => {
    mockEInvoiceApi(ACCOUNTANT, routes);
    renderEInvoiceScreen(<EInvoiceSettingsView />);
    expect(await screen.findByRole("checkbox", { name: /Tự phát hành/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Dùng ký hiệu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu tài khoản" })).not.toBeInTheDocument();
    expect(screen.getByText(/Chỉ Quản trị hệ thống sửa được/)).toBeInTheDocument();
  });

  it("without einvoice-settings:READ nothing is asked", async () => {
    const api = mockEInvoiceApi([], routes);
    renderEInvoiceScreen(<EInvoiceSettingsView />);
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(api.get.mock.calls.some(([url]) => url === "/einvoice-settings")).toBe(false);
  });
});

describe("EInvoiceSettingsView — accounts the BE does not store here (BO-04)", () => {
  const sepaySettings = {
    ...settings,
    provider: "SEPAY_EINVOICE",
    username: null,
    secretSet: false,
  };
  const sepay = (flags: Record<string, unknown>) => ({
    ...provider,
    provider: "SEPAY_EINVOICE",
    username: null,
    secretSet: false,
    ...flags,
  });

  it("SePay: no account form, “Tài khoản cấu hình trên máy chủ” and its readiness (flag)", async () => {
    mockEInvoiceApi(ADMIN, {
      get: {
        "/einvoice-settings": () => sepaySettings,
        "/einvoice-settings/providers": () => [
          sepay({ accountInDeployment: true, deploymentAccountReady: true }),
        ],
      },
    });
    renderEInvoiceScreen(<EInvoiceSettingsView />);
    expect(await screen.findAllByText("SePay eInvoice — đang dùng")).toHaveLength(1);
    expect(
      screen.getAllByText(/Tài khoản cấu hình trên máy chủ — đã sẵn sàng/).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Lưu tài khoản" })).not.toBeInTheDocument();
    expect(screen.queryByText("Chưa lưu")).not.toBeInTheDocument();
  });

  it("SePay without the BE flag: the fallback still hides the form", async () => {
    mockEInvoiceApi(ADMIN, {
      get: {
        "/einvoice-settings": () => sepaySettings,
        "/einvoice-settings/providers": () => [sepay({})],
      },
    });
    renderEInvoiceScreen(<EInvoiceSettingsView />);
    expect((await screen.findAllByText(/Tài khoản cấu hình trên máy chủ/)).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByRole("button", { name: "Lưu tài khoản" })).not.toBeInTheDocument();
  });

  it("Sandbox: no account form and no provider template code", async () => {
    mockEInvoiceApi(ADMIN, {
      get: {
        "/einvoice-settings": () => ({ ...settings, provider: "SANDBOX" }),
        "/einvoice-settings/providers": () => [{ ...provider, provider: "SANDBOX" }],
      },
    });
    renderEInvoiceScreen(<EInvoiceSettingsView />);
    expect((await screen.findAllByText(/Sandbox không cần tài khoản/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Lưu tài khoản" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Mã mẫu của nhà cung cấp/)).not.toBeInTheDocument();
  });
});
