import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilePickerField } from "./FilePickerField";

describe("FilePickerField", () => {
  it("chưa chọn: nút 'Chọn tệp' + 'Chưa chọn tệp' tiếng Việt (không có chữ của trình duyệt)", () => {
    render(<FilePickerField id="f" onChange={() => {}} />);
    expect(screen.getByText("Chọn tệp")).toBeInTheDocument();
    expect(screen.getByText("Chưa chọn tệp")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Choose File|No file chosen/i);
  });

  it("đã chọn: hiện tên tệp và nút 'Đổi tệp'", () => {
    render(<FilePickerField id="f" fileName="hop-dong.pdf" onChange={() => {}} />);
    expect(screen.getByText("hop-dong.pdf")).toBeInTheDocument();
    expect(screen.getByText("Đổi tệp")).toBeInTheDocument();
  });

  it("chọn tệp → onChange nhận tệp đó", async () => {
    const onChange = vi.fn();
    const { container } = render(<FilePickerField id="f" onChange={onChange} />);
    const file = new File(["x"], "a.pdf", { type: "application/pdf" });
    const input = container.querySelector<HTMLInputElement>("input#f");
    expect(input).not.toBeNull();
    await userEvent.upload(input as HTMLInputElement, file);
    expect(onChange).toHaveBeenCalledWith(file);
  });
});
