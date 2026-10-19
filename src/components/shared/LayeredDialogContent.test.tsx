import { readFileSync } from "node:fs";
import path from "node:path";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";
import { FormDialog, FormDialogBody } from "./FormDialog";
import { SlideOverPanel } from "./SlideOverPanel";

/** Lớp z (`z-[1150]`) của một phần tử; `NaN` nếu không có. */
function zOf(element: Element): number {
  const match = /(?:^|\s)z-\[(\d+)\]/.exec(element.getAttribute("class") ?? "");
  return Number(match?.[1]);
}

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

describe("dialog nằm trên panel trượt (thang z-index: drawer 1100 < dialog < toast 1200)", () => {
  it("FormDialog: content và overlay ở lớp 1150", () => {
    render(
      <FormDialog open onOpenChange={vi.fn()}>
        <SampleForm onClose={vi.fn()} />
      </FormDialog>,
    );
    expect(screen.getByRole("dialog", { name: "Sửa biến thể" })).toHaveClass("z-[1150]");
    expect(dialogOverlay()).toHaveClass("z-[1150]");
  });

  it("ConfirmDialog: content và overlay ở lớp 1150", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Tạm chặn biến thể?"
        description="Mô tả"
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Tạm chặn biến thể?" })).toHaveClass("z-[1150]");
    expect(dialogOverlay()).toHaveClass("z-[1150]");
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
  const css = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const rule =
    /\[data-slot="select-content"\],\s*\[data-slot="popover-content"\]\s*\{([^}]*)\}/.exec(css);

  it("có rule z-index cho select-content và popover-content, trên dialog 1150, dưới toast 1200", () => {
    const z = Number(/z-index:\s*(\d+)\s*;/.exec(rule?.[1] ?? "")?.[1]);
    expect(z).toBeGreaterThan(1150);
    expect(z).toBeLessThan(1200);
  });

  it("rule nằm ngoài @layer (thắng utility z-50 của Tailwind) và không dùng !important", () => {
    expect(rule).not.toBeNull();
    const before = css.slice(0, rule?.index ?? 0);
    const depth = (before.match(/\{/g)?.length ?? 0) - (before.match(/\}/g)?.length ?? 0);
    expect(depth).toBe(0);
    expect(rule?.[1]).not.toContain("!important");
  });
});
