/**
 * Choosing a `.glb`: what is read and shown, what blocks a save, what only warns, the unreadable and too-big files,
 * the save of file and configuration, and the replacement of a first result by a second.
 */
import { configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetPrintConfigMockStore } from "@/lib/api/mock-routes-print-configs";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";
import { blobBytes } from "@/lib/crypto/blob-bytes";

import type { GlbLoader } from "./use-glb-reading";
import { Model3dError } from "../model3d/model3d-error";
import {
  CHANGE_FILE,
  CHOSEN_FILE,
  cupTree,
  DEFAULTS_TOGGLE,
  EMPTY_VARIANT,
  FILE_INPUT,
  findStatus,
  firstGeometry,
  frontFaceOnlyTree,
  glbFile,
  glbOfSize,
  loaderOf,
  renderSection,
  sampleCupFile,
  treeWithoutPrint,
} from "./print-config-test-utils";

vi.setConfig({ testTimeout: 60_000 });
configure({ asyncUtilTimeout: 45_000 });

const SAVE = { name: "Lưu cấu hình in" };
const MB = 1024 * 1024;
const upload = (file: File, applyAccept = true) =>
  userEvent.setup({ applyAccept }).upload(screen.getByLabelText(FILE_INPUT), file);

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetVariantMockStore();
  resetPrintConfigMockStore();
});
afterEach(() => vi.restoreAllMocks());

async function renderEmpty(loadModel?: GlbLoader) {
  renderSection({ ...EMPTY_VARIANT, loadModel });
  await findStatus("Chưa có cấu hình in");
}

