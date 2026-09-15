---
description: Chạy đủ quy trình verify và phân biệt lỗi mới với lỗi có sẵn trên main
allowed-tools: Bash(pnpm run:*), Bash(git stash:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*)
---

Chạy quy trình verify bắt buộc theo CLAUDE.md. **Không được suy đoán "chắc là pass".**

## Bước 1 — chạy, đúng thứ tự

```
pnpm run build
pnpm run lint
pnpm run typecheck
pnpm run test
```

Hoặc gộp `pnpm run validate` (= typecheck → lint → test → build).
Chạy riêng từng lệnh khi cần thấy rõ lệnh nào hỏng.

## Bước 2 — dán output thật

Dán output thật của từng lệnh làm bằng chứng. **Không** mô tả chung chung kiểu
"build pass, lint ok". Người đọc phải thấy được con số và dòng lỗi.

## Bước 3 — nếu còn lỗi, phân biệt nguồn gốc

Lỗi mình gây ra hay lỗi đã có sẵn trên `main`? Kiểm chứng:

```
git stash                  # cất thay đổi của mình
pnpm run lint              # chạy lại trên HEAD sạch
git stash pop              # lấy lại thay đổi
```

So số lượng lỗi trước/sau. Rồi:

- **Lỗi mình gây ra** → phải sửa xong mới được báo hoàn thành.
- **Lỗi có sẵn trên main** → báo cho người dùng biết, **không tự ý sửa** ngoài phạm vi task.

## Bước 4 — báo cáo

Nêu rõ: lệnh nào pass, lệnh nào fail, bao nhiêu lỗi, lỗi nào là của mình.
Nếu tất cả pass thì nói thẳng là pass, không rào đón.

Không dùng `any`, `eslint-disable`, hay `@ts-expect-error` để lách cho qua.
