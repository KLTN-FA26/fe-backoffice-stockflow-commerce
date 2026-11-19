import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRINT_CONFIG_CONTEXT_ERROR_MESSAGES } from "@/constants/labels-print-config";
import { toast } from "@/components/shared/Toast";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { sha256Hex } from "@/lib/crypto/sha256";

import { ModelFileMismatchError } from "./errors";
import { useActivatePrintConfig, useDeactivatePrintConfig, useSavePrintConfig } from "./mutations";
import { printConfigKeys } from "./queries";
import {
  CUP,
  CUP_BODY,
  cupDto,
  cupWire,
  glbBytes,
  model3dWithFile,
  SHA_B,
  storedWith,
} from "./test-fixtures";

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
  return { result, keys, queryClient };
}

const variantKey = JSON.stringify(printConfigKeys.variant("PRD-001", "SKU-001-WHT-L"));
const allKey = JSON.stringify(printConfigKeys.all);
const file = glbBytes();
const ids = { productId: "PRD-001", variantId: "SKU-001-WHT-L" };
/** A create: always with its file. */
const create = { ...ids, input: { config: CUP_BODY, stored: null, file } };
/** A change of a free default of a template that has a file: no file is sent. */
const edit = {
  ...ids,
  input: { config: { ...CUP_BODY, model: { ...CUP, seamMm: 9 } }, stored: storedWith(true) },
};
const withMeasuredFile = async () => ({
  data: { ...cupWire, version: 9, model3d: model3dWithFile(await sha256Hex(file.bytes)) },
});
const target = { ...ids, templateId: "tpl-1", version: 3 };

describe("useSavePrintConfig", () => {
  it("a save refreshes the print configurations (that variant's entry included) and nothing of the product feature", async () => {
    vi.spyOn(api, "post").mockResolvedValue(await withMeasuredFile());
    const { result, keys } = setup(useSavePrintConfig);
    await act(async () => {
      await result.current.mutateAsync(create);
    });
    expect(keys()).toEqual([allKey]);
    expect(printConfigKeys.variant("PRD-001", "SKU-001-WHT-L").slice(0, 1)).toEqual(
      printConfigKeys.all,
    );
  });

  it("a failure refetches that variant's configuration (a stale version is replaced)", async () => {
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "OPTIMISTIC_LOCK", "x"));
    const { result, keys } = setup(useSavePrintConfig);
    await act(async () => {
      await result.current.mutateAsync(edit).catch(() => undefined);
    });
    expect(keys()).toEqual([variantKey]);
  });

  it("a create is ONE multipart POST (template part typed application/json, file part), nothing else", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue(await withMeasuredFile());
    const put = vi.spyOn(api, "put");
    const { result } = setup(useSavePrintConfig);
    let saved: unknown;
    await act(async () => {
      saved = await result.current.mutateAsync(create);
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(put).not.toHaveBeenCalled();
    const [url, form, config] = post.mock.calls[0] ?? [];
    expect(url).toBe("/products/PRD-001/variants/SKU-001-WHT-L/customization-templates");
    if (!(form instanceof FormData)) throw new Error("expected a multipart body");
    const template = form.get("template");
    expect(template).toBeInstanceOf(Blob);
    expect(template instanceof Blob && template.type).toBe("application/json");
    expect(form.get("file")).toBeInstanceOf(File);
    // No multipart type by hand: the client's JSON default is cleared, the browser writes the boundary.
    expect(config?.headers).toEqual({ "Content-Type": false });
    // The version is the response's, whatever it jumped to.
    expect(saved).toMatchObject({ version: 9 });
  });

  it("a save without a file is ONE JSON PUT", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: { ...cupWire, version: 5 } });
    const post = vi.spyOn(api, "post");
    const { result } = setup(useSavePrintConfig);
    await act(async () => {
      await result.current.mutateAsync(edit);
    });
    expect(post).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0]?.[1]).not.toBeInstanceOf(FormData);
    expect(put.mock.calls[0]?.[2]).toBeUndefined();
  });

  it("a stored file that is not the measured one: an error, that variant is refetched, nothing says it was saved", async () => {
    vi.spyOn(api, "post").mockResolvedValue({
      data: { ...cupWire, model3d: model3dWithFile(SHA_B) },
    });
    const success = vi.spyOn(toast, "success").mockImplementation(() => "");
    const { result, keys } = setup(useSavePrintConfig);
    const error = await act(async () =>
      result.current.mutateAsync(create).catch((e: unknown) => e),
    );
    expect(error).toBeInstanceOf(ModelFileMismatchError);
    expect(keys()).toEqual([variantKey]);
    expect(success).not.toHaveBeenCalled();
  });
});

