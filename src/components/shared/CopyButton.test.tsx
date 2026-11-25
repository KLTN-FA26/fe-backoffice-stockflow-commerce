import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CLIPBOARD_LABELS } from "@/constants";

import { toast } from "@/components/shared/Toast";

import { CopyButton } from "./CopyButton";

afterEach(() => vi.restoreAllMocks());

describe("CopyButton", () => {
  it("sao chép đúng mã, báo đã sao chép, không kích hoạt click của dòng chứa nó", async () => {
    const user = userEvent.setup();
    const onRow = vi.fn();
    render(
      <div onClick={onRow}>
        <CopyButton value="LPN-1" />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: CLIPBOARD_LABELS.copy("LPN-1") }));
    expect(await navigator.clipboard.readText()).toBe("LPN-1");
    expect(
      screen.getByRole("button", { name: CLIPBOARD_LABELS.copied("LPN-1") }),
    ).toBeInTheDocument();
    expect(onRow).not.toHaveBeenCalled();
  });

  it("trình duyệt không cho ghi clipboard → báo lỗi, không im lặng", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    render(<CopyButton value="HCM-A01-1-A" />);
    await user.click(screen.getByRole("button", { name: CLIPBOARD_LABELS.copy("HCM-A01-1-A") }));
    expect(error).toHaveBeenCalledWith(CLIPBOARD_LABELS.failed);
  });
});
