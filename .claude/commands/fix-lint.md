---
description: Sửa hết lỗi lint và typecheck, không dùng any hay eslint-disable để lách
allowed-tools: Bash(pnpm run:*), Bash(pnpm exec:*), Bash(git stash:*), Bash(git diff:*), Bash(git status:*), Read, Edit, Grep, Glob
---

Sửa lỗi lint + typecheck trong `${1:-src}`.

## Quy trình

1. Chạy `pnpm run typecheck` và `pnpm run lint` — xem toàn bộ lỗi trước khi sửa gì.
2. Nếu lỗi nhiều, phân loại trước: lỗi do thay đổi gần đây hay lỗi có sẵn trên `main`?
   Kiểm chứng bằng `git stash` → chạy lại → `git stash pop`.
3. Sửa từng nhóm lỗi một, chạy lại sau mỗi nhóm để chắc không tạo lỗi mới.
4. Chạy `pnpm run lint` lần cuối — phải 0 warning (`--max-warnings 0`).

## Cấm lách

Những cách này bị cấm vì chúng giấu lỗi thay vì sửa:

- `any` — dùng `unknown` + narrow, hoặc khai đúng type từ `z.infer`.
- `eslint-disable` / `eslint-disable-next-line` — trừ khi có lý do kỹ thuật thật,
  và phải kèm comment giải thích tại sao.
- `@ts-expect-error` / `@ts-ignore`.
- Ép kiểu `as X` để dập tắt lỗi — chỉ dùng khi thực sự biết rõ hơn compiler và có comment.

## Ranh giới

Chỉ sửa lỗi lint/type. **Không** nhân tiện refactor, đổi tên, hay "dọn dẹp" thêm —
việc đó làm diff khó review và vượt phạm vi task.

Nếu một lỗi cần đổi kiến trúc mới sửa được, dừng lại và báo cho người dùng thay vì tự quyết.