describe("useSavePrintConfig: the saved template goes into the cache at once", () => {
  const key = printConfigKeys.variant("PRD-001", "SKU-001-WHT-L");

  it("the variant's entry holds the answer (its new version) before any refetch returns", async () => {
    vi.spyOn(api, "put").mockResolvedValue({ data: { ...cupWire, version: 9 } });
    const { result, queryClient } = setup(useSavePrintConfig);
    queryClient.setQueryData(key, cupDto({ version: 3 }));
    await act(async () => {
      await result.current.mutateAsync(edit);
    });
    expect(queryClient.getQueryData(key)).toMatchObject({ templateId: "tpl-1", version: 9 });
  });

  it("a variant with no configuration yet gets the created template", async () => {
    vi.spyOn(api, "post").mockResolvedValue(await withMeasuredFile());
    const { result, queryClient } = setup(useSavePrintConfig);
    queryClient.setQueryData(key, null);
    await act(async () => {
      await result.current.mutateAsync(create);
    });
    expect(queryClient.getQueryData(key)).toMatchObject({ version: 9 });
  });

  it("an entry showing another template is left to the refetch", async () => {
    vi.spyOn(api, "put").mockResolvedValue({ data: { ...cupWire, version: 9 } });
    const { result, queryClient } = setup(useSavePrintConfig);
    const other = cupDto({ templateId: "tpl-other", version: 2 });
    queryClient.setQueryData(key, other);
    await act(async () => {
      await result.current.mutateAsync(edit);
    });
    expect(queryClient.getQueryData(key)).toEqual(other);
  });

  it("a failed save leaves the entry as it was", async () => {
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "OPTIMISTIC_LOCK", "x"));
    const { result, queryClient } = setup(useSavePrintConfig);
    const before = cupDto({ version: 3 });
    queryClient.setQueryData(key, before);
    await act(async () => {
      await result.current.mutateAsync(edit).catch(() => undefined);
    });
    expect(queryClient.getQueryData(key)).toEqual(before);
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

describe("activation refused for the file (BE 409 / 422)", () => {
  const ACTIVATE = PRINT_CONFIG_CONTEXT_ERROR_MESSAGES.activate;
  it.each([
    [409, "PRINT_CONFIG_MODEL_FILE_REQUIRED", ACTIVATE.PRINT_CONFIG_MODEL_FILE_REQUIRED],
    [422, "PRINT_CONFIG_SURFACES_INVALID", ACTIVATE.PRINT_CONFIG_SURFACES_INVALID],
  ])(
    "%i %s: the toast says why it cannot be activated, and the variant is refetched",
    async (status, code, sentence) => {
      vi.spyOn(api, "post").mockRejectedValue(new ApiError(status, code, "English"));
      const error = vi.spyOn(toast, "error").mockImplementation(() => "");
      const { result, keys } = setup(useActivatePrintConfig);
      await act(async () => {
        await result.current.mutateAsync(target).catch(() => undefined);
      });
      expect(error).toHaveBeenCalledWith(sentence);
      expect(keys()).toEqual([variantKey]);
    },
  );
});
