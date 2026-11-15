/**
 * What the screen checks after reading a file: the file against the model that will be saved (where a bag stands),
 * a bag's missing faces, the top fold, the name of the file, and what the screen never shows (the loader's English).
 */
import { configure, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetPrintConfigMockStore } from "@/lib/api/mock-routes-print-configs";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import {
  bagTree,
  EMPTY_VARIANT,
  glbFile,
  loaderOf,
  renderSection,
} from "./print-config-test-utils";

import type { BagShift } from "./print-config-test-utils";
import type { GlbLoader } from "./use-glb-reading";

vi.setConfig({ testTimeout: 60_000 });
configure({ asyncUtilTimeout: 45_000 });

const SAVE = { name: "Lưu cấu hình in" };
const CLEAN = "File đạt các bước kiểm: không có lỗi hay cảnh báo.";
const upload = (file: File, applyAccept = true) =>
  userEvent.setup({ applyAccept }).upload(screen.getByLabelText(/Chọn hoặc kéo thả file/), file);

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetVariantMockStore();
  resetPrintConfigMockStore();
});
afterEach(() => vi.restoreAllMocks());

async function chooseBag(shift: BagShift, faces?: readonly string[]) {
  renderSection({ ...EMPTY_VARIANT, loadModel: loaderOf(bagTree(shift, faces)) });
  await screen.findByText("Chưa có cấu hình in");
  await upload(glbFile());
  await screen.findByText("Nhận ra: Túi");
}

describe("the file against the model that will be saved", () => {
  it("a bag shifted 5 mm on X shows the differences, is not called clean and cannot be saved", async () => {
    await chooseBag({ dx: 5 });
    const list = within(screen.getByRole("list", { name: "Lỗi và cảnh báo" }));
    expect(list.getAllByText("Lỗi").length).toBeGreaterThan(0);
    expect(list.getAllByText(/lệch tâm theo chiều ngang 5/).length).toBeGreaterThan(0);
    expect(list.getAllByText(/\+½ độ sâu hông/).length).toBeGreaterThan(0);
    expect(screen.queryByText(CLEAN)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: SAVE.name })).toBeDisabled();
  });

  it("a bag shifted 1.0 mm is clean and can be saved", async () => {
    await chooseBag({ dx: 1 });
    expect(screen.getByText(CLEAN)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SAVE.name })).toBeEnabled();
  });

  it("a bag shifted in depth is caught", async () => {
    await chooseBag({ dz: 10 });
    expect(screen.queryByText(CLEAN)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: SAVE.name })).toBeDisabled();
  });

  it("a bag that does not start at Y 0 is caught", async () => {
    await chooseBag({ dy: 5 });
    expect(screen.getAllByText(/đáy Y/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: SAVE.name })).toBeDisabled();
  });

  it("a top fold typed in the defaults keeps the file clean (it is added on the face height)", async () => {
    await chooseBag({});
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Nâng cao/ }));
    const fold = screen.getByLabelText("Gập miệng túi (mm)");
    await user.clear(fold);
    await user.type(fold, "40");
    expect(screen.getByText(CLEAN)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SAVE.name })).toBeEnabled();
  });
});

describe("a bag with fewer than four faces", () => {
  it("says which faces are missing as soon as the file is read, and cannot be saved", async () => {
    await chooseBag({}, ["FRONT", "BACK"]);
    const list = within(screen.getByRole("list", { name: "Lỗi và cảnh báo" }));
    expect(list.getByText(/thiếu print:LEFT, print:RIGHT/)).toBeInTheDocument();
    expect(screen.queryByText(CLEAN)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: SAVE.name })).toBeDisabled();
  });
});

describe("the name of the file, and what the screen never shows", () => {
  async function renderEmpty(loadModel?: GlbLoader) {
    renderSection({ ...EMPTY_VARIANT, loadModel });
    await screen.findByText("Chưa có cấu hình in");
  }

  it("a file whose name does not end in .glb is refused when it is chosen, without being read", async () => {
    const loader = loaderOf(bagTree());
    await renderEmpty(loader);
    await upload(glbFile("model.gltf"), false);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      'File "model.gltf" không có đuôi .glb',
    );
    expect(loader.calls()).toBe(0);
  });

  it("the loader's own English is not shown, for a parse error or for any other failure", async () => {
    await renderEmpty(() => Promise.reject(new Error("Unexpected token < in JSON")));
    await upload(glbFile());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không đọc được file");
    expect(alert).not.toHaveTextContent("Unexpected");
  });

  it("while a file is being read the defaults of the stored file cannot be saved", async () => {
    renderSection({ loadModel: () => new Promise(() => {}) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Nâng cao/ }));
    const seam = screen.getByLabelText("Mép dán (mm)");
    await user.clear(seam);
    await user.type(seam, "6");
    expect(screen.getByRole("button", { name: SAVE.name })).toBeEnabled();
    await upload(glbFile("slow.glb"));
    await screen.findByText("Đang đọc slow.glb…");
    expect(screen.getByRole("button", { name: SAVE.name })).toBeDisabled();
  });
});
