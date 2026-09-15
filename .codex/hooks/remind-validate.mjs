#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function git(args, cwd) {
  const result = spawnSync("git", ["-c", `safe.directory=${cwd.replaceAll("\\", "/")}`, ...args], {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 15_000,
  });
  return result.status === 0 ? (result.stdout ?? "").trim() : "";
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }

  if (input?.stop_hook_active) process.exit(0);

  const projectDir = input?.cwd ?? process.cwd();
  const status = git(["status", "--porcelain", "--", "src"], projectDir);
  if (!status) process.exit(0);

  const changed = status
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter((file) => /\.(ts|tsx|css)$/i.test(file));
  if (changed.length === 0) process.exit(0);

  const preview = changed.slice(0, 8).join("\n  ");
  const more = changed.length > 8 ? `\n  … và ${changed.length - 8} file nữa` : "";
  process.stderr.write(
    `Có ${changed.length} file code đang thay đổi:\n  ${preview}${more}\n\n` +
      "Trước khi báo hoàn thành, chạy pnpm run validate và báo output thật. " +
      "Nếu người dùng chỉ yêu cầu đọc/trao đổi hoặc đã yêu cầu bỏ qua verify, có thể dừng và nói rõ.\n",
  );
  process.exit(2);
}

main();
