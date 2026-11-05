---
description: Chuyển một module Mode A sang style Vercel theo skill vercel-restyle — 1 module = 1 PR
argument-hint: <tên-feature> (vd purchase-order, receipt, inventory)
---

Chuyển module `$1` sang style Vercel. **Chỉ đổi giao diện — giữ nguyên logic.**
Checklist chi tiết: skill `vercel-restyle` — nạp skill đó trước khi sửa file nào.

## 6 bước

1. **Nhánh** — `git fetch origin && git checkout -b feature/restyle-$1 origin/develop`.
   Working tree phải sạch (trừ `.claude/launch.json` của người dùng — không commit file đó).
2. **Liệt kê + phân loại trang** — `src/app/admin/**/page.tsx` trỏ tới `features/$1` và component
   gốc trong `features/$1/components`. Ghi bảng: route · component · loại (danh sách / chi tiết /
   form). Trang không thuộc 3 loại → hỏi người dùng trước khi làm.
3. **Áp skill từng trang** theo đúng checklist loại của nó; combobox kiểu cũ → `InputCombobox`.
   Component dùng chung (`components/shared/*`) cần sửa → dừng, hỏi: sửa ở PR riêng để tránh
   conflict với các `/restyle` khác.
4. **Xem bản build mock** — mỗi loại trang ít nhất một trang (mục _Verify_ của skill).
5. **`pnpm run validate`** — một lần. Test fail → đối chiếu `git stash -u` trên HEAD sạch; chỉ
   sửa lỗi do mình gây ra, báo lỗi có sẵn.
6. **Commit, push, PR** — commit theo skill `git-commits` (không trailer công cụ, subject chữ
   thường đầu); `gh pr create --base develop`; body có bảng trang ở bước 2 + kết quả validate.
   **Dừng ở đó** — không comment PR, chờ người dùng review.

## Báo cáo cuối

Bảng trang đã chuyển, trang bỏ qua (kèm lý do), test sửa vì UI đổi, kết quả validate (lỗi mới vs
có sẵn), link PR.
