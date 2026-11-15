import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { useActivatePrintConfig, useDeactivatePrintConfig, useSavePrintConfig } from "./mutations";
import { printConfigKeys } from "./queries";
import { CUP_BODY, cupWire, glbBytes } from "./test-fixtures";

import type { ReactNode } from "react";

afterEach(() => vi.restoreAllMocks());

function setup<T>(useHook: () => T) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(useHook, { wrapper });
  const keys = () =>
    invalidate.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
  return { result, keys };
}

const variantKey = JSON.stringify(printConfigKeys.variant("PRD-001", "SKU-001-WHT-L"));
const allKey = JSON.stringify(printConfigKeys.all);
const variables = {
  productId: "PRD-001",
  variantId: "SKU-001-WHT-L",
  input: { config: CUP_BODY, stored: null, file: glbBytes() },
};
const target = {
  productId: "PRD-001",
  variantId: "SKU-001-WHT-L",
  templateId: "tpl-1",
  version: 3,
};

describe("useSavePrintConfig", () => {
  it("a save refreshes the print configurations (that variant's entry included) and nothing of the product feature", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: cupWire });
    const { result, keys } = setup(useSavePrintConfig);
    await act(async () => {
      await result.current.mutateAsync(variables);
    });
    expect(keys()).toEqual([allKey]);
    expect(printConfigKeys.variant("PRD-001", "SKU-001-WHT-L").slice(0, 1)).toEqual(
      printConfigKeys.all,
    );
  });

  it("a failure refetches that variant's configuration (a stale version is replaced)", async () => {
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(409, "OPTIMISTIC_LOCK", "x"));
    const { result, keys } = setup(useSavePrintConfig);
    await act(async () => {
      await result.current.mutateAsync(variables).catch(() => undefined);
    });
    expect(keys()).toEqual([variantKey]);
  });

  it("the file travels in the same request as the template: one multipart POST, no second call", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: cupWire });
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: cupWire });
    const { result } = setup(useSavePrintConfig);
    await act(async () => {
      await result.current.mutateAsync(variables);
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(put).not.toHaveBeenCalled();
    const form = post.mock.calls[0]?.[1];
    expect(form).toBeInstanceOf(FormData);
    expect(form instanceof FormData && form.get("file")).toBeInstanceOf(File);
  });
});

describe.each([
  ["useActivatePrintConfig", useActivatePrintConfig, "activation"],
  ["useDeactivatePrintConfig", useDeactivatePrintConfig, "deactivation"],
] as const)("%s", (_name, useHook, action) => {
  it("posts the version to the template's status endpoint and refreshes every print configuration", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: cupWire });
    vi.spyOn(toast, "success").mockImplementation(() => "");
    const { result, keys } = setup(useHook);
    await act(async () => {
      await result.current.mutateAsync(target);
    });
    expect(post).toHaveBeenCalledWith(
      `/products/PRD-001/variants/SKU-001-WHT-L/customization-templates/tpl-1/${action}`,
      { version: 3 },
    );
    expect(keys()).toEqual([allKey]);
  });

  it("a failure shows the mapped Vietnamese sentence and refetches that variant", async () => {
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(409, "OPTIMISTIC_LOCK", "English"));
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    const { result, keys } = setup(useHook);
    await act(async () => {
      await result.current.mutateAsync(target).catch(() => undefined);
    });
    expect(keys()).toEqual([variantKey]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("vừa được người khác sửa"));
  });
});
