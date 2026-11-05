"use client";

import type { MatrixPreview } from "../axes-draft";

/** Khung "Sẽ tạo N biến thể" + vài SKU đầu — dùng ở bước trục và bước rà soát của form tạo. */
export function MatrixPreviewBox({ preview }: { preview: MatrixPreview }) {
  return (
    <div className="border-border-default bg-bg-subtle space-y-1 rounded-[var(--r-sm)] border p-3 text-[0.8125rem]">
      <p>
        Sẽ tạo <span className="text-ink-primary font-medium tabular-nums">{preview.total}</span>{" "}
        biến thể (Nháp)
      </p>
      {preview.samples.length > 0 && (
        <ul className="text-ink-secondary space-y-0.5 text-xs">
          {preview.samples.map((s) => (
            <li key={s.sku}>
              <span className="text-ink-primary font-[family-name:var(--font-mono)]">{s.sku}</span>{" "}
              — {s.label}
              {s.tooLong && <span className="text-danger"> (SKU quá dài)</span>}
            </li>
          ))}
          {preview.total > preview.samples.length && <li>…</li>}
        </ul>
      )}
    </div>
  );
}