describe("choosing the real sample cup", () => {
  it("shows the figures read, no issue, and saves the file with a configuration of 90 / 60 / 110, band 6 and 8", async () => {
    const post = vi.spyOn(api, "post");
    const put = vi.spyOn(api, "put");
    await renderEmpty();
    await upload(sampleCupFile());

    expect(await screen.findByText("Nhận ra: Ly")).toBeInTheDocument();
    expect(
      screen.getByText("File đạt các bước kiểm: không có lỗi hay cảnh báo."),
    ).toBeInTheDocument();
    const measured = within(screen.getByRole("table", { name: "Số đo đọc được từ file" }));
    expect(measured.getByRole("row", { name: /Đường kính miệng.*90,0 mm/ })).toBeInTheDocument();
    expect(measured.getByRole("row", { name: /Đường kính đáy.*60,0 mm/ })).toBeInTheDocument();
    expect(measured.getByRole("row", { name: /Chiều cao.*110,0 mm/ })).toBeInTheDocument();
    expect(measured.getByRole("row", { name: /Dải in cách miệng.*6,0 mm/ })).toBeInTheDocument();
    expect(measured.getByRole("row", { name: /Dải in cách đáy.*8,0 mm/ })).toBeInTheDocument();
    // the figures the file cannot tell are only the form below the report, never a second table
    expect(screen.queryByRole("table", { name: /Số hệ thống tự điền/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", DEFAULTS_TOGGLE)).toBeInTheDocument();
    // the file gives the sizes: there is no field to type a manufacturer's figure
    expect(screen.queryByLabelText("Đường kính miệng (mm)")).not.toBeInTheDocument();
    const parts = within(screen.getByRole("table", { name: "Từng phần in trong file" }));
    expect(parts.getByText("print:BODY")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: SAVE.name }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    // the saved configuration replaces the empty state: the one request stored template and file together
    expect(await screen.findByText("Đã đính kèm file 3D")).toBeInTheDocument();

    // ONE multipart request: part `template` (JSON) and part `file`, the measured bytes
    expect(put).not.toHaveBeenCalled();
    const [url, form] = post.mock.calls[0] ?? [];
    expect(url).toMatch(/\/customization-templates$/);
    if (!(form instanceof FormData)) throw new Error("expected a multipart body");
    const part = form.get("template");
    if (!(part instanceof Blob)) throw new Error("expected the template part");
    expect(part.type).toBe("application/json");
    const body = JSON.parse(new TextDecoder().decode(await blobBytes(part))) as {
      model: Record<string, number>;
    };
    const model = body.model;
    expect(model).toMatchObject({ kind: "parametric-cup" });
    for (const [key, wanted] of Object.entries({
      topDiameterMm: 90,
      bottomDiameterMm: 60,
      heightMm: 110,
      bandTopOffsetMm: 6,
      bandBottomOffsetMm: 8,
    })) {
      expect(Math.abs((model[key] ?? NaN) - wanted)).toBeLessThan(0.05);
    }
    expect(body).toMatchObject({
      model3d: { surfaces: [{ printAreaCode: "BODY", meshName: "print:BODY" }] },
    });
    const sent = form.get("file");
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe("sample-cup-12oz.glb");
    expect((sent as File).size).toBe(sampleCupFile().size);
  });
});

describe("what blocks a save and what only warns", () => {
  it("a file with no print:* object shows the error and cannot be saved", async () => {
    await renderEmpty(loaderOf(treeWithoutPrint()));
    await upload(glbFile());
    const list = await screen.findByRole("list", { name: "Lỗi và cảnh báo" });
    expect(within(list).getByText("Lỗi")).toBeInTheDocument();
    expect(within(list).getByText(/Không tìm thấy phần in nào/)).toBeInTheDocument();
    expect(screen.getByText(/Có lỗi nên chưa lưu được/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SAVE.name })).toBeDisabled();
  });

  it("a near-miss name gives the error and the warning that names the exact name", async () => {
    await renderEmpty(loaderOf(cupTree("print:BODY.001")));
    await upload(glbFile());
    const list = within(await screen.findByRole("list", { name: "Lỗi và cảnh báo" }));
    expect(list.getByText("Lỗi")).toBeInTheDocument();
    expect(list.getByText("Cảnh báo")).toBeInTheDocument();
    expect(list.getByText(/Hãy đặt tên chính xác là "print:BODY"/)).toBeInTheDocument();
    expect(list.getByText("print:BODY.001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SAVE.name })).toBeDisabled();
  });

  it("a bag that cannot be sized as a whole shows the size of its face and cannot be saved yet", async () => {
    await renderEmpty(loaderOf(frontFaceOnlyTree()));
    await upload(glbFile());
    const parts = within(await screen.findByRole("table", { name: "Từng phần in trong file" }));
    expect(parts.getByText("Mặt trước")).toBeInTheDocument();
    // Each figure on its own line: "Rộng 120,0 mm", "Cao 160,0 mm".
    expect(parts.getByText("Rộng")).toBeInTheDocument();
    expect(parts.getByText("120,0 mm")).toBeInTheDocument();
    expect(parts.getByText("160,0 mm")).toBeInTheDocument();
    expect(screen.getByText(/Chưa đủ mặt để dựng cấu hình của cả túi/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SAVE.name })).toBeDisabled();
  });
});

describe("files that are too big or cannot be read", () => {
  it("a file over 50 MB is not read, and the sentence gives its size and the 10 MB limit", async () => {
    const loader = loaderOf(cupTree());
    await renderEmpty(loader);
    await upload(glbOfSize("huge.glb", 60 * MB));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("File nặng 60 MB nên không được đọc");
    expect(alert).toHaveTextContent("tối đa 10 MB");
    expect(loader.calls()).toBe(0);
  });

  it("a file between 10 and 50 MB is read and shows the too-large issue", async () => {
    const loader = loaderOf(cupTree());
    await renderEmpty(loader);
    await upload(new File([new Uint8Array(11 * MB)], "big.glb"));
    const list = within(await screen.findByRole("list", { name: "Lỗi và cảnh báo" }));
    expect(list.getByText(/vượt mức 10 MB/)).toBeInTheDocument();
    expect(loader.calls()).toBe(1);
    expect(screen.getByRole("button", { name: SAVE.name })).toBeDisabled();
  });

  it("a file that is named .glb but is not one gives the unreadable-file message with the likely causes", async () => {
    await renderEmpty();
    await upload(new File(["this is not a model"], "notes.glb", { type: "model/gltf-binary" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không đọc được file này như một file .glb");
    expect(alert).toHaveTextContent("Draco");
    expect(alert).not.toHaveTextContent(/JSON|Unexpected/);
    expect(screen.getByRole("button", { name: SAVE.name })).toBeDisabled();
  });

  it("a load timeout has its own text", async () => {
    await renderEmpty(() => Promise.reject(new Model3dError("LOAD_FAILED", "x", "timeout")));
    await upload(glbFile());
    expect(await screen.findByRole("alert")).toHaveTextContent("đọc quá 15 giây");
  });

  it("shows that a file is being read and shuts the box meanwhile", async () => {
    let finish: (tree: ReturnType<typeof cupTree>) => void = () => {};
    await renderEmpty(() => new Promise((resolve) => (finish = resolve)));
    await upload(glbFile("slow.glb"));
    const row = within(await screen.findByRole("group", CHOSEN_FILE));
    expect(row.getByText("slow.glb")).toBeInTheDocument();
    expect(row.getByText("Đang đọc…")).toBeInTheDocument();
    expect(screen.getByLabelText(CHANGE_FILE)).toBeDisabled();
    expect(row.getByRole("button", { name: "Đổi file" })).toBeDisabled();
    expect(row.getByRole("button", { name: "Bỏ file" })).toBeDisabled();
    finish(cupTree());
    expect(await screen.findByText("Nhận ra: Ly")).toBeInTheDocument();
  });
});

describe("a second file", () => {
  it("replaces the first result and frees the first loaded tree", async () => {
    const first = cupTree();
    const freed = vi.fn();
    firstGeometry(first).addEventListener("dispose", freed);
    await renderEmpty(loaderOf(first, treeWithoutPrint()));

    await upload(glbFile("first.glb"));
    expect(await screen.findByText("File: first.glb")).toBeInTheDocument();
    expect(freed).not.toHaveBeenCalled();

    await upload(glbFile("second.glb"));
    expect(await screen.findByText("File: second.glb")).toBeInTheDocument();
    expect(screen.queryByText("File: first.glb")).not.toBeInTheDocument();
    expect(screen.queryByText(/File đạt các bước kiểm/)).not.toBeInTheDocument();
    expect(screen.getByText(/Không tìm thấy phần in nào/)).toBeInTheDocument();
    expect(freed).toHaveBeenCalled();
  });

  it("frees the tree when the section goes away", async () => {
    const tree = cupTree();
    const freed = vi.fn();
    firstGeometry(tree).addEventListener("dispose", freed);
    const view = renderSection({ ...EMPTY_VARIANT, loadModel: loaderOf(tree) });
    await findStatus("Chưa có cấu hình in");
    await upload(glbFile());
    await screen.findByText("Nhận ra: Ly");
    expect(freed).not.toHaveBeenCalled();
    view.unmount();
    expect(freed).toHaveBeenCalled();
  });
});
