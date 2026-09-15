#!/usr/bin/env node
/**
 * PostToolUse hook — format + autofix riêng file Claude vừa sửa.
 *
 * Chạy prettier rồi eslint --fix trên MỘT file, không quét cả src/ —
 * giữ độ trễ ở mức vài trăm ms mỗi lần Edit.
 *
 * Không trùng husky: lint-staged chạy lúc commit trên staged files;
 * hook này chạy ngay lúc sửa nên lỗi format không tích lại tới cuối phiên.
 *
 * Luôn exit 0 — format hỏng không được chặn công việc. Lỗi eslint còn lại
 * sẽ được báo cho Claude qua stdout để tự sửa.
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const FORMATTABLE = /\.(ts|tsx|css|mjs|json|md)$/i;
const LINTABLE = /\.(ts|tsx)$/i;
const SKIP = /(node_modules|\.next|coverage|pnpm-lock\.yaml)/i;

/** Chạy lệnh qua pnpm exec, trả về { ok, output }. */
function run(args, cwd) {
  const result = spawnSync("pnpm", ["exec", ...args], {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32", // Windows cần shell để resolve pnpm.cmd
    timeout: 30_000,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }

  const filePath = input?.tool_input?.file_path;
  const projectDir = input?.cwd ?? process.cwd();

  if (typeof filePath !== "string") process.exit(0);
  if (SKIP.test(filePath)) process.exit(0);
  if (!FORMATTABLE.test(filePath)) process.exit(0);

  // Chỉ xử lý file nằm trong project.
  const relative = path.relative(projectDir, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) process.exit(0);

  run(["prettier", "--write", filePath], projectDir);

  if (LINTABLE.test(filePath)) {
    const lint = run(["eslint", "--fix", "--max-warnings", "0", filePath], projectDir);
    if (!lint.ok && lint.output) {
      // stdout của PostToolUse hiện lên cho Claude đọc — để nó tự sửa phần eslint không fix được.
      process.stdout.write(
        `eslint còn lỗi chưa tự sửa được ở ${relative}:\n${lint.output}\n\n` +
          `Sửa ngay trước khi đi tiếp. Không dùng \`any\` hay \`eslint-disable\` để lách.\n`,
      );
    }
  }

  process.exit(0);
}

main();
