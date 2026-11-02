"use client";

import type { MapShortcut } from "@/constants";

/** Bảng phím tắt trong modal "?" — mỗi dòng: các phím (dạng `<kbd>`) và việc nó làm. */
export function ShortcutList({
  title,
  shortcuts,
}: {
  title: string;
  shortcuts: readonly MapShortcut[];
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-ink-secondary text-xs font-semibold">{title}</h3>
      <dl className="divide-y divide-(--table-line) text-xs">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.label} className="flex items-center justify-between gap-3 py-1.5">
            <dt className="text-ink-primary">{shortcut.label}</dt>
            <dd className="flex shrink-0 flex-wrap justify-end gap-1">
              {shortcut.keys.map((key) => (
                <kbd
                  key={key}
                  className="border-border-default bg-bg-subtle text-ink-primary min-w-6 rounded-(--r-sm) border px-1.5 py-0.5 text-center font-[family-name:var(--font-mono)] text-[0.6875rem]"
                >
                  {key}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
