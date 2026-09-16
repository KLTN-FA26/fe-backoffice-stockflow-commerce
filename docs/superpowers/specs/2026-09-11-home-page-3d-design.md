# Home Page — Single-viewport 3D Operations Portal

Ngày: 2026-09-11
Phạm vi: `src/app/page.tsx` + feature mới `src/features/home/`

## 1. Mục tiêu

Thay trang chủ hiện tại (landing scroll dài, 3 section) bằng **một khung hình duy nhất
không scroll**, có scene 3D kho hàng isometric làm điểm nhấn thị giác, cộng animation
reveal có chủ đích khi vào trang.

Trang chủ là **cổng đăng nhập nội bộ** — không phải marketing site. Vì vậy dùng token
**Mode A (Ink + Blue)**, theo `.claude/rules/mode-a-backoffice.md`. Tuyệt đối không có
caramel.

## 2. Quyết định đã chốt

| Câu hỏi                              | Quyết định                                                  |
| ------------------------------------ | ----------------------------------------------------------- |
| Nội dung 3D                          | Kệ kho isometric low-poly, có hiệu ứng "scan sweep"         |
| Fit màn hình                         | Đúng `100dvh`, `overflow-hidden`, không thanh cuộn          |
| Mức animation                        | Vừa phải: stagger reveal + auto-rotate + parallax chuột     |
| Dependency                           | `three` + `@react-three/fiber` + `@react-three/drei`        |
| Theme                                | Mode A — Ink + Blue, hỗ trợ cả light và dark                |
| Section "Công cụ cho từng điểm chạm" | Bỏ heading, nén 3 nội dung thành strip thẻ nhỏ              |
| Nút toggle dark mode ở header        | Có — theo đúng pattern của `BackofficeShell`                |
| Dữ liệu bin đầy/vơi                  | Pattern hình học cố định (seed tĩnh), không gắn số liệu nào |

## 3. Layout

```
┌───────────────────────────────────────────────────────────────┐
│ [Logo]                              [☀/☾]  [Đăng nhập]        │ h-16  shrink-0
├───────────────────────────────────────────────────────────────┤
│  ▸ Cổng vận hành nội bộ          ╭─────────────────────────╮ │
│  H1: Kiểm soát dòng hàng          │      WarehouseScene     │ │ flex-1
│      từ nhập kho đến bàn giao.    │         (R3F)           │ │ min-h-0
│  Mô tả…                           │                         │ │
│  [Vào hệ thống →]  Dành cho…      ╰─────────────────────────╯ │
│  ┌────────┐ ┌────────┐ ┌────────┐                            │
│  │ Nhập   │ │ Tồn kho│ │ Hoàn tất│  ← HomeFeatureStrip        │
│  └────────┘ └────────┘ └────────┘                            │
├───────────────────────────────────────────────────────────────┤
│ © 2026 StockFlowCommerce          Hệ thống quản lý vận hành   │ shrink-0
└───────────────────────────────────────────────────────────────┘
```

**Cơ chế fit:**

- Root: `h-dvh flex flex-col overflow-hidden`
- Header, footer: `shrink-0`
- Main: `flex-1 min-h-0` — `min-h-0` bắt buộc, nếu thiếu thì flex child không co lại được
  và trang tràn ra ngoài viewport.
- Dùng `dvh` chứ không `vh`: thanh địa chỉ mobile không cắt mất footer.

**Responsive:** cột 3D `hidden lg:block` (Mode A chỉ cam kết ≥1024px). Dưới `lg` hero
chiếm toàn bộ, feature strip xếp dọc. Không tối ưu 320px.

**Copy:** giữ nguyên văn bản của trang hiện tại. Không viết copy mới.

## 4. Scene 3D — `<WarehouseScene>`

### Hình học

- Grid **4 cột × 3 tầng = 12 bin**, sinh từ `BIN_GRID` trong `constants.ts`,
  không hardcode 12 mesh trong JSX.
- Mỗi bin là `<RoundedBox>` (drei) low-poly, radius nhỏ.
- Khung kệ: thanh dọc/ngang mảnh bằng `<Box>` scale — gợi hình kệ pallet.
- Nền: một `<Plane>` nhận bóng mềm, màu `bg.subtle`.

### Trạng thái bin — visual only

Mỗi bin có `fill: "full" | "partial" | "empty"` quyết định chiều cao khối hàng bên trong.
Phân bố **cố định trong constants** (không random runtime): tránh hydration mismatch và
tránh nhấp nháy khác nhau mỗi lần load.

> Đây là **trang trí thị giác, không phải dữ liệu tồn kho**. Comment bắt buộc trong file,
> theo tinh thần luật `<WarehouseMap>` ("map 3D KHÔNG phải nguồn sự thật tồn").
> Không hiển thị bất kỳ con số, mã SKU, hay nhãn định lượng nào trên scene.

### Animation

| Hiệu ứng       | Chi tiết                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| Scan sweep     | Mỗi `SCENE_TIMING.scanIntervalMs` (2400ms) một bin sáng `accent` rồi tắt dần, chạy tuần tự theo thứ tự index |
| Auto-rotate    | ~0.15 rad/s quanh trục Y, rất chậm                                                                           |
| Parallax chuột | Lerp có damping, biên độ tối đa ±8° — không để user kéo lệch tự do                                           |

**Không dùng `OrbitControls`** — góc nhìn cố định, người dùng không cần điều khiển.

