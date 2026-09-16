---
description: Danh mục shared components — dùng lại cái gì thay vì viết mới, quy ước chung
globs:
  - "src/components/**"
  - "src/features/**/components/**"
---

# Shared components

Nguồn: `FRONTEND-AI-RULES.md` §6. **Trước khi viết component mới, tra bảng này.**
Viết lại thứ đã có là nguyên nhân số một khiến UI lệch nhau giữa các module.

## Ba tầng, đừng nhầm

| Thư mục                                             | Nội dung          | Quy tắc                                                  |
| --------------------------------------------------- | ----------------- | -------------------------------------------------------- |
| `components/ui/`                                    | shadcn nguyên bản | **KHÔNG sửa tay.** Hook `guard-protected-files.mjs` chặn |
| `components/shared/`                                | dùng chung 2 mode | **KHÔNG chứa nghiệp vụ** — nhận data qua props           |
| `components/backoffice/` · `components/storefront/` | riêng từng mode   | được biết mode của mình                                  |

## Layout & khung

`<PageHeader>` (title + breadcrumb + action phải / hero mode B) · `<SectionTitle>` ·
`<AppCard>`/`<SurfaceCard>` (biến thể `elevated` cho storefront, `flush` cho back-office) ·
`<BackofficeShell>` (sidebar + topbar) · `<StorefrontShell>` (header mỏng + footer +
floating cart/chat) · `<PageContainer>` (max-width + padding theo mode).

## Dữ liệu & hiển thị

`<DataTable>` (chủ lực mode A — xem [data-table-mode-a.md](data-table-mode-a.md)) ·
`<FilterBar>`/`<FilterPanel>` (drawer trên mobile, dùng chung 2 mode) · `<SortDropdown>` ·
`<SearchBar>` · `<StatTile>`/`<KpiCard>` (giá trị mono tabular + nhãn + delta) ·
`<EmptyState>` · `<MoneyText>` (formatVND, tabular-nums, hỗ trợ giá khuyến mãi + % giảm).

## Phản hồi

`<Toast>` (sonner) · `<ConfirmDialog>` (**bắt buộc** cho hành động phá huỷ) ·
`<AlertInline>` (warning không chặn, vd ngày giao quá khứ) · `<Skeleton>` · `<Tooltip>`.

## Back-office chuyên biệt

`<WarehouseMap>` (2D/3D + heatmap) · `<SlottingSuggestionList>` (ranked) ·
`<MatchDiffView>` (three-way) · `<PickList>` · `<ScanInput>` (barcode, auto-focus) ·
`<VariantMatrix>` (Size×Color) · `<ReasonCodePicker>` · `<TimelineEvents>`.

## Storefront chuyên biệt

- **Catalog**: `<ProductCard>` · `<ProductGrid>` · `<ImageGallery>` · `<PriceDisplay>` ·
  `<AvailabilityBadge>` (dựa ATP) · `<VariantSelector>` · `<RatingStars>` ·
  `<WishlistButton>` · `<QuantityStepper>`
- **Cart/Checkout**: `<CartLineItem>` · `<VoucherInput>` · `<OrderTotals>` ·
  `<CheckoutStepper>` · `<AddressForm>` (VN 3 cấp) · `<ShippingMethodSelector>` ·
  `<PaymentMethodSelector>`
- **Order**: `<OrderTimeline>` · `<TrackingProgress>` · `<OrderCard>` · `<ReturnRequestForm>`
- **Chat**: `<ChatBubble>` · `<ChatComposer>` · `<RichLinkCard>` · `<InternalNote>` ·
  `<SLABadge>` · `<CSATSurvey>`
- **Design**: `<DesignCanvas>` · `<CanvasToolbar>` · `<LivePreview3D>` (+fallback) ·
  `<PreflightReport>` · `<DesignVersionList>`
- **Customer**: `<CustomerProfileCard>` · `<AddressBook>` · `<SavedPaymentMethod>` ·
  `<SegmentBadge>` · `<LoyaltyTierBadge>`

## Quy ước chung (§6.3)

- Shared component **không chứa nghiệp vụ cứng** — nhận dữ liệu qua props,
  nhận `density`/`tone`/`size` làm variant.
- Mọi component hỗ trợ **dark mode qua token** — không hardcode màu.
- Mọi component interactive có **focus-visible** rõ (ring `border.strong` / `accent.blue`)
  và tôn trọng **`prefers-reduced-motion`**.
- `<StatusBadge>` là component quan trọng nhất — xem [skill status-badge](../skills/status-badge/SKILL.md).

## Mock data (§8)

- Trạng thái trong mock phải **phủ đủ mọi giá trị** của bảng vòng đời — để demo được
  hết badge màu và action-gating.
- List 15–50 dòng (đủ test pagination), 1–3 detail mẫu.
- Tiền **VND**, đơn vị **mét**, địa chỉ **VN (tỉnh/huyện/xã)**, nhãn song ngữ Việt–Anh
  khi là thuật ngữ.
- Dữ liệu suy đoán → comment `// ASSUMPTION (open-question Dn)`.
- Mock **không kèm hàm xử lý nghiệp vụ** — chỉ dữ liệu tĩnh + (tuỳ chọn) delay giả lập loading.
- `src/lib/mock-data.ts` **không được sửa** (hook chặn). Chỉ `lib/api/mock-adapter.ts` import nó.
