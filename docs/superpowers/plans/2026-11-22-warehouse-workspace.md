# Tab làm việc theo kho — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gom 7 màn thao tác của NV kho vào tab "Kho & bản đồ" dưới `/admin/warehouse-map/{prefix}/…`, để chọn kho một lần
và mọi màn bên trong chỉ làm việc với kho đó.

**Architecture:**

- Layout `[prefix]/layout.tsx` tra prefix ra kho rồi cấp kho cho các trang con qua context ở `lib/workspace`.
- Route group `[prefix]/(operations)/` (không đổi URL) chặn kho không được gán (`/me/permissions`). Group này bọc Gợi ý vị
  trí và 7 màn vận hành; bản đồ nằm ngoài, vì docs 06 nói bản đồ không giới hạn theo kho được gán.
- Feature đọc kho bằng `useWorkspaceWarehouse()`, không import `features/warehouse-map`.
  Route cũ thành trang mỏng chuyển hướng sang route mới. Panel sidebar và breadcrumb đọc chung một bảng cấu hình trang
  (`WORKSPACE_PAGES`).

**Tech Stack:** Next.js App Router · TypeScript strict · TanStack Query · nuqs · zod · Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-11-22-warehouse-workspace-design.md`. BE: KLTN-FA26/be-backoffice-stockflow-commerce#394.

## Global Constraints

- pnpm. Không dùng `npm install`.
- Base branch là `develop`. Có 4 PR FE:
  - A `feat/warehouse-workspace-foundation`: Task 1–5.
  - B `feat/workspace-putaway`: Task 6–7.
  - C `feat/workspace-fulfillment`: Task 8–10.
  - D `feat/workspace-moves-cycle-count`: Task 11–12.
  - B, C, D đều cắt từ A, độc lập với nhau.
- Trước khi báo xong mỗi PR: `pnpm run validate`, dán output thật. Lỗi có sẵn trên `develop` thì đối chiếu bằng `git stash`.
- Commit message không có trailer đồng tác giả Claude. PR body không có dòng "Generated with Claude Code".
- Không sửa `src/lib/mock-data.ts`, `components/ui/*`, `_design/*RULES.md`.
- Không hex trần, không `any`, không `!`, không `@ts-ignore`.
- Route / nhãn / quyền lấy từ `@/constants`. Nhãn mới vào `src/constants/labels-warehouse-map.ts` (object `workspace`).
- `features/A` không import `features/B`. `components/shared` không import `features/*`.
- Copy cố định (lấy nguyên văn):
  - "Bạn không được gán kho này"
  - "Bạn chưa được gán kho nào — liên hệ quản trị viên"
  - "Không được gán"
  - "Bạn đang có chuyến mở ở kho {prefix}"
  - nhóm panel "Vận hành" và "Bản đồ"
- `features/*` gọi BE chỉ với `warehouseId` của kho trên URL, không bao giờ với kho khác.
- PR B/C/D cùng thêm dòng vào `WORKSPACE_PAGES` và cùng bỏ item trong `NAV_GROUPS`, nên PR merge sau sẽ conflict ở hai chỗ
  này. Khi giải conflict, giữ mọi dòng theo thứ tự ở spec 5.6.
- Ngoài phạm vi plan: PR BE (#394), dọn `useAppStore.warehouseId` / `X-Warehouse-Id`.

## Review Focus

1. **Prefix gõ chữ thường** (`/admin/warehouse-map/bd/picking`): phải ra đúng kho BD; link sinh ra dùng prefix chuẩn từ danh
   mục. → test ở Task 3.
2. **Quyền `/me/permissions` đổi giữa phiên** (quản trị gỡ kho khỏi người dùng): lần refetch kế tiếp (focus lại) phải chuyển
   layout sang "Bạn không được gán kho này", không giữ màn cũ. → test ở Task 3.
3. **Link cũ có `?warehouse=` trỏ tới kho không có trong danh mục** (kho bị xoá / thiếu quyền): về gốc tab, không treo
   skeleton. → test ở Task 2.
4. **Đang ở trang chi tiết rồi đổi kho trên breadcrumb**: về trang list của màn đó ở kho mới, không mở chi tiết id cũ ở kho mới.
   → test ở Task 5.
5. **Role có quyền một màn vận hành nhưng không có quyền bản đồ** (vd chỉ `inventory-cycle-counts:VIEW_PAGE`): tab vẫn hiện,
   panel chỉ có màn đó, không có dòng Bản đồ. → test ở Task 5.

---

### Task 1: Kho được gán từ `/me/permissions`

**Files:**

- Modify: `src/lib/auth/me-permissions.ts` (schema)
- Create: `src/lib/auth/assigned-warehouses.ts`
- Create: `src/lib/auth/assigned-warehouses.test.ts`
- Modify: `src/lib/auth/index.ts` (export)
- Modify: `src/lib/auth/server/mock-permissions.ts` + test `src/lib/auth/server/mock-permissions.test.ts`
- Modify: `src/test/api-screen.tsx` (`mockApi`)

**Interfaces:**

- Produces:
  - `type AssignedScope = "restricted" | "all" | "unknown"`
  - `interface AssignedWarehouse { id: string; prefix: string }`
  - `assignedScopeOf(perms: MyPermissions | undefined): { scope: AssignedScope; warehouses: readonly AssignedWarehouse[] }` (thuần)
  - `canEnterWarehouse(assigned: { scope: AssignedScope; warehouses: readonly AssignedWarehouse[] }, prefix: string): boolean`
  - `useAssignedWarehouses(): { scope: AssignedScope; warehouses: readonly AssignedWarehouse[]; isLoading: boolean }`
  - `mockApi(role, routes, me?: { dataScope?: MyPermissions["dataScope"]; warehouses?: AssignedWarehouse[] })`

- [ ] **Step 1: Viết test đỏ** `assigned-warehouses.test.ts`:
  - `assignedScopeOf({ …, dataScope: "WAREHOUSE", warehouses: [{ id: "wh-bd", prefix: "BD" }] })` → `{ scope: "restricted", warehouses: [{ id: "wh-bd", prefix: "BD" }] }`
  - `dataScope: "WAREHOUSE"`, không có `warehouses` → `scope: "unknown"`
  - `dataScope: "WAREHOUSE"`, `warehouses: []` → `scope: "restricted"`, `warehouses: []`
  - `"ALL"`, `"TEAM"`, `"OWN"` → `scope: "all"` (kể cả khi có `warehouses`)
  - `undefined` → `scope: "unknown"`
  - `canEnterWarehouse(restricted BD, "bd")` → `true`; `(restricted BD, "HCM")` → `false`; `("all" | "unknown", "HCM")` → `true`
- [ ] **Step 2:** `pnpm vitest run src/lib/auth/assigned-warehouses.test.ts` → FAIL (module chưa có).
- [ ] **Step 3: Cài đặt.**
  - `myPermissionsSchema` thêm `warehouses: z.array(z.object({ id: z.string().min(1), prefix: z.string().min(1) })).optional()`.
    Comment cite BE #394 + docs 00 phạm vi `WAREHOUSE`.
  - Viết `assigned-warehouses.ts` theo Interfaces. Hook gọi `useMyPermissions()`; `isLoading` lấy từ query.
- [ ] **Step 4:** chạy lại → PASS.
- [ ] **Step 5: Mock BFF.**
  - Test đỏ trong `mock-permissions.test.ts`: tài khoản demo NV kho → `dataScope: "WAREHOUSE"`, `warehouses` gồm `{ id, prefix }`
    của các kho trong `warehouseIds` của user mock; tài khoản admin → `"ALL"`.
  - Cài đặt `mockSessionPermissions`:
    - `dataScope` = scope rộng nhất của các role, theo seed `mock-role-matrices.ts`;
    - prefix lấy từ danh mục kho mock mà `mock-routes` kho đang dùng.
- [ ] **Step 6:** `mockApi` nhận tham số thứ ba `me`, mặc định `{ dataScope: "ALL" }` (các test cũ không đổi). Chạy
      `pnpm vitest run src/lib/auth` → PASS.
- [ ] **Step 7: Commit** `feat(auth): read assigned warehouses from /me/permissions (BE #394)`.

### Task 2: `lib/workspace` — context, route helper, chuyển hướng

**Files:**

- Modify: `src/constants/routes.ts` (`ADMIN_ROUTES.warehouseMap`)
- Create: `src/lib/workspace/context.tsx`, `src/lib/workspace/redirect.tsx`, `src/lib/workspace/index.ts`
- Create: `src/lib/workspace/workspace.test.tsx`

**Interfaces:**

- Consumes: `useWarehouseDirectory()` (`lib/references/warehouse-options`, trả `{ warehouseId, code, name }`).
- Produces:
  - `ADMIN_ROUTES.warehouseMap.page(prefix: string, path?: string): string` → `/admin/warehouse-map/{PREFIX}` + (`/${path}` nếu có).
    Prefix được `encodeURIComponent`.
  - `WORKSPACE_PATHS` (constants):
    - `putaway: "putaway"`, `putawayTask: (id) => "putaway/{id}"`
    - `myTrip: "putaway/trip"`, `trip: (id) => "putaway/trips/{id}"`
    - `picking: "picking"`, `pickingTask: (id)`
    - `packing: "packing"`, `packingTask: (id)`
    - `putBacks: "put-backs"`, `moves: "moves"`
    - `cycleCounts: "cycle-counts"`, `cycleCount: (id)`
    - mọi id đều `encodeURIComponent`
  - `interface WorkspaceWarehouse { id: string; prefix: string; name: string }`
  - `WorkspaceWarehouseProvider({ value, children })`
  - `useWorkspaceWarehouse(): WorkspaceWarehouse`: ném `Error` khi nằm ngoài provider.
  - `useWorkspaceHref(): (path?: string) => string`: bọc `ADMIN_ROUTES.warehouseMap.page(prefix, path)` với prefix của context.
  - `withoutWarehouseParam(search: string): string`: bỏ `warehouse`, giữ thứ tự tham số khác, trả `""` hoặc `"?a=1"`.
  - `prefixOfLocation(code: string): string`: phần trước dấu `-` đầu tiên, viết hoa; không có `-` thì trả cả chuỗi viết
    hoa; rỗng thì `""`. Cùng quy ước với `warehouseOf` của `features/move`. Đặt ở PR A vì PR B (Task 6) và PR D
    (Task 11) đều dùng, mà hai PR này cắt độc lập từ A.
  - `WorkspaceRedirect(props: { warehouseId?: string | null; prefix?: string | null; path?: string; keepQuery?: boolean })`:
    - có `prefix` thì dùng luôn; không thì tra `warehouseId` → `code` qua `useWarehouseDirectory()`;
    - tra được → `router.replace(page(prefix, path) + (keepQuery ? withoutWarehouseParam(location.search) : ""))`;
    - không tra được (thiếu id, danh mục không có, danh mục lỗi) → `router.replace(ADMIN_ROUTES.warehouseMap.root)`;
    - trong lúc chờ render `PageSkeleton`.

- [ ] **Step 1: Viết test đỏ** `workspace.test.tsx`:
  - `page("bd", "picking")` → `/admin/warehouse-map/bd/picking`; `page("BD")` → `/admin/warehouse-map/BD`.
  - `withoutWarehouseParam("?warehouse=x&status=OPEN&q=a")` → `"?status=OPEN&q=a"`; `("?warehouse=x")` → `""`.
  - `useWorkspaceWarehouse` ngoài provider → ném lỗi; trong provider → trả đúng value.
  - `WorkspaceRedirect warehouseId="wh-bd" path="picking" keepQuery`, URL `?warehouse=wh-bd&status=OPEN` →
    `replace("/admin/warehouse-map/BD/picking?status=OPEN")`.
  - `WorkspaceRedirect warehouseId="wh-missing"` → `replace("/admin/warehouse-map")` (Review Focus 3).
  - Danh mục lỗi → cũng `replace("/admin/warehouse-map")`.
  - `prefixOfLocation("bd-a01")` → `"BD"`; `("HCM")` → `"HCM"`; `("")` → `""`.
- [ ] **Step 2:** `pnpm vitest run src/lib/workspace` → FAIL.
- [ ] **Step 3:** Cài đặt theo Interfaces. `routes.ts` giữ `of`/`slotting` cũ, viết lại bằng `page`.
- [ ] **Step 4:** chạy lại → PASS.
- [ ] **Step 5: Commit** `feat(workspace): warehouse context, route helpers and legacy redirect`.

### Task 3: Layout `[prefix]` cấp kho, layout `(operations)` chặn kho không được gán

Docs 06: bản đồ và vị trí **không** giới hạn theo kho được gán; chỉ nhiệm vụ cất hàng (và các màn vận hành) mới giới hạn.
Vì vậy có hai lớp:

- layout ngoài chỉ tra kho, cho cả bản đồ;
- route group `(operations)` (không đổi URL) chặn kho không được gán, bọc Gợi ý vị trí và 7 màn vận hành.

**Files:**

- Create: `src/app/admin/warehouse-map/[prefix]/layout.tsx`
- Create: `src/app/admin/warehouse-map/[prefix]/(operations)/layout.tsx`
- Move: `src/app/admin/warehouse-map/[prefix]/slotting/` → `src/app/admin/warehouse-map/[prefix]/(operations)/slotting/`
  (bỏ lớp `WarehouseScope` trong page)
- Modify: `src/features/warehouse-map/components/workspace/WarehouseScope.tsx` + `WarehouseScope.test.tsx`
- Create: `src/features/warehouse-map/components/workspace/AssignedOnly.tsx` + `AssignedOnly.test.tsx`
- Modify: `src/features/warehouse-map/components/map/WarehouseMapView.tsx` (bỏ `<WarehouseScope>` bên trong, lấy kho
  bằng `useWarehouseByPrefix(prefix).warehouse`)
- Modify: `src/features/putaway/components/slotting/SlottingView.tsx` (lấy kho bằng `useWorkspaceWarehouse()` thay vì
  tự tra danh mục)
- Modify: `src/constants/labels-warehouse-map.ts`

**Interfaces:**

- Consumes: Task 1 `useAssignedWarehouses`, `canEnterWarehouse`; Task 2 `WorkspaceWarehouseProvider`, `useWorkspaceWarehouse`.
- Produces:
  - `WarehouseScope({ prefix, children: ReactNode })`:
    - chưa có quyền / đang tải / lỗi / prefix lạ → giữ như cũ;
    - hợp lệ → `<WorkspaceWarehouseProvider value={{ id, prefix: warehouse.prefix, name }}>`;
    - **không** kiểm kho được gán;
    - bỏ dạng `children` là hàm.
  - `AssignedOnly({ children })`:
    - đọc `useWorkspaceWarehouse()` + `useAssignedWarehouses()`;
    - `isLoading` → skeleton;
    - không `canEnterWarehouse` → EmptyState `W.notAssignedTitle = "Bạn không được gán kho này"` + `W.notAssignedDescription`,
      kèm hai nút: link bản đồ `ADMIN_ROUTES.warehouseMap.of(prefix)` và link `ADMIN_ROUTES.warehouseMap.root`;
    - ngược lại → `children`.
  - `(operations)/layout.tsx` render `<AssignedOnly>{children}</AssignedOnly>`.

- [ ] **Step 1: Viết test đỏ:**
  - `WarehouseScope.test.tsx`: prefix `bd` → children đọc `useWorkspaceWarehouse()` thấy
    `{ id: "wh-bd", prefix: "BD", name: "Kho Bình Dương" }` (Review Focus 1). Restricted `[BD]`, prefix `HCM` → children
    **vẫn** render (bản đồ không bị chặn).
  - `AssignedOnly.test.tsx` (bọc provider kho HCM, mock `@/lib/auth`):
    - restricted `[BD]` → thấy "Bạn không được gán kho này", link bản đồ `/admin/warehouse-map/HCM`, **không** render
      children (children là component đếm số lần render = 0);
    - restricted `[HCM]` → render children;
    - `unknown`, `all` → render children;
    - rerender sau khi `useAssignedWarehouses` đổi từ `[BD, HCM]` sang `[BD]` → chuyển sang thông báo (Review Focus 2).
- [ ] **Step 2:** `pnpm vitest run src/features/warehouse-map/components/workspace` → FAIL.
- [ ] **Step 3:** Cài đặt. Hai `layout.tsx` là server component, ≤ 30 dòng: layout ngoài `await params`,
      `decodeURIComponent`, render `<WarehouseScope prefix>{children}</WarehouseScope>`. Chuyển slotting page vào group, sửa
      `WarehouseMapView` và `SlottingView` như mục Files.
- [ ] **Step 4:** `pnpm vitest run src/features/warehouse-map src/features/putaway/components/slotting` → PASS (test cũ của
      bản đồ / gợi ý vị trí sửa lại để bọc provider nếu cần, không giảm assertion).
- [ ] **Step 5: Commit** `feat(warehouse-map): [prefix] layout resolves the warehouse; operations group gates the assignment`.

### Task 4: Vào tab và Danh mục kho đánh dấu kho được gán

**Files:**

- Create: `src/features/warehouse-map/components/workspace/WorkspaceEntry.tsx` + `WorkspaceEntry.test.tsx`
- Modify: `src/app/admin/warehouse-map/page.tsx` (render `WorkspaceEntry` thay `redirect`)
- Modify: `src/features/warehouse-map/components/list/columns.tsx`, `src/features/warehouse-map/components/WarehouseList.tsx`
  - test hiện có của danh sách kho
- Modify: `src/features/warehouse-map/components/workspace/WarehouseCrumb.tsx`
- Modify: `src/components/backoffice/BackofficeShell.tsx` (group `href` → `ADMIN_ROUTES.warehouseMap.root`)

**Interfaces:**

- Consumes: Task 1 `useAssignedWarehouses`, `canEnterWarehouse`.
- Produces:
  - `WorkspaceEntry()`, xử lý theo thứ tự:
    - `isLoading` → skeleton;
    - restricted và đúng 1 kho → `router.replace(ADMIN_ROUTES.warehouseMap.of(prefix))`;
    - restricted và 0 kho → EmptyState `W.noAssignmentTitle = "Bạn chưa được gán kho nào — liên hệ quản trị viên"`;
    - còn lại → `router.replace(ADMIN_ROUTES.warehouses.list)`.
  - Nhãn `W.notAssignedBadge = "Không được gán"`.

- [ ] **Step 1: Viết test đỏ:**
  - `WorkspaceEntry`: restricted `[BD]` → `replace("/admin/warehouse-map/BD")`; restricted `[]` → thấy chữ EmptyState,
    không replace; `all` → `replace("/admin/warehouses")`; `unknown` → `replace("/admin/warehouses")`.
  - Danh mục kho, restricted `[BD]`, danh sách BD + HCM:
    - dòng HCM có badge "Không được gán";
    - bấm dòng HCM vẫn mở bản đồ `/admin/warehouse-map/HCM` (06: bản đồ không giới hạn theo kho được gán);
    - dòng BD vẫn mở `/admin/warehouse-map/BD`;
    - nút sửa kho của HCM vẫn còn với role Warehouse Manager.
  - `WarehouseCrumb`, restricted `[BD]` → popover có cả BD và HCM; dòng HCM có nhãn "Không được gán".
- [ ] **Step 2:** chạy test → FAIL.
- [ ] **Step 3:** Cài đặt. Badge dùng `<Badge variant="outline">` (không tự tô màu trạng thái).
- [ ] **Step 4:** chạy test → PASS.
- [ ] **Step 5: Commit** `feat(warehouse-map): workspace entry and catalog mark the assigned warehouses`.

### Task 5: Panel hai nhóm, gating tab, breadcrumb sâu, đổi kho trên trang chi tiết

**Files:**

- Create: `src/features/warehouse-map/components/workspace/workspace-pages.ts`
- Modify: `WarehouseNavPanel.tsx`, `WarehouseCrumb.tsx` (`warehouseBreadcrumbTail`, `swapPrefix`), `src/features/warehouse-map/workspace.ts`
- Modify: `src/components/backoffice/BackofficeShell.tsx` (nav item bản đồ: `anyPermission` thay `permission`)
- Test: `WarehouseNavPanel.test.tsx` (mới), `WarehouseCrumb.test.tsx` (mới), `src/components/backoffice/navigation-permissions.test.tsx`

**Interfaces:**

- Produces:
  - `interface WorkspacePage { path: string; group: "operations" | "map"; label: string; icon: LucideIcon; permission: PermissionCode; assignedOnly: boolean }`
    - `assignedOnly`: trang nằm trong `(operations)`. Bản đồ là `false`; Gợi ý vị trí và 7 màn vận hành là `true`.
  - `WORKSPACE_PAGES: readonly WorkspacePage[]`. Ở PR A chỉ có 2 dòng nhóm `map`:
    - Bản đồ: `path: ""`, quyền `WAREHOUSE_LOCATION_PERMISSIONS.viewPage`, `assignedOnly: false`;
    - Gợi ý vị trí: `path: "slotting"`, quyền `PUTAWAY_TASK_PERMISSIONS.viewPage`, `assignedOnly: true`.
  - Task 6–12 mỗi task thêm dòng nhóm `operations` của mình, `assignedOnly: true` (thứ tự theo spec 5.6).
  - `WORKSPACE_PERMISSIONS: readonly PermissionCode[]` = quyền của mọi dòng (dùng cho `anyPermission` của nav item).
  - `switchWarehouseHref(pathname: string, to: string): string` (thuần, ở `workspace.ts`):
    - đổi prefix;
    - giữ path trang dài nhất trong `WORKSPACE_PAGES` khớp với đầu phần còn lại;
    - bỏ phần sau (id chi tiết) và bỏ query.
  - `warehouseBreadcrumbTail(rest)`:
    - `[kho ⇅]`;
    - nhãn trang theo `WORKSPACE_PAGES` (path dài nhất khớp), link về trang list khi còn đoạn sau;
    - đoạn còn lại → nhãn id (`decodeURIComponent`).

- [ ] **Step 1: Viết test đỏ:**
  - `switchWarehouseHref("/admin/warehouse-map/BD/slotting", "HCM")` → `/admin/warehouse-map/HCM/slotting`.
  - `("/admin/warehouse-map/BD", "HCM")` → `/admin/warehouse-map/HCM`.
  - Với một `WORKSPACE_PAGES` giả có `picking`: `("/admin/warehouse-map/BD/picking/t-1", "HCM")` →
    `/admin/warehouse-map/HCM/picking` (Review Focus 4).
  - Panel trong kho BD với quyền đủ → thấy tiêu đề nhóm "Bản đồ" + 2 dòng; nhóm "Vận hành" không render khi rỗng.
  - Panel với quyền chỉ có `PUTAWAY_TASK_PERMISSIONS.viewPage` → không có dòng "Bản đồ", có "Gợi ý vị trí".
  - Panel ở kho HCM, restricted `[BD]`, quyền đủ → chỉ có dòng "Bản đồ"; không có "Gợi ý vị trí", không có nhóm "Vận hành".
  - `buildBreadcrumbItems("/admin/warehouse-map/BD/slotting")` → nhãn cuối "Gợi ý vị trí".
  - `navigation-permissions.test.tsx`: user chỉ có `PUTAWAY_TASK_PERMISSIONS.viewPage` (không có quyền bản đồ) → nhóm tab vẫn
    trong `visibleNavGroups` (Review Focus 5).
- [ ] **Step 2:** chạy test → FAIL.
- [ ] **Step 3:** Cài đặt.
  - Panel render theo `WORKSPACE_PAGES` lọc bằng `usePermissionChecker()`. Ở kho không `canEnterWarehouse` thì bỏ thêm các
    dòng `assignedOnly`. Nhóm có tiêu đề `W.groups.operations = "Vận hành"`,
    `W.groups.map = "Bản đồ"`, đặt theo thứ tự Vận hành rồi Bản đồ. Danh mục kho + Bảng sức chứa giữ ở cuối.
  - Nav item bản đồ: `anyPermission: WORKSPACE_PERMISSIONS`.
- [ ] **Step 4:** chạy test → PASS.
- [ ] **Step 5:** `pnpm run validate` → xanh. Dán output.
- [ ] **Step 6: Commit** `feat(warehouse-map): workspace panel groups, deep breadcrumb and warehouse switch on detail pages`.
      Commit kèm spec + plan nếu chưa có trên nhánh. Mở PR A vào `develop`.

---

**Công thức chung cho Task 6–12** (mỗi màn khi chuyển sang tab):

- (a) Tạo page mới dưới `src/app/admin/warehouse-map/[prefix]/(operations)/<path>/` (trong route group, URL vẫn là
  `/{prefix}/<path>`). Page ≤ 60 dòng, chỉ compose; giữ `error.tsx`,
  `loading.tsx`, `not-found.tsx` của route cũ (chuyển sang thư mục mới, link "về danh sách" dùng route mới).
- (b) Component màn đọc kho bằng `useWorkspaceWarehouse()`, link nội bộ bằng `useWorkspaceHref()`. Xoá ô chọn kho, tham số
  `warehouse` của nuqs, nhánh "chỉ thấy một kho thì dùng luôn", phần kho trong chip `Cấu hình` / `hasFilters` / `reset`.
- (c) Page route cũ thay bằng `WorkspaceRedirect`:
  - list: `warehouseId` lấy từ `?warehouse=`, `keepQuery`;
  - chi tiết: component chuyển hướng nhỏ trong feature, đọc bản ghi lấy `warehouseId`, rồi render `WorkspaceRedirect`.
- (d) Bỏ item khỏi nhóm cũ trong `NAV_GROUPS`. Thêm dòng vào `WORKSPACE_PAGES` (Task 5).
- (e) Link từ module ngoài tab giữ route cũ (trang chuyển hướng lo). Link trong tab đổi sang `useWorkspaceHref`.
- (f) Test bắt buộc của màn:
  - không còn `combobox`/ô chọn kho (`queryByLabelText` nhãn kho → null);
  - request gửi `warehouseId` = kho của provider;
  - redirect list (`?warehouse=wh-bd&status=…` → route mới giữ `status`);
  - redirect chi tiết → đúng kho của bản ghi;
  - test lifecycle / action-gating cũ giữ nguyên, chỉ bọc thêm provider.
  - Render qua `renderScreen` bọc `WorkspaceWarehouseProvider value={{ id: "wh-bd", prefix: "BD", name: "Kho Bình Dương" }}`.

### Task 6: Cất hàng (list + chi tiết) — PR B

**Files:**

- Modify: `src/features/putaway/components/{PutawayList,PutawayToolbar,usePutawayFilters,putaway-columns}.tsx|ts`,
  `detail/PutawayTaskDetail.tsx`, `slotting/SlottingView.tsx` (link chi tiết), `trip/TripSideNote.tsx`, `trip/TripPages.tsx`
  (`back` href)
- Delete: `src/features/putaway/components/PutawayWarehouseSelect.tsx` (nếu không còn ai dùng sau Task 7)
- Create: `src/features/putaway/components/PutawayTaskRedirect.tsx`
- Pages: `[prefix]/putaway/page.tsx`, `[prefix]/putaway/[taskId]/page.tsx`. `src/app/admin/putaway/page.tsx` và
  `[taskId]/page.tsx` → chuyển hướng.
- Modify: `src/features/putaway/schemas.ts` (`warehouseId: z.string().optional()` trên task — BE #394)

**Interfaces:**

- `usePutawayFilters()` (bỏ tham số `onlyWarehouseId`, bỏ `warehouse` khỏi `PARSERS`/`CLEARED`):
  - `params` = `{ receiptId }` nếu có `?receipt=`, ngược lại `{ warehouseId: workspace.id }`;
  - `ready` luôn `true`.
- `PutawayTaskRedirect({ taskId })`:
  - prefix = `task.warehouseId` nếu có (tra qua `WorkspaceRedirect warehouseId`);
  - không có thì `WorkspaceRedirect prefix={prefixOfLocation(task.sourceLocationCode)}` (Task 2).
- Link "Phiếu nhận → Cất hàng" (`ReceiptActions`, `ADMIN_ROUTES.putaway.byReceipt`): giữ route cũ, `?receipt=` chuyển hướng
  sang kho của phiếu nhận. Phiếu nhận đã có `warehouseId`, nên đổi `byReceipt` thành
  `(warehouseId, receiptId) => "/admin/putaway?warehouse=…&receipt=…"`.

- [ ] **Step 1:** Viết test đỏ:
  - theo (f);
  - `?receipt=r-1` → request `{ receiptId: "r-1" }` (không kèm `warehouseId`);
  - `PutawayTaskRedirect` có `warehouseId` → đúng kho;
  - `PutawayTaskRedirect` không có `warehouseId`, `sourceLocationCode: "BD-RCV-01"` → `/admin/warehouse-map/BD/putaway/{id}`;
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo công thức + Interfaces. Thêm dòng `{ path: "putaway", group: "operations", label: PUTAWAY_LABELS.title, icon: PackageCheck, permission: PUTAWAY_TASK_PERMISSIONS.viewPage }`.
- [ ] **Step 4:** `pnpm vitest run src/features/putaway src/features/receipt src/lib/workspace` → PASS.
- [ ] **Step 5: Commit** `feat(putaway): putaway list and task detail live in the warehouse workspace`.

### Task 7: Chuyến cất hàng — PR B

**Files:**

- Modify: `src/features/putaway/components/trip/{TripStart,TripPages,MyTripPage}.tsx` (+ test hiện có)
- Create: `src/features/putaway/components/trip/TripElsewhere.tsx`, `src/features/putaway/components/trip/TripRedirect.tsx`
- Pages: `[prefix]/putaway/trip/page.tsx`, `[prefix]/putaway/trips/[tripId]/page.tsx`. Route cũ → chuyển hướng.
- Modify: `PutawayToolbar.tsx` (nút "Chuyến cất hàng" → `useWorkspaceHref()(WORKSPACE_PATHS.myTrip)`)

**Interfaces:**

- `TripStart`: `warehouseId = useWorkspaceWarehouse().id`. Không còn select, không còn `?warehouse=`.
- `TripElsewhere({ prefix }: { prefix: string })`:
  - EmptyState `W.tripElsewhere(prefix) = "Bạn đang có chuyến mở ở kho {prefix}"`;
  - nút link `ADMIN_ROUTES.warehouseMap.page(prefix, WORKSPACE_PATHS.myTrip)`;
  - prefix tra từ `trip.warehouseId` qua `useWarehouseDirectory()`.
- `MyTripPage`: chuyến hiện tại có `warehouseId !== workspace.id` → render `TripElsewhere`, không render `TripView`.
  `TripPage({ tripId })` xử lý giống vậy.
- `TripRedirect({ tripId })` cho route cũ `/admin/putaway/trips/{id}`. `/admin/putaway/trip` cũ → nếu có chuyến hiện tại thì
  sang kho của chuyến, không thì `WorkspaceRedirect` với `?warehouse=`.

- [ ] **Step 1:** Viết test đỏ:
  - tab BD, `/putaway-trips/current` trả chuyến kho HCM → thấy "Bạn đang có chuyến mở ở kho HCM", link
    `/admin/warehouse-map/HCM/putaway/trip`, không có nút thao tác chuyến;
  - tab BD, không có chuyến → bấm "Mở chuyến" gửi `{ warehouseId: "wh-bd" }`;
  - `TripRedirect` → `/admin/warehouse-map/HCM/putaway/trips/{id}` theo `trip.warehouseId`.
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** Cài đặt. Thêm dòng `{ path: "putaway/trip", group: "operations", label: PUTAWAY_TRIP_LABELS.title, icon: Route, permission: PUTAWAY_TRIP_PERMISSIONS.viewPage }`.
      Xoá `PutawayWarehouseSelect` nếu hết người dùng.
- [ ] **Step 4:** `pnpm vitest run src/features/putaway` → PASS. `pnpm run validate` → xanh, dán output.
- [ ] **Step 5: Commit** `feat(putaway): putaway trips in the warehouse workspace, open trip elsewhere is flagged`. Mở PR B
      vào `develop` (ghi rõ phụ thuộc PR A).

### Task 8: Lấy hàng — PR C

**Files:**

- Modify: `src/features/fulfillment/components/list/{useTaskListState,TaskListFilters,TaskListToolbar,useTaskFilterLabels,TaskListBody}.ts|tsx`,
  `assign/CreateTaskDialog.tsx`, `detail/TaskActionCard.tsx`, `put-back/put-back-columns.tsx`,
  `carton-check/CartonCheckStatusCard.tsx`, `picking/PickLinesSection.tsx`, `FulfillmentLoadError.tsx`
- Create: `src/features/fulfillment/components/PickingTaskRedirect.tsx`
- Pages: `[prefix]/picking/page.tsx`, `[prefix]/picking/[id]/page.tsx`. Route cũ → chuyển hướng.
- Modify: `src/features/fulfillment/schemas.ts:47` (`warehouseId` của task: `z.string()` — BE `FulfillmentTaskResponse` bắt buộc)

**Interfaces:**

- `useTaskListState()`:
  - bỏ `warehouse` / `setWarehouse`; `params.warehouseId = workspace.id`;
  - lọc người được gán (`useAssignees(workspace.id, …)`) luôn bật được, nên bỏ nhánh `pickWarehouseFirst`;
  - nhánh `isOutOfDataScope` ở `TaskListBody` bỏ điều kiện `s.warehouse`.
- `CreateTaskDialog`: chỉ cho chọn đơn có `warehouseId === workspace.id`. Nếu API đơn chờ release nhận `warehouseId` thì gửi
  lên; không thì lọc FE. Người làm kiểm `fulfillment/api.ts` và chọn đúng một cách, ghi comment.
- `PickLinesSection`: link Cất lại → `useWorkspaceHref()(WORKSPACE_PATHS.putBacks)`, bỏ `listInWarehouse`.
- `PickingTaskRedirect({ id })`: đọc task, rồi `WorkspaceRedirect warehouseId={task.warehouseId} path={WORKSPACE_PATHS.pickingTask(id)}`.
- `FulfillmentLoadError` (list href): nhận href qua prop thay vì gắn cứng route cũ.

- [ ] **Step 1:** Viết test đỏ:
  - theo (f);
  - lọc người được gán gọi `/fulfillment/assignees` với `warehouseId: "wh-bd"` mà không cần chọn kho;
  - `CreateTaskDialog` không liệt kê đơn của kho HCM khi đang ở tab BD;
  - test action-gating ≥ 3 role hiện có vẫn xanh.
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** Cài đặt. Thêm dòng `{ path: "picking", label: "Lấy hàng", icon: <icon hiện tại của nav item>, permission: <quyền hiện tại của nav item> }`.
- [ ] **Step 4:** `pnpm vitest run src/features/fulfillment` → PASS.
- [ ] **Step 5: Commit** `feat(fulfillment): picking lives in the warehouse workspace`.

### Task 9: Kiểm thùng — PR C

**Files:**

- Modify: `src/features/fulfillment/components/carton-queue/{useCartonCheckQueueState,QueueBody,columns}.ts|tsx` (+ test)
- Create: `src/features/fulfillment/components/carton-check/CartonCheckRedirect.tsx`
- Pages: `[prefix]/packing/page.tsx`, `[prefix]/packing/[id]/page.tsx`. Route cũ → chuyển hướng.

**Interfaces:**

- `useCartonCheckQueueState()`: bỏ `warehouseId` của nuqs; `params.warehouseId = workspace.id`; `filtered = !!status`.
- `QueueBody`: bỏ cột / tra tên kho (mọi dòng cùng kho).
- `columns.tsx`, `onRowClick`: link chi tiết bằng `useWorkspaceHref()(WORKSPACE_PATHS.packingTask(row.taskId))`.
- `CartonCheckRedirect({ id })`: đọc phiên kiểm thùng (`CartonCheckSessionResponse.warehouseId`), rồi `WorkspaceRedirect`.

- [ ] **Step 1:** Test đỏ theo (f), thêm: bảng không còn cột "Kho".
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** Cài đặt. Thêm dòng `packing` vào `WORKSPACE_PAGES` (nhãn `UI_LABELS.cartonCheck.navTitle`).
- [ ] **Step 4:** `pnpm vitest run src/features/fulfillment` → PASS.
- [ ] **Step 5: Commit** `feat(fulfillment): carton check queue lives in the warehouse workspace`.

### Task 10: Cất lại — PR C

**Files:**

- Modify: `src/features/fulfillment/components/put-back/{usePutBackListState,PutBackToolbar,PutBackTable,PutBackScreen}.ts|tsx`
  (+ `PutBackScreen.test.tsx`)
- Delete: `src/features/fulfillment/components/WarehouseFilterSelect.tsx` khi không còn ai dùng (grep sau Task 8–10)
- Modify: `src/constants/routes.ts` (bỏ `putBacks.listInWarehouse`)
- Pages: `[prefix]/put-backs/page.tsx`. Route cũ → chuyển hướng (list).

**Interfaces:**

- `usePutBackListState()`: bỏ `warehouse`; request `warehouseId = workspace.id`.
- `emptyState "no-rows-in-warehouse"` giữ (giờ luôn đúng kho của tab).

- [ ] **Step 1:** Test đỏ theo (f).
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** Cài đặt. Thêm dòng `put-backs` vào `WORKSPACE_PAGES` (`PUT_BACK_LABELS.title`).
- [ ] **Step 4:** `pnpm vitest run src/features/fulfillment` → PASS. `pnpm run validate` → xanh, dán output.
- [ ] **Step 5: Commit** `feat(fulfillment): put-back queue lives in the warehouse workspace`. Mở PR C vào `develop`.

### Task 11: Di chuyển nội bộ — PR D

**Files:**

- Modify: `src/features/move/{api,queries}.ts`, `src/features/move/components/{MoveCreate,MoveFields,StockRowPicker}.tsx`
  (+ test), `src/features/inventory/components/RecentMoves.tsx` (+ test), `src/constants/move.ts`
- Pages: `[prefix]/moves/page.tsx`. `src/app/admin/moves/page.tsx` → `WorkspaceRedirect` (không có kho nên về gốc tab).
- Modify: `src/features/dashboard/components/mock/mock-warnings.ts` (giữ `/admin/moves`, trang chuyển hướng lo)

**Interfaces:**

- `listStockRows(warehouseId: string, sku: string, signal?)` → `GET /warehouses/{warehouseId}/stock-items?sku=` (BE
  `InventoryController.warehouseStock`, trang có phân trang: lấy trang đầu với `size` = hằng số hiện dùng, ghi
  `truncated` nếu còn trang). Parse bằng schema hiện có, chỉnh nếu field BE khác.
- `useDestinationCodes(fromLocation, enabled)`: dùng `workspace.id` trực tiếp, bỏ tra prefix → kho.
- `MoveFields`: mã nguồn / đích có `prefixOfLocation(code) !== workspace.prefix` (Task 2) → lỗi inline
  `W.moveWrongWarehouse(prefix)`, chặn submit. Comment cite docs 11 BR-01 + "Backend phải re-check".
- `RecentMoves({ warehouseId }: { warehouseId: string })`: truyền `warehouseId` cho `GET /inventory/movements`. Page compose
  bằng một wrapper client nhỏ ở `features/move` đọc `useWorkspaceWarehouse().id` (page là server, không đọc được context).

- [ ] **Step 1:** Viết test đỏ:
  - tra SKU gọi `/warehouses/wh-bd/stock-items` với `{ sku }`;
  - nhập nguồn `HCM-A01` ở tab BD → lỗi inline, nút submit disabled, không gọi `POST /inventory/movements`;
  - `RecentMoves` gửi `warehouseId: "wh-bd"`.
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** Cài đặt. Thêm dòng `{ path: "moves", label: "Di chuyển nội bộ", icon: Move, permission: INVENTORY_PERMISSIONS.stockUpdate }`.
- [ ] **Step 4:** `pnpm vitest run src/features/move src/features/inventory/components/RecentMoves.test.tsx` → PASS.
- [ ] **Step 5: Commit** `feat(move): intra-warehouse moves are scoped to the workspace warehouse`.

### Task 12: Kiểm kê — PR D

**Files:**

- Modify: `src/features/inventory/{cycle-count-queries,cycle-count-mutations,cycle-count-schemas}.ts`,
  `components/{CycleCountList,CycleCountCreateDialog,CycleCountActions,cycle-count-columns}.tsx` (+ test)
- Create: `src/features/inventory/components/CycleCountRedirect.tsx`
- Pages: `[prefix]/cycle-counts/page.tsx`, `[prefix]/cycle-counts/[id]/page.tsx`. `src/app/admin/inventory/cycle-counts/**`
  → chuyển hướng.
- Modify: `src/constants/cycle-count.ts` (`CYCLE_COUNT_ROUTES` chỉ còn dùng cho route cũ)

**Interfaces:**

- `cycleCountListInput` thêm `warehouseId: z.string()` (BE `CycleCountController` nhận `warehouseId`).
- `useCycleCounts(params)` lấy `warehouseId` từ `useWorkspaceWarehouse()` thay vì `useAppStore` (cả query key lẫn params). Chi
  tiết và mutations của kiểm kê cũng bỏ `useAppStore`.
- `CycleCountCreateDialog`: bỏ select kho; `values.warehouseId = workspace.id`; vẫn tải khu (`useWarehouseZones`) và người
  đếm theo kho đó.
- `CycleCountActions` / `CycleCountCreateDialog` / columns: điều hướng chi tiết bằng
  `useWorkspaceHref()(WORKSPACE_PATHS.cycleCount(id))`.
- `CycleCountRedirect({ id })`: đọc phiếu (`CycleCountResponse.warehouseId`), rồi `WorkspaceRedirect`.

- [ ] **Step 1:** Viết test đỏ:
  - theo (f);
  - list gửi `warehouseId: "wh-bd"`;
  - dialog lập phiếu không có ô chọn kho, `POST` gửi `warehouseId: "wh-bd"`;
  - test lifecycle + action-gating ≥ 3 role giữ nguyên.
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** Cài đặt. Thêm dòng `{ path: "cycle-counts", label: CYCLE_COUNT_LABELS.title, icon: ClipboardCheck, permission: CYCLE_COUNT_PERMISSIONS.viewPage }`.
- [ ] **Step 4:** `pnpm vitest run src/features/inventory` → PASS. `pnpm run validate` → xanh, dán output.
- [ ] **Step 5: Commit** `feat(inventory): cycle counts live in the warehouse workspace`. Mở PR D vào `develop`.
