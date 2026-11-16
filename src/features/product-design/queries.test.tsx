import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { useModelFileUrl } from "./queries";
import { cupDto, model3dWithFile } from "./test-fixtures";

import type { ReactNode } from "react";
import type { PrintConfigDto } from "./types";

afterEach(() => vi.restoreAllMocks());

function setup(config: PrintConfigDto | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useModelFileUrl(config), { wrapper });
}

describe("useModelFileUrl", () => {
  it("asks the BE for a short-lived link of the stored file, and gives that url", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: { url: "https://bucket/print-models/x.glb?sig=1", expiresAt: "2026-11-15T10:15:00Z" },
    });
    const { result } = setup(cupDto({ model3d: model3dWithFile() }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.url).toBe("https://bucket/print-models/x.glb?sig=1");
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toBe(
      "/products/PRD-001/variants/SKU-001-WHT-L/customization-templates/tpl-1/model-file/download-url",
    );
  });

  it("asks for nothing when the template has no file, or there is no template", async () => {
    const get = vi.spyOn(api, "get");
    const without = setup(cupDto());
    const none = setup(null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(get).not.toHaveBeenCalled();
    expect(without.result.current.fetchStatus).toBe("idle");
    expect(none.result.current.fetchStatus).toBe("idle");
  });

  it("a link of the BE that fails is an error of the query, not a url", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new ApiError(404, "NOT_FOUND", "x"));
    const { result } = setup(cupDto({ model3d: model3dWithFile() }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("a new version of the template is a new file: the link is asked for again, and the new one is given", async () => {
    const get = vi
      .spyOn(api, "get")
      .mockResolvedValueOnce({ data: { url: "https://bucket/v3.glb?sig=1", expiresAt: "t" } })
      .mockResolvedValueOnce({ data: { url: "https://bucket/v4.glb?sig=2", expiresAt: "t" } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const v3 = cupDto({ model3d: model3dWithFile() });
    const { result, rerender } = renderHook(
      ({ config }: { config: PrintConfigDto }) => useModelFileUrl(config),
      { wrapper, initialProps: { config: v3 } },
    );
    await waitFor(() => expect(result.current.data?.url).toBe("https://bucket/v3.glb?sig=1"));

    rerender({ config: { ...v3, version: v3.version + 1 } });
    await waitFor(() => expect(result.current.data?.url).toBe("https://bucket/v4.glb?sig=2"));
    expect(get).toHaveBeenCalledTimes(2);
  });
});
