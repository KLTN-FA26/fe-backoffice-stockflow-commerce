---
description: Cấu trúc feature folder, import boundaries, giới hạn kích thước file
globs: ["src/features/**", "src/app/**/page.tsx", "src/components/shared/**"]
---

# Kiến trúc feature

Nguồn: `src/_design/PRODUCTION-FRONTEND-RULES.md` §1. Mapping module ↔ feature ↔ route ở Phụ lục B.

**Nghiệp vụ sống trong `features/`.** `app/**/page.tsx` chỉ compose, không chứa logic.

## 7 file bắt buộc mỗi feature

```
features/<module>/
├── api.ts          # axios calls: listX, getX, submitX...
├── schemas.ts      # zod: XDto, XCreateInput (+ BR refines, kèm comment cite docs)
├── types.ts        # export type từ schemas (z.infer) — KHÔNG khai báo type tay
├── queries.ts      # useXs(params), useX(id), queryKeys
├── mutations.ts    # useSubmitX()... + invalidation map
├── lifecycle.ts    # X_TRANSITIONS + allowedActions(status, role)
├── selectors.ts    # computeXStats(list), openQuantity(line) — PURE, không side effect
├── components/     # component page-level, tách nhỏ
└── index.ts        # public API của feature
```

Tên folder = kebab-case **trùng tên module docs** (`purchase-order` ↔ `docs/warehouse/02-purchase-order`).

## Giới hạn kích thước — vượt là phải tách

- File feature ≤ **200 dòng**
- Component ≤ **150 dòng**
- `page.tsx` ≤ **60 dòng** (chỉ compose, ~40 là lý tưởng)

## Import boundaries (cấm)

- `features/A` **KHÔNG** import `features/B` → dùng `lib/domain` hoặc prop drilling qua page.
- `components/shared` **KHÔNG** import `features/*` hay `lib/api/*` → shared phải vô nghiệp vụ.
- `app/**/page.tsx` chỉ import `features/*` + `components/*`.
- **Không component nào** import `src/lib/mock-data.ts` — chỉ `lib/api/mock-adapter.ts` được phép.
  CI grep chặn: `! grep -rn 'from "@/lib/mock-data"' src/app src/components src/features`

## Action-gating — không rải if/else trong JSX (§6)

Trạng thái và quyền quyết định nút nào hiện, qua hai lớp:

1. `lifecycle.ts` — transition table chép từ bảng "Chuyển tiếp cho phép" trong docs.
   Terminal state (vd `Closed`) phải `=== []`, không có nút mutating nào.
2. `allowedActions(status, role)` trả về action descriptor → `<ActionButton>` render.

Permission dùng `can(role, perm)` từ `lib/domain/permissions.ts`, hoặc `<Can perm="po.approve">`.
**UI-only** — luôn kèm comment `// Backend phải re-check (BR-xx)`; không bao giờ tin client.

## State — ranh giới rõ (§5)

| Loại state                         | Chỗ ở                                  |
| ---------------------------------- | -------------------------------------- |
| Server data                        | React Query (`queries.ts`)             |
| Filter / sort / page               | **URL** qua `nuqs` + `use-url-filters` |
| Column prefs, density              | zustand persist (`use-table-prefs`)    |
| Warehouse hiện tại, sidebar, theme | zustand (`use-app-store`)              |
| Form                               | react-hook-form + zodResolver          |

**Không** dùng localStorage cho filter. F5 và copy URL sang tab khác phải giữ nguyên state.

## Mọi trạng thái đều có UI (§8)

Mỗi route cần `loading.tsx` + `error.tsx`, và EmptyState **2 loại**:
"chưa có dữ liệu" khác với "lọc không ra kết quả".

## Format & lookup — một chỗ duy nhất (§10)

Tiền/ngày/số qua `lib/format/*`. Lookup tên supplier/warehouse qua `lib/references`,
không `.find()` rải rác trong component.
