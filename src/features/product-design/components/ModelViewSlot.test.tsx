/**
 * The place of the 3D view: no view (and one sentence why) with an error or a bag that cannot be sized; the flat
 * sheets, the legend and the turn controls when clean, with the WebGL canvas replaced as the repository's other 3D
 * tests do (fiber and drei mocked: jsdom has no WebGL); the message without WebGL; a failing part named; and the
 * teardown when another file replaces the first.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { Mesh } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BufferGeometry } from "three";

import { cup12oz } from "../model3d/test-support/fixtures";
import { ModelViewSlot } from "./ModelViewSlot";
import { cupTree } from "./print-config-test-utils";
import { defaultsFor } from "./print-defaults";

import type { Object3D } from "three";
import type { ModelIssue } from "../model3d/issues";
import type { MeasuredFile } from "./use-glb-reading";

const webgl = vi.hoisted(() => ({
  available: true,
  /** The element react-three-fiber would make: the canvas hands it to `onCreated` as `gl.domElement`. */
  element: document.createElement("canvas"),
  /** Makes `buildPrintView` throw, outside its per-part `try`. */
  buildFails: false,
}));
vi.mock("./model-view/webgl", () => ({ hasWebGl: () => webgl.available }));
vi.mock("./model-view/print-view", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./model-view/print-view")>();
  return {
    ...actual,
    buildPrintView: (...args: Parameters<typeof actual.buildPrintView>) => {
      if (webgl.buildFails) throw new Error("boom while building");
      return actual.buildPrintView(...args);
    },
  };
});
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ onCreated }: { onCreated?: (state: { gl: { domElement: HTMLElement } }) => void }) => {
    useEffect(() => onCreated?.({ gl: { domElement: webgl.element } }), [onCreated]);
    return <div data-testid="canvas" />;
  },
  useThree: () => ({}),
}));
vi.mock("@react-three/drei", () => ({ OrbitControls: () => null }));

const DEFAULTS = defaultsFor("parametric-cup", null);
const error: ModelIssue = { code: "NO_PRINT_MESH", level: "error", message: "Không có phần in." };
const warning: ModelIssue = { code: "BASE_NOT_AT_ZERO", level: "warning", message: "Đáy lệch." };

function measured(root: Object3D = cupTree(), over: Partial<MeasuredFile> = {}): MeasuredFile {
  return {
    fileName: "cup.glb",
    bytes: new ArrayBuffer(0),
    kind: "cup",
    model: cup12oz.model.kind === "parametric-cup" ? cup12oz.model : null,
    parts: [{ printAreaCode: "BODY", meshName: "print:BODY", shape: null }],
    issues: [],
    root,
    ...over,
  };
}

function printMesh(root: Object3D): Mesh {
  const found = root.getObjectByProperty("name", "print:BODY");
  if (!(found instanceof Mesh)) throw new Error("no print:BODY mesh");
  return found;
}

const view = (result: MeasuredFile | null, issues: ModelIssue[] = []) => (
  <ModelViewSlot result={result} issues={issues} defaults={DEFAULTS} />
);
// The first test of a file loads the view's chunk (three.js, fiber): slow when the machine is busy.
const shown = () => screen.findByRole("group", { name: /Model 3D của file/ }, { timeout: 10_000 });

beforeEach(() => {
  webgl.available = true;
  webgl.buildFails = false;
  webgl.element = document.createElement("canvas");
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => vi.restoreAllMocks());

describe("ModelViewSlot: when there is no view", () => {
  it("renders nothing while no file is read", () => {
    const { container } = render(view(null));
    expect(container).toBeEmptyDOMElement();
  });

  it("says in one sentence that errors stop it, and loads no view", () => {
    render(view(measured(), [error]));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Chưa hiện model 3D vì file còn lỗi: sửa trong Blender rồi chọn lại file.",
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
  });

  it("says why for a bag that cannot be sized as a whole", () => {
    render(view(measured(cupTree(), { kind: "bag", model: null })));
    expect(screen.getByRole("status")).toHaveTextContent(/chưa đủ mặt để dựng cả túi/);
  });
});

describe("ModelViewSlot: a clean file", () => {
  it("shows the canvas, the flat sheet with its size, the legend and the controls for front and back", async () => {
    render(view(measured(), [warning]));
    await shown();
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Khuôn phẳng của Thân ly, có lưới đánh số" }),
    ).toBeVisible();
    expect(
      screen.getByText(/Thân ly: phần in .* mm × .* mm, tràn lề .* mm, lề an toàn .* mm/),
    ).toBeVisible();
    expect(screen.getByText(/Đường mỏng cách nhau 10 mm, đường đậm cách nhau 50 mm/)).toBeVisible();
    expect(screen.getByText(/giãn rộng dần về phía miệng ly/)).toBeVisible();
    expect(screen.getByText(/Tràn lề: phần hình kéo ra ngoài/)).toBeVisible();
    const turn = screen.getByRole("group", { name: "Xoay model tới từng phần in" });
    expect(turn).toHaveTextContent("Xoay tới mặt trước ly");
    expect(turn).toHaveTextContent("Xoay tới mặt sau ly (đường nối)");
  });

  it("reaches the turn controls by keyboard", async () => {
    render(view(measured()));
    await shown();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Xoay tới mặt trước ly" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Xoay tới mặt sau ly (đường nối)" })).toHaveFocus();
  });

  it("hides the file's own print part while shown and shows it again on unmount", async () => {
    const root = cupTree();
    const { unmount } = render(view(measured(root)));
    await shown();
    await waitFor(() => expect(printMesh(root).visible).toBe(false));
    unmount();
    expect(printMesh(root).visible).toBe(true);
  });
});

