<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# StockFlow UI — Codex project instructions

## Phạm vi

Frontend production cho StockFlowCommerce. Nghiệp vụ lấy từ `D:\FPTU\Capstone\docs\docs\`
(18 module). Giai đoạn hiện tại: refactor từ UI-only sang kiến trúc production (data layer,
validation, state, permission, test). Backend chưa sẵn sàng: chạy
`NEXT_PUBLIC_USE_MOCK=true`; component không import mock trực tiếp.

**Stack:** Next.js App Router + TypeScript strict · Tailwind v4 + shadcn/ui · TanStack Query

- axios · zod + react-hook-form · zustand · nuqs · Framer Motion · lucide-react · Vitest +
  RTL + MSW.

Hướng dẫn trực tiếp của người dùng luôn ưu tiên hơn quy ước trong file này và các skill.
Nếu một skill hoặc rule khiến công việc phải dừng, đổi hướng, hoặc cần xin phép, nêu rõ file
và chỉ dẫn liên quan.

## Luật theo phạm vi file

Trước khi sửa file khớp phạm vi dưới đây, đọc toàn bộ rule tương ứng trong
`.claude/rules/`. Đây là nguồn dùng chung cho Claude Code và Codex; không tạo bản sao để
tránh drift.

| Rule                      | Áp dụng khi sửa                                                               |
| ------------------------- | ----------------------------------------------------------------------------- |
| `design-tokens.md`        | mọi `.tsx`/`.css`: màu, spacing, radius, z-index, dark mode, a11y             |
| `mode-a-backoffice.md`    | `src/app/admin/**`, `src/app/(backoffice)/**`, `src/components/backoffice/**` |
| `mode-b-storefront.md`    | `src/app/(storefront)/**`, `src/components/storefront/**`                     |
| `data-table-mode-a.md`    | trang danh sách admin và shared table/filter/header                           |
| `feature-architecture.md` | `src/features/**`                                                             |
| `api-conventions.md`      | `src/lib/api/**`, schemas/query/mutation/validation                           |
| `state-persistence.md`    | hooks, stores, app state và feature component state                           |
| `shared-components.md`    | `src/components/**`, feature components                                       |
| `testing.md`              | test, test config và test infrastructure                                      |

Tài liệu nguồn đầy đủ: `src/_design/FRONTEND-AI-RULES.md` và
`src/_design/PRODUCTION-FRONTEND-RULES.md`. Style chuẩn:
`src/_design/components-preview.html`.

**Xung đột:** nghiệp vụ → docs module thắng. Kỹ thuật →
`PRODUCTION-FRONTEND-RULES.md` thắng.

## Luật không được vi phạm

- Component không import `src/lib/mock-data.ts`; chỉ `src/lib/api/mock-adapter.ts` được phép.
- Giữ nguyên field name trong mock data và status nguyên văn theo union type trong docs.
- Không bịa record, ID, tên hay số tiền. KPI phải derive từ data thật qua `selectors.ts`.
- Mode A và Mode B tách biệt hoàn toàn: caramel không lọt vào back-office; blue/ink không
  làm CTA ở storefront. Không dùng hồng/magenta, hex trần, `!important`, hoặc `any`.
- Mọi `BR-xx` encode trong zod refine hoặc transition table phải có comment cite docs.
- Không sửa `src/lib/mock-data.ts`, `src/components/ui/*`, hoặc hai file
  `src/_design/*RULES.md`, trừ khi người dùng yêu cầu rõ ràng đúng file đó.
- Không đọc hoặc sửa `.env`/`.env.*`; dùng `.env.example` khi cần khai báo biến.
- Dự án chỉ dùng pnpm. Không chạy `npm install`, `npm ci`, yarn hoặc bun.

## Quy trình làm việc

Mỗi task = một module = một PR, theo Refactor Playbook §13. Với refactor module, dùng skill
`$stockflow-module`. Route `/admin/*` là Mode A; storefront là Mode B. Tên feature folder
theo Phụ lục B.

Trước khi báo hoàn thành thay đổi code, chạy `pnpm run validate` (typecheck → lint → test →
build) hoặc bốn lệnh riêng `pnpm run build`, `pnpm run lint`, `pnpm run typecheck`,
`pnpm run test`. Không tuyên bố pass khi chưa có output thật. Nếu còn lỗi, phân biệt lỗi do
thay đổi hiện tại với lỗi có sẵn trên baseline; không tự sửa lỗi ngoài phạm vi.

Repo skills: `$stockflow-module`, `$stockflow-validate`, `$stockflow-fix-lint`,
`$stockflow-design-check`, `$status-badge`, `$zod-br-schema`.

Custom review agents: `design_reviewer`, `architecture_reviewer`. Chúng chỉ review read-only;
chỉ giao việc cho subagent khi người dùng yêu cầu review/delegation hoặc gọi rõ agent.

## Code style bắt buộc

- Import theo thứ tự: `"use client"` → external → `@/constants` → `@/lib`/`@/hooks` →
  `@/features` → `@/components` → relative → `import type` riêng ở cuối → side-effect.
  Tách nhóm bằng một dòng trống và sort alphabet trong nhóm.
- Không hardcode route, label, status, column, page size, ngưỡng, storage key, query key hay
  toast. Giá trị dùng lại từ hai lần phải vào constants phù hợp.
- `src/constants/` là tầng thấp nhất, không import bất kỳ thứ gì khác từ `src/`.
- Không `any`, `@ts-ignore`, non-null assertion, hoặc `as unknown as` không có lý do. Dùng
  `unknown` + narrow/zod parse; `catch (error: unknown)` + type guard.
- Status lấy nguyên văn từ `src/constants/statuses.ts`; không gõ lại chuỗi ở nhiều nơi.
