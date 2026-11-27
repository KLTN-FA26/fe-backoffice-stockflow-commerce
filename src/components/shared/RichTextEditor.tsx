"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import type { Editor } from "@tiptap/react";
import type { ComponentType, SVGProps } from "react";

const L = UI_LABELS.richText;

/** Ảnh chèn vào mô tả — cùng loại BE nhận (`description-images`, ADR-0013). */
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

type Tool = {
  key: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  run: (editor: Editor) => void;
  active?: (editor: Editor) => boolean;
};

const TOOLS: readonly Tool[] = [
  {
    key: "bold",
    label: L.bold,
    icon: Bold,
    run: (e) => e.chain().focus().toggleBold().run(),
    active: (e) => e.isActive("bold"),
  },
  {
    key: "italic",
    label: L.italic,
    icon: Italic,
    run: (e) => e.chain().focus().toggleItalic().run(),
    active: (e) => e.isActive("italic"),
  },
  {
    key: "underline",
    label: L.underline,
    icon: Underline,
    run: (e) => e.chain().focus().toggleUnderline().run(),
    active: (e) => e.isActive("underline"),
  },
  {
    key: "strike",
    label: L.strike,
    icon: Strikethrough,
    run: (e) => e.chain().focus().toggleStrike().run(),
    active: (e) => e.isActive("strike"),
  },
  {
    key: "h2",
    label: L.heading2,
    icon: Heading2,
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    active: (e) => e.isActive("heading", { level: 2 }),
  },
  {
    key: "h3",
    label: L.heading3,
    icon: Heading3,
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    active: (e) => e.isActive("heading", { level: 3 }),
  },
  {
    key: "bullet",
    label: L.bulletList,
    icon: List,
    run: (e) => e.chain().focus().toggleBulletList().run(),
    active: (e) => e.isActive("bulletList"),
  },
  {
    key: "ordered",
    label: L.orderedList,
    icon: ListOrdered,
    run: (e) => e.chain().focus().toggleOrderedList().run(),
    active: (e) => e.isActive("orderedList"),
  },
  {
    key: "quote",
    label: L.quote,
    icon: Quote,
    run: (e) => e.chain().focus().toggleBlockquote().run(),
    active: (e) => e.isActive("blockquote"),
  },
  { key: "undo", label: L.undo, icon: Undo2, run: (e) => e.chain().focus().undo().run() },
  { key: "redo", label: L.redo, icon: Redo2, run: (e) => e.chain().focus().redo().run() },
];

/** HTML của editor; editor rỗng (`<p></p>`) → "" để form coi là chưa nhập. */
function htmlOf(editor: Editor): string {
  return editor.isEmpty ? "" : editor.getHTML();
}

/**
 * Ô soạn mô tả rich text (Tiptap StarterKit + Image) — dùng chung cho mô tả sản phẩm và biến thể. Giá trị là HTML
 * (`editor.getHTML()`); BE lọc lại theo allow-list trước khi lưu (ADR-0013), nên ở đây không tự lọc.
 *
 * Không chứa nghiệp vụ: tải ảnh qua `onUploadImage` (nơi dùng gọi API, trả URL công khai); không truyền thì không có
 * nút chèn ảnh. Ảnh dán link ngoài sẽ bị BE bỏ — chỉ ảnh tải lên qua đây mới được giữ.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  onUploadImage,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  id: string;
  value: string;
  onChange: (html: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const fileInputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  // Giữ onChange mới nhất mà không tạo lại editor mỗi lần render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, protocols: ["http", "https", "mailto"] },
      }),
      Image,
    ],
    content: value,
    editable: !disabled,
    // Next.js render trên server trước: tạo editor ở client để tránh lệch hydrate.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        ...(ariaInvalid ? { "aria-invalid": "true" } : {}),
        ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
      },
    },
    onUpdate: ({ editor: current }) => onChangeRef.current(htmlOf(current)),
  });

  // Giá trị đổi từ ngoài (reset form, tải bản mới) → nạp lại, không phát onUpdate để không đánh dấu form bẩn.
  useEffect(() => {
    if (editor && value !== htmlOf(editor)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  // `false`: setEditable mặc định phát sự kiện update → onChange giả mỗi lần mount / khoá, làm form tưởng đã sửa.
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);

  async function insertImage(file: File | undefined) {
    if (!file || !editor || !onUploadImage) return;
    setUploading(true);
    setUploadError(false);
    try {
      const src = await onUploadImage(file);
      editor.chain().focus().setImage({ src, alt: file.name }).run();
    } catch {
      setUploadError(true);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const locked = disabled || !editor;
  return (
    <div
      className={`border-border-default bg-bg-surface rounded-(--field-radius) border ${
        ariaInvalid ? "border-danger" : ""
      }`}
    >
      <div
        role="toolbar"
        aria-label={L.toolbar}
        aria-controls={id}
        className="border-border-default flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1"
      >
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const pressed = editor && tool.active ? tool.active(editor) : undefined;
          return (
            <Button
              key={tool.key}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={tool.label}
              title={tool.label}
              aria-pressed={pressed}
              disabled={locked}
              onClick={() => editor && tool.run(editor)}
              className={pressed ? "bg-bg-muted" : ""}
            >
              <Icon className="size-3.5" />
            </Button>
          );
        })}
        {onUploadImage && (
          <>
            <input
              ref={fileInput}
              id={fileInputId}
              type="file"
              accept={IMAGE_ACCEPT}
              className="sr-only"
              disabled={locked || uploading}
              onChange={(event) => void insertImage(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={uploading ? L.uploading : L.image}
              title={uploading ? L.uploading : L.image}
              disabled={locked || uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImagePlus className="size-3.5" />
              )}
            </Button>
          </>
        )}
      </div>
      <EditorContent editor={editor} className="rich-text px-3 py-2" />
      {uploadError && (
        <p role="alert" className="text-danger border-border-default border-t px-3 py-1.5 text-xs">
          {L.imageError}
        </p>
      )}
    </div>
  );
}
