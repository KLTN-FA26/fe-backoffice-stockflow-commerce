import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import PreviewLayout from "../layout";
import * as navigation from "next/navigation";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  usePathname: () => "/ui-preview",
}));

describe("PreviewLayout (Issue #3: Dev-only Guard)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("cho phép truy cập và render nội dung bình thường trong môi trường development", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(
      <PreviewLayout>
        <div data-testid="preview-content">Màn hình thử nghiệm UI</div>
      </PreviewLayout>,
    );

    expect(screen.getByTestId("preview-content")).toBeInTheDocument();
    expect(navigation.notFound).not.toHaveBeenCalled();
  });

  it("gọi notFound() để trả về 404 trong môi trường production", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(
      <PreviewLayout>
        <div data-testid="preview-content">Màn hình thử nghiệm UI</div>
      </PreviewLayout>,
    );

    expect(navigation.notFound).toHaveBeenCalledTimes(1);
  });
});
