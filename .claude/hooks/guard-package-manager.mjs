#!/usr/bin/env node
/**
 * PreToolUse hook (Bash/PowerShell) — ép dùng pnpm.
 *
 * CLAUDE.md: "Dự án dùng pnpm (có pnpm-lock.yaml) — KHÔNG dùng `npm install`,
 * nó crash trên cây symlink của pnpm."
 *
 * Chặn npm install / yarn add / bun install và gợi ý lệnh pnpm tương đương.
 * `npx` được cho qua: husky và commitlint đang gọi npx trong .husky/*.
 */

import { readFileSync } from "node:fs";

/**
 * Chỉ khớp khi tên chương trình đứng ở ĐẦU MỘT LỆNH — đầu chuỗi, hoặc sau
 * `;` `&&` `||` `|` `(` `{` `\n` hay backtick/`$(`.
 *
 * Nếu dùng `\bnpm\b` trần thì chuỗi "npm install" nằm trong dữ liệu (vd một
 * script node in ra câu cảnh báo, hay `grep "npm install"`) cũng bị chặn oan.
 */
const CMD_START = String.raw`(?:^|[\n;|&(){]|&&|\|\||\$\()\s*`;

/** @type {{ pattern: RegExp, suggest: string }[]} */
const BLOCKED = [
  {
    pattern: new RegExp(CMD_START + String.raw`npm\s+(install|i|add|ci)\b`),
    suggest: "pnpm install  (hoặc `pnpm add <pkg>` để thêm dependency)",
  },
  {
    pattern: new RegExp(
      CMD_START +
        String.raw`npm\s+(run\s+)?(dev|build|lint|test|typecheck|validate|format|coverage)\b`,
    ),
    suggest: "pnpm run <script>",
  },
  {
    pattern: new RegExp(CMD_START + String.raw`yarn\b`),
    suggest: "pnpm — dự án chỉ có pnpm-lock.yaml, yarn.lock bị gitignore",
  },
  {
    pattern: new RegExp(CMD_START + String.raw`bun\s+(install|add|run)\b`),
    suggest: "pnpm — dự án khai báo packageManager: pnpm@10.9.0",
  },
];

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }

  const command = input?.tool_input?.command;
  if (typeof command !== "string" || command.length === 0) process.exit(0);

  const hit = BLOCKED.find((rule) => rule.pattern.test(command));
  if (!hit) process.exit(0);

  process.stderr.write(
    `BỊ CHẶN: lệnh này dùng package manager sai.\n\n` +
      `  ${command}\n\n` +
      `Dự án dùng pnpm (packageManager: pnpm@10.9.0, có pnpm-lock.yaml). ` +
      `npm install crash trên cây symlink của pnpm.\n\n` +
      `Dùng thay thế: ${hit.suggest}\n`,
  );
  process.exit(2);
}

main();
