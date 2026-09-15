#!/usr/bin/env node
/**
 * Stop hook — nhắc chạy quy trình verify trước khi coi task là xong.
 *
 * CLAUDE.md: "Chưa chạy đủ 3 bước trên thì KHÔNG được nói task đã xong.
 * Không suy đoán 'chắc là pass'."
 *
 * Hook này KHÔNG tự chạy `pnpm run validate` (mất vài phút, sẽ làm treo phiên).
 * Nó chỉ kiểm tra: có file src/ nào đang dirty không? Nếu có và Claude chưa
 * chạy validate trong lượt này → chặn Stop một lần và bắt Claude verify.
 *
 * Chống lặp vô hạn: nếu stop_hook_active = true thì thôi, để Claude dừng.
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function git(args, cwd) {
  const result = spawnSync("git", args, {
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

  // Đã chặn một lần rồi — không chặn nữa, tránh vòng lặp.
  if (input?.stop_hook_active) process.exit(0);

  const projectDir = input?.cwd ?? process.cwd();

  // File source đang thay đổi (staged + unstaged + untracked).
  const status = git(["status", "--porcelain", "--", "src"], projectDir);
  if (!status) process.exit(0);

  const changed = status
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  // Chỉ quan tâm file code — sửa mỗi .md thì không cần build.
  const codeChanged = changed.filter((f) => /\.(ts|tsx|css)$/i.test(f));
  if (codeChanged.length === 0) process.exit(0);

  const preview = codeChanged.slice(0, 8).join("\n  ");
  const more = codeChanged.length > 8 ? `\n  … và ${codeChanged.length - 8} file nữa` : "";

  process.stderr.write(
    `Có ${codeChanged.length} file code đang thay đổi chưa commit:\n  ${preview}${more}\n\n` +
      `CLAUDE.md yêu cầu chạy đủ quy trình verify trước khi báo xong:\n` +
      `  1. pnpm run build\n  2. pnpm run lint\n  3. pnpm run typecheck && pnpm run test\n` +
      `(hoặc gộp: pnpm run validate)\n\n` +
      `Nếu ĐÃ chạy và dán output thật trong lượt này → trả lời ngắn gọn là đã verify rồi và dừng lại.\n` +
      `Nếu CHƯA chạy → chạy ngay bây giờ, dán output thật, phân biệt lỗi mình gây ra với lỗi có sẵn trên main.\n` +
      `Nếu người dùng chỉ hỏi thông tin / chưa muốn verify → nói rõ là bỏ qua bước này theo yêu cầu của họ.\n`,
  );
  process.exit(2);
}

main();
