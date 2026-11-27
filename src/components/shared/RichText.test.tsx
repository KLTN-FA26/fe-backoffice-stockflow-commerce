import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RichTextEditor } from "./RichTextEditor";
import { RichTextView, sanitizeRichText } from "./RichTextView";

describe("sanitizeRichText — allow-list như BE RichTextPolicy (ADR-0013)", () => {
  it("giữ định dạng của StarterKit + Image", () => {
    const html =
      '<h2>Ly</h2><p>In <strong>logo</strong> <em>2 mặt</em></p><ul><li>12oz</li></ul><img src="https://cdn.test/a.jpg" alt="Ly">';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("bỏ script, thuộc tính sự kiện, style và link javascript:", () => {
    const clean = sanitizeRichText(
      '<p style="color:red" onclick="x()">Ly</p><script>x()</script><a href="javascript:x()">a</a>',
    );
    expect(clean).not.toMatch(/script|onclick|style|javascript/);
    expect(clean).toContain("<p>Ly</p>");
  });

  it("chỉ có thẻ rỗng / khoảng trắng → rỗng", () => {
    expect(sanitizeRichText("<p></p>")).toBe("");
    expect(sanitizeRichText("  ")).toBe("");
    expect(sanitizeRichText(null)).toBe("");
  });
});

describe("RichTextView", () => {
  it("rỗng → câu báo chưa có mô tả", () => {
    render(<RichTextView html="<p></p>" empty="Chưa có mô tả." />);
    expect(screen.getByText("Chưa có mô tả.")).toBeInTheDocument();
  });

  it("có nội dung → render HTML đã lọc", () => {
    render(<RichTextView html="<p>Ly <strong>12oz</strong></p>" />);
    expect(screen.getByText("12oz").tagName).toBe("STRONG");
  });
});

describe("RichTextEditor", () => {
  it("có thanh công cụ định dạng; không truyền onUploadImage thì không có nút chèn ảnh", async () => {
    render(<RichTextEditor id="d" aria-label="Mô tả" value="<p>Ly</p>" onChange={() => {}} />);
    expect(await screen.findByRole("toolbar", { name: "Định dạng mô tả" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "In đậm" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chèn ảnh" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Mô tả" })).toHaveTextContent("Ly"),
    );
  });

  it("chèn ảnh: gọi onUploadImage rồi thêm <img> với URL trả về vào HTML", async () => {
    const onChange = vi.fn();
    const onUploadImage = vi.fn().mockResolvedValue("https://cdn.test/product-images/a.jpg");
    const { container } = render(
      <RichTextEditor
        id="d"
        aria-label="Mô tả"
        value="<p>Ly</p>"
        onChange={onChange}
        onUploadImage={onUploadImage}
      />,
    );
    expect(await screen.findByRole("button", { name: "Chèn ảnh" })).toBeInTheDocument();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("no file input");
    const file = new File(["x"], "ly.png", { type: "image/png" });
    await userEvent.setup().upload(input, file);

    expect(onUploadImage).toHaveBeenCalledWith(file);
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.stringContaining('src="https://cdn.test/product-images/a.jpg"'),
      ),
    );
  });

  it("tải ảnh lỗi: báo lỗi ngay dưới ô soạn, không chèn gì", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor
        id="d"
        aria-label="Mô tả"
        value=""
        onChange={onChange}
        onUploadImage={() => Promise.reject(new Error("boom"))}
      />,
    );
    await screen.findByRole("button", { name: "Chèn ảnh" });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("no file input");
    await userEvent.setup().upload(input, new File(["x"], "ly.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được ảnh lên");
    expect(onChange).not.toHaveBeenCalled();
  });
});
