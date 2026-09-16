#!/usr/bin/env node
import { readFileSync } from "node:fs";

const PROTECTED = [
  {
    pattern: /src[\\/]lib[\\/]mock-data\.ts$/i,
    reason: "mock-data.ts là nguồn sự thật; thêm behavior ở lib/api/mock-adapter.ts.",
  },
  {
    pattern: /src[\\/]_design[\\/].*RULES\.md$/i,
    reason: "Hai file _design/*RULES.md là đặc tả dự án; chỉ sửa khi người dùng yêu cầu rõ.",
  },
  {
    pattern: /src[\\/]components[\\/]ui[\\/]/i,
    reason: "components/ui/* là shadcn nguyên bản; tạo wrapper hoặc cva variant bên ngoài.",
  },
  {
    pattern: /(^|[\\/])\.env(\.|$)/i,
    reason: "Không đọc hoặc sửa file bí mật; cập nhật .env.example nếu cần.",
  },
];

function patchPaths(patch) {
  if (typeof patch !== "string") return [];
  return [...patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)].map((match) =>
    match[1].trim(),
  );
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }

  const toolInput = input?.tool_input;
  const paths = [
    ...(typeof toolInput?.file_path === "string" ? [toolInput.file_path] : []),
    ...(typeof toolInput?.notebook_path === "string" ? [toolInput.notebook_path] : []),
    ...patchPaths(toolInput?.command ?? toolInput?.patch),
  ];

  for (const filePath of paths) {
    const protectedFile = PROTECTED.find(({ pattern }) => pattern.test(filePath));
    if (!protectedFile) continue;
    process.stderr.write(`BỊ CHẶN: ${filePath}\n\n${protectedFile.reason}\n`);
    process.exit(2);
  }
}

main();
