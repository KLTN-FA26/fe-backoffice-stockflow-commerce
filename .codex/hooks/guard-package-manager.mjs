#!/usr/bin/env node
import { readFileSync } from "node:fs";

const COMMAND_START = String.raw`(?:^|[\n;|&(){]|&&|\|\||\$\()\s*`;
const BLOCKED = [
  {
    pattern: new RegExp(COMMAND_START + String.raw`npm\s+(install|i|add|ci)\b`, "i"),
    suggestion: "pnpm install hoặc pnpm add <pkg>",
  },
  {
    pattern: new RegExp(
      COMMAND_START +
        String.raw`npm\s+(run\s+)?(dev|build|lint|test|typecheck|validate|format|coverage)\b`,
      "i",
    ),
    suggestion: "pnpm run <script>",
  },
  {
    pattern: new RegExp(COMMAND_START + String.raw`yarn\b`, "i"),
    suggestion: "pnpm — repo chỉ dùng pnpm-lock.yaml",
  },
  {
    pattern: new RegExp(COMMAND_START + String.raw`bun\s+(install|add|run)\b`, "i"),
    suggestion: "pnpm — repo khai báo packageManager pnpm",
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

  const blocked = BLOCKED.find(({ pattern }) => pattern.test(command));
  if (!blocked) process.exit(0);

  process.stderr.write(
    `BỊ CHẶN: lệnh dùng package manager sai.\n\n  ${command}\n\n` +
      `Dùng thay thế: ${blocked.suggestion}\n`,
  );
  process.exit(2);
}

main();
