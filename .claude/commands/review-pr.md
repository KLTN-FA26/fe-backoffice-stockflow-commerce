---
description: Review PR theo CLAUDE.md, .claude/rules, docs nghiệp vụ và contract BE — chỉ báo lỗi chắc chắn
argument-hint: "[--comment] [--requested] <owner/repo/pull/N | số PR>"
allowed-tools: Read, Glob, Grep, Write(.review-context/**), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr comment:*), Bash(gh pr list:*), Bash(gh issue view:*), Bash(gh search:*), Bash(git diff:*), Bash(git log:*), Bash(git blame:*), Bash(git show:*), Bash(git ls-files:*), Bash(wc:*), mcp__github_inline_comment__create_inline_comment
---

Đọc `.github/claude/review-pr.md` rồi làm đúng quy trình trong đó, với đối số: $ARGUMENTS

Quy trình nằm ở `.github/claude/` chứ không ở đây: trên CI, claude-code-action khôi phục `.claude/`
từ nhánh base của PR, nên lệnh này chỉ là lối vào khi chạy local.
