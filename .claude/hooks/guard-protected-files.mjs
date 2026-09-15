#!/usr/bin/env node
/**
 * PreToolUse hook — chặn Claude sửa các file được CLAUDE.md khai báo là bất khả xâm phạm.
 *
 * Biến luật mềm trong CLAUDE.md thành rào cứng:
 *   - src/lib/mock-data.ts            → "Không sửa mock-data.ts"
 *   - src/_design/*RULES.md           → "không sửa 2 file _design/*RULES.md trừ khi người dùng yêu cầu"
 *   - src/components/ui/*             → shadcn nguyên bản (PRODUCTION-FRONTEND-RULES §1)
 *   - .env*                           → bí mật, không nằm trong phạm vi agent
 *
 * exit 2 = chặn tool call, stderr được trả về cho Claude như phản hồi của người dùng.
 */

import { readFileSync } from "node:fs";

/** @type {{ pattern: RegExp, reason: string }[]} */
const PROTECTED = [
  {
    pattern: /src[\\/]lib[\\/]mock-data\.ts$/i,
    reason:
      "mock-data.ts là nguồn sự thật cho field name và union type trạng thái. " +
      "CLAUDE.md: 'Giữ nguyên mọi field name trong mock-data.ts — không rename.' " +
      "Nếu cần dữ liệu khác, thêm route vào lib/api/mock-adapter.ts thay vì sửa file này.",
  },
  {
    pattern: /src[\\/]_design[\\/].*RULES\.md$/i,
    reason:
      "FRONTEND-AI-RULES.md và PRODUCTION-FRONTEND-RULES.md là hiến pháp của dự án. " +
      "CLAUDE.md: 'không sửa 2 file _design/*RULES.md trừ khi người dùng yêu cầu.' " +
      "Muốn đổi luật thì hỏi người dùng trước, đừng tự sửa để code của mình hợp lệ.",
  },
  {
    pattern: /src[\\/]components[\\/]ui[\\/]/i,
    reason:
      "components/ui/* là shadcn nguyên bản — PRODUCTION-FRONTEND-RULES §1: 'KHÔNG sửa tay'. " +
      "Cần biến thể thì tạo wrapper trong components/shared/ hoặc dùng cva variant, " +
      "đừng patch trực tiếp để lần chạy `shadcn add` sau không ghi đè mất.",
  },
  {
    pattern: /(^|[\\/])\.env(\.|$)/i,
    reason: "File .env chứa bí mật. Sửa .env.example nếu cần khai báo biến mới.",
  },
];

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    // Không parse được input thì không chặn — hook hỏng không được làm kẹt phiên làm việc.
    process.exit(0);
  }

  const filePath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
  if (typeof filePath !== "string" || filePath.length === 0) process.exit(0);

  const hit = PROTECTED.find((rule) => rule.pattern.test(filePath));
  if (!hit) process.exit(0);

  process.stderr.write(
    `BỊ CHẶN: ${filePath}\n\n${hit.reason}\n\n` +
      `Nếu người dùng đã yêu cầu rõ ràng sửa file này, hãy nói với họ rằng hook đang chặn ` +
      `và đề nghị họ tự sửa hoặc tạm tắt hook trong .claude/settings.json.\n`,
  );
  process.exit(2);
}

main();
