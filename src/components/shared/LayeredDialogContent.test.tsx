import { readFileSync } from "node:fs";
import path from "node:path";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";
import { FormDialog, FormDialogBody } from "./FormDialog";
import { SlideOverPanel } from "./SlideOverPanel";

const globalsCss = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Giá trị số của biến thang z-index `--z-*` khai báo trong globals.css; `NaN` nếu không có. */
function zToken(name: string): number {
  const match = new RegExp(`${name}:\\s*(\\d+)\\s*;`).exec(globalsCss);
  return Number(match?.[1]);
}

/** Lớp z của phần tử — `z-[1100]` hoặc token `z-(--z-*)` tra trong globals.css; `NaN` nếu không có. */
function zOf(element: Element): number {
  const className = element.getAttribute("class") ?? "";
  const literal = /(?:^|\s)z-\[(\d+)\]/.exec(className);
  if (literal) return Number(literal[1]);
  const token = /(?:^|\s)z-\((--z-[a-z-]+)\)/.exec(className);
  return token ? zToken(token[1]) : Number.NaN;
}

const DIALOG_ON_DRAWER = "z-(--z-dialog-on-drawer)";

function dialogOverlay(): Element {
  const overlay = document.body.querySelector('[data-slot="dialog-overlay"]');
  if (!overlay) throw new Error("Không thấy overlay của dialog");
  return overlay;
}

function SampleForm({ onClose }: { onClose: () => void }) {
  return (
    <FormDialogBody
      title="Sửa biến thể"
      description="Mô tả"
      submitLabel="Lưu"
      canSubmit
      isPending={false}
      error={null}
      onSubmit={onClose}
      onCancel={onClose}
    />
  );
}

describe("thang z-index trong globals.css", () => {
  it("drawer < dialog-on-drawer < dropdown-on-dialog < toast < tooltip", () => {
    const scale = [
      "--z-drawer",
      "--z-dialog-on-drawer",
      "--z-dropdown-on-dialog",
      "--z-toast",
      "--z-tooltip",
    ].map(zToken);
    expect(scale).toEqual([1100, 1150, 1160, 1200, 1300]);
  });
});

describe("dialog nằm trên panel trượt (thang z-index: drawer < dialog-on-drawer < toast)", () => {
  it("FormDialog: content và overlay ở lớp dialog-on-drawer", () => {
    render(
      <FormDialog open onOpenChange={vi.fn()}>
        <SampleForm onClose={vi.fn()} />
      </FormDialog>,
    );
    expect(screen.getByRole("dialog", { name: "Sửa biến thể" })).toHaveClass(DIALOG_ON_DRAWER);
    expect(dialogOverlay()).toHaveClass(DIALOG_ON_DRAWER);
    expect(dialogOverlay()).not.toHaveClass("z-50");
  });

  it("ConfirmDialog: content và overlay ở lớp dialog-on-drawer", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Tạm chặn biến thể?"
        description="Mô tả"
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Tạm chặn biến thể?" })).toHaveClass(
      DIALOG_ON_DRAWER,
    );
    expect(dialogOverlay()).toHaveClass(DIALOG_ON_DRAWER);
    expect(dialogOverlay()).not.toHaveClass("z-50");
  });

  function Panel({ children }: { children: React.ReactNode }) {
    return (
      <SlideOverPanel open onClose={vi.fn()} title="Chi tiết biến thể">
        {children}
      </SlideOverPanel>
    );
  }

  function FormInsidePanel() {
    const [open, setOpen] = useState(false);
    return (
      <Panel>
        <button type="button" onClick={() => setOpen(true)}>
          Mở form
        </button>
        <FormDialog open={open} onOpenChange={setOpen}>
          <SampleForm onClose={() => setOpen(false)} />
        </FormDialog>
      </Panel>
    );
  }

  function ConfirmInsidePanel() {
    const [open, setOpen] = useState(false);
    return (
      <Panel>
        <button type="button" onClick={() => setOpen(true)}>
          Mở xác nhận
        </button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Tạm chặn biến thể?"
          description="Mô tả"
          onConfirm={vi.fn()}
        />
      </Panel>
    );
  }

  it.each([
    ["FormDialog", FormInsidePanel, "Mở form", "Sửa biến thể"],
    ["ConfirmDialog", ConfirmInsidePanel, "Mở xác nhận", "Tạm chặn biến thể?"],
  ])("%s mở từ trong SlideOverPanel nằm trên panel", async (_name, Harness, trigger, title) => {
    render(<Harness />);
    const panel = screen.getByRole("dialog", { name: "Chi tiết biến thể" });
    const panelZ = zOf(panel);
    expect(panelZ).toBe(1100);

    await userEvent.click(screen.getByRole("button", { name: trigger }));

    const dialog = screen.getByRole("dialog", { name: title });
    expect(zOf(dialog)).toBeGreaterThan(panelZ);
    expect(zOf(dialogOverlay())).toBeGreaterThan(panelZ);
  });
});

describe("globals.css — dropdown portal nằm trên dialog / panel", () => {
  // Radix Select / Popover render vào portal riêng; shadcn đặt z-50 nên mở trong dialog / panel là bị che.
  const css = globalsCss;
  const rule =
    /\[data-slot="select-content"\],\s*\[data-slot="popover-content"\]\s*\{([^}]*)\}/.exec(css);

  it("select-content và popover-content dùng token dropdown-on-dialog: trên dialog, dưới toast", () => {
    expect(rule?.[1]).toMatch(/z-index:\s*var\(--z-dropdown-on-dialog\)\s*;/);
    const z = zToken("--z-dropdown-on-dialog");
    expect(z).toBeGreaterThan(zToken("--z-dialog-on-drawer"));
    expect(z).toBeLessThan(zToken("--z-toast"));
  });

  it("rule nằm ngoài @layer (thắng utility z-50 của Tailwind) và không dùng !important", () => {
    expect(rule).not.toBeNull();
    const before = css.slice(0, rule?.index ?? 0);
    const depth = (before.match(/\{/g)?.length ?? 0) - (before.match(/\}/g)?.length ?? 0);
    expect(depth).toBe(0);
    expect(rule?.[1]).not.toContain("!important");
  });
});