### Camera & màu

- Orthographic camera, góc isometric cố định.
- Màu đọc từ CSS variable qua `useSceneColors()` — `--ink-primary`, `--accent`,
  `--bg-subtle`, `--border-default`. Hook phụ thuộc `useTheme()` (đã có sẵn trong
  `components/theme-provider.tsx`) nên đổi theme là màu 3D đổi theo, **không remount Canvas**.
- **Không hex trần trong tsx** — thoả luật `design-tokens.md`.

### Hiệu năng

- `next/dynamic(..., { ssr: false })` → `three` không vào server bundle, không vào bundle
  route `/admin/*`.
- Pause render loop khi tab ẩn (`visibilitychange`) để không đốt CPU nền.
- `dpr={[1, 2]}` — không render ở DPR 3 trên màn retina cao.

## 5. Animation 2D

| Element                            | Chuyển động                          | Thời lượng                |
| ---------------------------------- | ------------------------------------ | ------------------------- |
| Eyebrow → H1 → mô tả → CTA → strip | stagger fade + rise 12px             | 180ms/bước, delay 60ms    |
| Canvas wrapper                     | fade + scale 0.96→1                  | 400ms sau khi scene ready |
| Thẻ feature (hover)                | border → `border.strong`, icon nhích | 140ms                     |
| CTA chính (hover)                  | mũi tên trượt phải 3px               | 140ms                     |

Mode A quy định 120–180ms. Canvas 400ms là **ngoại lệ có chủ ý** cho lần vào trang
(fade-in của asset nặng) — ghi comment tại chỗ.

Toàn bộ bọc `useReducedMotion()`: reduced motion ⇒ không stagger, không auto-rotate,
không parallax, scene đứng yên ở frame tĩnh.

## 6. Cấu trúc file

```
src/features/home/
├── components/
│   ├── HomeHeader.tsx           "use client" — logo + theme toggle + nút đăng nhập
│   ├── HomeHero.tsx             "use client" — eyebrow/H1/mô tả/CTA + stagger
│   ├── HomeFeatureStrip.tsx     "use client" — 3 thẻ
│   ├── HomeFooter.tsx           footer mảnh (server component)
│   ├── WarehouseScene.tsx       "use client" — <Canvas> + lights + camera
│   ├── WarehouseBins.tsx        geometry + scan sweep (useFrame)
│   ├── SceneFallback.tsx        skeleton lúc lazy-load / WebGL lỗi
│   └── WarehouseSceneLazy.tsx   "use client" — next/dynamic wrapper (ssr: false)
├── constants.ts                 HOME_COPY, HOME_FEATURES, BIN_GRID, SCENE_TIMING, SCENE_GEOMETRY
├── use-scene-colors.ts          CSS var → THREE.Color, reactive theo theme
└── index.ts                     public API

src/app/page.tsx                 rút còn ≲ 40 dòng, chỉ compose
```

Feature `home` **không có** `api.ts`/`schemas.ts`/`queries.ts`/`mutations.ts`/`lifecycle.ts`/
`selectors.ts`: đây là trang tĩnh không gọi backend, không có vòng đời chứng từ.
`feature-architecture.md` quy định 7 file cho feature nghiệp vụ — home không phải một
module docs, nên miễn trừ có lý do, ghi rõ trong `index.ts`.

**Ràng buộc kích thước** (feature-architecture.md): file ≤ 200 dòng, component ≤ 150 dòng,
`page.tsx` ≤ 60 dòng.

## 7. Xử lý biên

| Tình huống                               | Xử lý                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| WebGL không khả dụng (VM, GPU blacklist) | `SceneFallback` giữ nguyên — grid CSS tĩnh + nhãn nhỏ. Không màn trắng, không crash. |
| Đang lazy-load `three`                   | `SceneFallback` dạng skeleton, cùng kích thước ⇒ không layout shift                  |
| Đổi theme khi scene chạy                 | `useSceneColors` đọc lại CSS var, cập nhật material — không remount                  |
| Tab ẩn                                   | Pause render loop qua `visibilitychange`                                             |
| `prefers-reduced-motion`                 | Scene tĩnh, không animation 2D                                                       |

## 8. Test

**Unit (Vitest, không cần WebGL):**

- `constants.ts` — `BIN_GRID` sinh đúng 12 bin; phân bố fill là hằng số (gọi 2 lần cho kết
  quả identical, chứng minh không random runtime).
- `use-scene-colors.ts` — parse CSS var thành màu hợp lệ; đổi `data-theme` ⇒ giá trị đổi.

**Component (RTL, mock `next/dynamic` → `SceneFallback`):**

- Home render đúng H1, CTA trỏ `APP_ROUTES.login`, 3 thẻ feature, footer.
- `prefers-reduced-motion: reduce` ⇒ không áp stagger.
- Theme toggle đổi `data-theme` trên `documentElement`.

**Không test** render 3D thật: jsdom không có WebGL context. Đây là giới hạn môi trường,
ghi rõ trong file test.

Coverage: `constants.ts` và `use-scene-colors.ts` ≥ 90%; component ≥ 70%; không đặt target
cho `app/page.tsx`.

## 9. Verify trước khi báo xong

`pnpm run validate` (typecheck + lint + test + build) — dán output thật.
Phân biệt lỗi mới với lỗi có sẵn trên `main` bằng `git stash` + chạy lại nếu cần.