describe("ModelViewSlot: no WebGL", () => {
  it("says so instead of an empty box, keeps the sheets, and builds nothing", async () => {
    webgl.available = false;
    const root = cupTree();
    render(view(measured(root)));
    expect(await screen.findByText("Trình duyệt này không hiện được 3D.")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Khuôn phẳng của Thân ly/ })).toBeInTheDocument();
    expect(printMesh(root).visible).toBe(true);
  });
});

const STOPPED = "Model 3D đã dừng.";

describe("ModelViewSlot: the WebGL context is lost", () => {
  it("says the view stopped and how to get it back, builds nothing more, and keeps the sheets", async () => {
    const root = cupTree();
    render(view(measured(root)));
    await shown();
    await waitFor(() => expect(printMesh(root).visible).toBe(false));
    act(
      () => void webgl.element.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(STOPPED);
    expect(alert).toHaveTextContent(/chọn lại file hoặc tải lại trang/i);
    expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
    // what the view added is released: the file's own part shows again
    expect(printMesh(root).visible).toBe(true);
    expect(screen.getByRole("img", { name: /Khuôn phẳng của Thân ly/ })).toBeInTheDocument();
  });

  it("is over when another file is chosen", async () => {
    const { rerender } = render(view(measured()));
    await shown();
    act(
      () => void webgl.element.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
    );
    await screen.findByText(STOPPED);
    webgl.element = document.createElement("canvas");
    rerender(view(measured()));
    expect(await screen.findByTestId("canvas")).toBeInTheDocument();
    expect(screen.queryByText(STOPPED)).not.toBeInTheDocument();
  });
});

describe("ModelViewSlot: building the view throws", () => {
  it("is caught like a failing part: the message shows and the rest of the screen works", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    webgl.buildFails = true;
    render(view(measured()));
    expect(await screen.findByText(STOPPED)).toBeInTheDocument();
    expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Khuôn phẳng của Thân ly/ })).toBeInTheDocument();
    expect(screen.getByText(/Đường mỏng cách nhau 10 mm/)).toBeVisible();
  });
});

describe("ModelViewSlot: a part whose grid cannot be made", () => {
  it("names the part and the reason, keeps the rest of the view, and leaves that part as the file has it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const root = cupTree();
    printMesh(root).geometry = new BufferGeometry();
    render(view(measured(root)));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không dựng được lưới cho Thân ly (print:BODY).");
    // plain Vietnamese on the screen; the raw English reason goes to the console
    expect(alert).not.toHaveTextContent(/position attribute/);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("print:BODY"),
      expect.stringContaining("position attribute"),
    );
    expect(alert).toHaveTextContent("Phần đó hiện nguyên như trong file");
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Khuôn phẳng của Thân ly/ })).toBeInTheDocument();
    expect(printMesh(root).visible).toBe(true);
  });
});

describe("ModelViewSlot: another file", () => {
  it("tears the first view down: its print part is shown again and only the second is hidden", async () => {
    const first = cupTree();
    const second = cupTree();
    const { rerender } = render(view(measured(first)));
    await shown();
    await waitFor(() => expect(printMesh(first).visible).toBe(false));
    rerender(view(measured(second)));
    await waitFor(() => expect(printMesh(second).visible).toBe(false));
    expect(printMesh(first).visible).toBe(true);
    rerender(view(null));
    expect(printMesh(second).visible).toBe(true);
  });
});
