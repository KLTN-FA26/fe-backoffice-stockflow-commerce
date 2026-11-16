/** The bytes that are measured are the bytes the save receives: the file is read once, when it is chosen. */
import { configure, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetPrintConfigMockStore } from "@/lib/api/mock-routes-print-configs";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { savePrintConfig } from "../api";
import { cupDto } from "../test-fixtures";
import { cupTree, EMPTY_VARIANT, renderSection } from "./print-config-test-utils";

import type { GlbLoader } from "./use-glb-reading";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  savePrintConfig: vi.fn(),
}));

vi.setConfig({ testTimeout: 60_000 });
configure({ asyncUtilTimeout: 45_000 });

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetVariantMockStore();
  resetPrintConfigMockStore();
});
afterEach(() => vi.restoreAllMocks());

describe("the measured bytes are the uploaded bytes", () => {
  it("hands the save the very bytes the loader measured, and reads the File once", async () => {
    vi.mocked(savePrintConfig).mockResolvedValue(cupDto());
    const reads = vi.spyOn(FileReader.prototype, "readAsArrayBuffer");
    let measured: Uint8Array = new Uint8Array();
    const loadModel: GlbLoader = async (bytes) => {
      measured = new Uint8Array(bytes.slice(0));
      return cupTree();
    };
    const content = Uint8Array.from({ length: 64 }, (_, i) => (i * 7) % 256);
    renderSection({ ...EMPTY_VARIANT, loadModel });
    await screen.findByText("Chưa có cấu hình in");
    const user = userEvent.setup();
    await user.upload(
      screen.getByLabelText(/Chọn hoặc kéo thả file/),
      new File([content], "cup.glb", { type: "model/gltf-binary" }),
    );
    await screen.findByText("Nhận ra: Ly");
    await user.click(screen.getByRole("button", { name: "Lưu cấu hình in" }));

    await waitFor(() => expect(savePrintConfig).toHaveBeenCalledTimes(1));
    const input = vi.mocked(savePrintConfig).mock.calls[0]?.[2];
    expect(input?.file?.name).toBe("cup.glb");
    expect(input?.file?.bytes).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(input?.file?.bytes ?? new ArrayBuffer(0)))).toEqual(
      Array.from(content),
    );
    expect(Array.from(measured)).toEqual(Array.from(content));
    expect(reads).toHaveBeenCalledTimes(1);
  });
});
