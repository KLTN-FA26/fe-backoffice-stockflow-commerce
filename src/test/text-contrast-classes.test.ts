import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * BO-UX-1 (WCAG 1.4.3): `--accent` (3.68:1), `--warning` (2.94:1) and `--positive` (3.49:1) are too light for text.
 * Link text takes `text-accent-text`; text that must carry a tone takes `text-warning-ink` / `text-positive-ink`
 * (design-tokens.md). The guard scans source lines rather than rendered DOM so a link added later on any screen is
 * caught, not just the ones a render test happens to cover.
 */
const SRC = path.resolve(process.cwd(), "src");
const BARE_ACCENT = /(?:^|[\s"'`])text-accent(?![-\w/])/;
const BARE_TONE = /(?:^|[\s"'`])text-(?:warning|positive)(?![-\w/])/;
const ICON_SIZE = /(?:^|[\s"'`])size-[\d.]+/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function offendingLines(dirs: readonly string[], test: (line: string) => boolean): string[] {
  return dirs
    .flatMap((dir) => sourceFiles(path.join(SRC, dir)))
    .flatMap((file) =>
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .flatMap((line, index) =>
          test(line)
            ? [`${path.relative(SRC, file).replaceAll("\\", "/")}:${index + 1}: ${line.trim()}`]
            : [],
        ),
    );
}

describe("text colour tokens with enough contrast", () => {
  it("no underlined link text in the light accent anywhere in the app", () => {
    expect(
      offendingLines(
        ["app", "components", "features", "lib"],
        (line) => BARE_ACCENT.test(line) && /underline/.test(line),
      ),
    ).toEqual([]);
  });

  it("WF-02 screens (chat, quote, order, payment): no text in the light warning / positive tone", () => {
    expect(
      offendingLines(
        ["features/chat", "features/quote", "features/order", "features/payment"],
        // An icon (`size-*`) may carry the tone; text may not.
        (line) => BARE_TONE.test(line) && !ICON_SIZE.test(line),
      ),
    ).toEqual([]);
  });
});
