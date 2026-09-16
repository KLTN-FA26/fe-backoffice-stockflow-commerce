#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const FORMATTABLE = /\.(ts|tsx|css|mjs|json|md)$/i;
const LINTABLE = /\.(ts|tsx)$/i;
const SKIP = /(^|[\\/])(node_modules|\.next|coverage)([\\/]|$)|pnpm-lock\.yaml$/i;

function patchPaths(patch) {
  if (typeof patch !== "string") return [];
  return [...patch.matchAll(/^\*\*\* (?:Add|Update) File: (.+)$/gm)].map((match) =>
    match[1].trim(),
  );
}

function run(args, cwd) {
  return spawnSync("pnpm", ["exec", ...args], {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 45_000,
  });
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }

  const projectDir = input?.cwd ?? process.cwd();
  const toolInput = input?.tool_input;
  const candidates = [
    ...(typeof toolInput?.file_path === "string" ? [toolInput.file_path] : []),
    ...patchPaths(toolInput?.command ?? toolInput?.patch),
  ];

  const files = [...new Set(candidates)]
    .map((file) => (path.isAbsolute(file) ? file : path.resolve(projectDir, file)))
    .filter((file) => {
      const relative = path.relative(projectDir, file);
      return (
        !relative.startsWith("..") &&
        !path.isAbsolute(relative) &&
        existsSync(file) &&
        FORMATTABLE.test(file) &&
        !SKIP.test(relative)
      );
    });

  for (const file of files) {
    run(["prettier", "--write", file], projectDir);
    if (!LINTABLE.test(file)) continue;
    const lint = run(["eslint", "--fix", "--max-warnings", "0", file], projectDir);
    const output = `${lint.stdout ?? ""}${lint.stderr ?? ""}`.trim();
    if (lint.status !== 0 && output) {
      process.stdout.write(
        `eslint còn lỗi chưa tự sửa được ở ${path.relative(projectDir, file)}:\n${output}\n`,
      );
    }
  }
}

main();
