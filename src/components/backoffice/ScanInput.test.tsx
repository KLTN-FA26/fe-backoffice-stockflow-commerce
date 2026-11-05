import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ScanInput } from "./ScanInput";

describe("ScanInput", () => {
  it("tự focus; Enter gửi mã đã trim rồi xoá ô; Esc xoá ô", async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<ScanInput id="scan" label="Quét mã" onScan={onScan} />);
    const input = screen.getByLabelText("Quét mã");
    expect(input).toHaveFocus();

    await user.type(input, "  ABC-1 {Enter}");
    expect(onScan).toHaveBeenCalledWith("ABC-1");
    expect(input).toHaveValue("");

    await user.type(input, "xyz{Escape}");
    expect(input).toHaveValue("");
    await user.keyboard("{Enter}");
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it("đang xử lý mã trước vẫn nhận mã kế (máy quét không bị rơi ký tự)", async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<ScanInput id="scan" label="Quét mã" onScan={onScan} pending />);
    await user.type(screen.getByLabelText("Quét mã"), "ABC{Enter}");
    expect(onScan).toHaveBeenCalledWith("ABC");
  });

  it("bấm ra vùng trống (focus rơi về body) → ô quét tự lấy lại focus", async () => {
    render(<ScanInput id="scan" label="Quét mã" onScan={vi.fn()} />);
    const input = screen.getByLabelText("Quét mã");
    expect(input).toHaveFocus();
    input.blur();
    await waitFor(() => expect(input).toHaveFocus());
  });

  it("chuyển focus sang nút khác → không giành lại focus", async () => {
    render(
      <>
        <ScanInput id="scan" label="Quét mã" onScan={vi.fn()} />
        <button type="button">Khác</button>
      </>,
    );
    const other = screen.getByRole("button", { name: "Khác" });
    other.focus();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(other).toHaveFocus();
  });

  it("focus đang ở nút khác mà gõ phím (máy quét) → ký tự vào ô quét, không vào nút", async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(
      <>
        <ScanInput id="scan" label="Quét mã" onScan={onScan} />
        <button type="button">Thu gọn</button>
      </>,
    );
    screen.getByRole("button", { name: "Thu gọn" }).focus();
    await user.keyboard("PKG1{Enter}");
    expect(onScan).toHaveBeenCalledWith("PKG1");
  });

  it("phím cách trên nút đang focus vẫn bấm nút, không bị chuyển sang ô quét", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <ScanInput id="scan" label="Quét mã" onScan={vi.fn()} />
        <button type="button" onClick={onClick}>
          Thử lại
        </button>
      </>,
    );
    const button = screen.getByRole("button", { name: "Thử lại" });
    button.focus();
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).toHaveFocus();
  });

  it("khoá hẳn (disabled) → bỏ qua Enter", async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<ScanInput id="scan" label="Quét mã" onScan={onScan} disabled />);
    const input = screen.getByLabelText("Quét mã");
    expect(input).toBeDisabled();
    // Gõ vào ô bị khoá + Enter (kể cả bị chuyển focus từ document) → không gửi gì
    await user.type(input, "PKG-1{Enter}");
    await user.keyboard("PKG-2{Enter}");
    expect(onScan).not.toHaveBeenCalled();
  });

  it("lỗi quét đọc ngay qua role=alert", () => {
    render(
      <ScanInput
        id="scan"
        label="Quét mã"
        onScan={vi.fn()}
        feedback={{ tone: "danger", message: "Kiện không thuộc chuyến" }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Kiện không thuộc chuyến");
  });
});
