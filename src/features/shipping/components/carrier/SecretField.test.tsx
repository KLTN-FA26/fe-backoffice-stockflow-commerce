import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";

import { SecretField } from "./SecretField";

const S = UI_LABELS.shipping.waybill.carriers.config.secret;

function renderField(props: Partial<Parameters<typeof SecretField>[0]> = {}) {
  return render(
    <SecretField
      id="key"
      label="Khoá API"
      hint="Gợi ý"
      saved={false}
      replacing={false}
      onReplace={vi.fn()}
      onKeep={vi.fn()}
      registration={{ name: "apiKey", onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() }}
      maxLength={64}
      {...props}
    />,
  );
}

describe("SecretField — show what is being typed (UX audit S20-1)", () => {
  it("types as a password, and one button shows or hides it", async () => {
    renderField();
    const input = screen.getByLabelText(/Khoá API/, { selector: "input" });
    expect(input).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: S.showAria("Khoá API") }));
    expect(input).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: S.hideAria("Khoá API") }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("a saved key is never shown: only 'Đã lưu' and the replace button, no input and no eye", () => {
    renderField({ saved: true });
    expect(screen.getByText(S.saved)).toBeInTheDocument();
    expect(document.querySelector("input")).toBeNull();
    expect(screen.queryByRole("button", { name: S.showAria("Khoá API") })).toBeNull();
  });
});
