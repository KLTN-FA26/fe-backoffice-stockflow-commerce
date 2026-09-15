import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { APP_ROUTES, BRAND } from "@/constants";

import { useAppStore } from "@/lib/store/use-app-store";

import { ThemeProvider } from "@/components/theme-provider";

import { HOME_COPY } from "./constants";

import { HomeFooter, HomeHero } from "./index";

import type { ReactElement } from "react";

/** Bọc ThemeProvider vì HomeFooter đọc theme qua `useTheme()`. */
function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

afterEach(() => {
  delete document.documentElement.dataset.theme;
  document.documentElement.classList.remove("dark");
  useAppStore.setState({ theme: "system" });
});

describe("HomeHero", () => {
  it("hiện tiêu đề chính", () => {
    renderWithTheme(<HomeHero />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(HOME_COPY.title);
  });

  it("CTA chính trỏ về trang đăng nhập", () => {
    renderWithTheme(<HomeHero />);
    expect(screen.getByRole("link", { name: new RegExp(HOME_COPY.ctaLabel) })).toHaveAttribute(
      "href",
      APP_ROUTES.login,
    );
  });

  it("đặt logo kèm tên thương hiệu và không lặp lại CTA đăng nhập", () => {
    renderWithTheme(<HomeHero />);
    const brandLink = screen.getByRole("link", { name: new RegExp(BRAND.name, "i") });
    expect(brandLink).toHaveAttribute("href", APP_ROUTES.home);
    expect(brandLink).toHaveTextContent(BRAND.name);
    expect(screen.queryByRole("link", { name: HOME_COPY.loginLabel })).not.toBeInTheDocument();
  });
});

describe("HomeFooter", () => {
  it("hiện dòng bản quyền", () => {
    renderWithTheme(<HomeFooter />);
    expect(screen.getByText(HOME_COPY.footerLeft)).toBeInTheDocument();
  });

  it("đặt nút theme ở footer và chuyển từ Dark sang Light", async () => {
    // Chốt preference = "dark" tường minh thay vì phụ thuộc default "system"
    // (vốn phụ thuộc prefers-color-scheme, không ổn định giữa các môi trường test).
    useAppStore.setState({ theme: "dark" });
    const user = userEvent.setup();
    renderWithTheme(<HomeFooter />);

    expect(await screen.findByRole("button", { name: /Chuyển sang Light/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Chuyển sang Light/i }));

    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
